// ===========================================================================
// share-gen — local, free generator of NIPS-CERN social share images + OG pages.
//
//   cd tools/share-gen && cargo run --release
//
// Reads ../../data/news.json (+ news-featured.json), renders every format ×
// language (+ raw covers) with resvg, and writes:
//   • dist/share/<slug>/<format>[-<lang>].jpg   → upload to cdn.nipscern.com/share/
//   • ../../news/<slug>.html                     → per-post Open Graph page (commit)
//
// No server, no paid services: everything runs on your machine. See README.md.
// ===========================================================================
use std::error::Error;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use base64::Engine;
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use resvg::{tiny_skia, usvg};
use serde_json::Value;

const SITE: &str = "https://www.nipscern.com";
const CDN: &str = "https://cdn.nipscern.com/share";
// Cache-buster: the CDN (Cloudflare) caches images for a year, so bump this on
// every image regeneration to force fresh delivery. MUST match CDN_VER in
// news/post.html. See tools/share-gen/README.md.
const IMG_VER: &str = "4";
const BRAND: &str = "#7cb5ff";
const BRAND_DEEP: &str = "#5b9cf6";

const DM_TTF: &[u8] = include_bytes!("../fonts/DMSerifDisplay-Regular.ttf");
const INTER_TTF: &[u8] = include_bytes!("../fonts/Inter-Regular.ttf");
const MONO_TTF: &[u8] = include_bytes!("../fonts/JetBrainsMono.ttf");

// 3× supersampling: render at triple size, then Lanczos-downscale — maximum
// text/line crispness at the cost of render time (local, one-off: worth it).
const SS: u32 = 3;

struct Format {
    key: &'static str,
    w: u32,
    h: u32,
    text: bool,
}
const FORMATS: &[Format] = &[
    Format { key: "og",        w: 1200, h: 630,  text: true },
    Format { key: "square",    w: 1080, h: 1080, text: true },
    Format { key: "portrait",  w: 1080, h: 1350, text: true },
    Format { key: "story",     w: 1080, h: 1920, text: true },
    Format { key: "raw",       w: 1200, h: 630,  text: false },
    Format { key: "rawsquare", w: 1080, h: 1080, text: false },
    Format { key: "rawstory",  w: 1080, h: 1920, text: false },
];


fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

// ---- data helpers (work on serde_json::Value; en = top-level, others under translations) ----

fn is_featured(post: &Value) -> bool {
    post.get("featured").and_then(Value::as_bool).unwrap_or(false)
        || post
            .get("translations")
            .and_then(|t| t.get("en"))
            .and_then(|e| e.get("content_html"))
            .is_some()
}

fn s<'a>(post: &'a Value, key: &str) -> &'a str {
    post.get(key).and_then(Value::as_str).unwrap_or("")
}

fn title_for(post: &Value, lang: &str) -> String {
    if is_featured(post) {
        let tr = &post["translations"];
        for l in [lang, "en", "pt"] {
            if let Some(t) = tr.get(l).and_then(|x| x.get("title")).and_then(Value::as_str) {
                return t.to_string();
            }
        }
        return s(post, "title").to_string();
    }
    if lang == "en" {
        return s(post, "title").to_string();
    }
    post.get("translations")
        .and_then(|t| t.get(lang))
        .and_then(|x| x.get("title"))
        .and_then(Value::as_str)
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| s(post, "title"))
        .to_string()
}

fn excerpt_for(post: &Value, lang: &str) -> String {
    if lang != "en" {
        if let Some(e) = post
            .get("translations")
            .and_then(|t| t.get(lang))
            .and_then(|x| x.get("excerpt").or_else(|| x.get("subtitle")))
            .and_then(Value::as_str)
        {
            if !e.is_empty() {
                return e.to_string();
            }
        }
    }
    s(post, "excerpt").to_string()
}

fn available_langs(post: &Value) -> Vec<String> {
    let mut langs = vec!["en".to_string()];
    if let Some(tr) = post.get("translations").and_then(Value::as_object) {
        for (l, v) in tr {
            if l != "en"
                && (v.get("title").and_then(Value::as_str).map_or(false, |t| !t.is_empty())
                    || v.get("subtitle").and_then(Value::as_str).map_or(false, |t| !t.is_empty()))
            {
                langs.push(l.clone());
            }
        }
    }
    langs
}

fn slug_of(post: &Value) -> String {
    let sl = s(post, "slug");
    if !sl.is_empty() { sl.to_string() } else { s(post, "id").to_string() }
}

fn date_label(iso: &str, lang: &str) -> String {
    let en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    let pt = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
    let parts: Vec<&str> = iso.split('-').collect();
    if parts.len() != 3 { return String::new(); }
    let (y, m, d) = (parts[0], parts[1].parse::<usize>().unwrap_or(1), parts[2].parse::<u32>().unwrap_or(1));
    let months = if lang == "pt" { pt } else { en };
    let mm = months.get(m.saturating_sub(1)).copied().unwrap_or("");
    format!("{} {} {}", d, mm, y)
}

// ---- title wrapping (approx char width; matches the JS heuristic) ----

fn wrap_title(text: &str, max_width: f32, font_size: f32, max_lines: usize) -> Vec<String> {
    let char_factor = 0.5;
    let max_chars = ((max_width / (font_size * char_factor)).floor() as usize).max(6);
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut lines: Vec<String> = Vec::new();
    let mut line = String::new();
    for word in &words {
        let candidate = if line.is_empty() { word.to_string() } else { format!("{} {}", line, word) };
        if candidate.chars().count() <= max_chars {
            line = candidate;
        } else {
            if !line.is_empty() { lines.push(std::mem::take(&mut line)); }
            line = word.to_string();
            if lines.len() == max_lines { break; }
        }
    }
    if !line.is_empty() && lines.len() < max_lines { lines.push(line); }
    lines.truncate(max_lines);
    let used: usize = lines.iter().map(|l| l.chars().count()).sum::<usize>() + lines.len().saturating_sub(1);
    if used < text.split_whitespace().collect::<Vec<_>>().join(" ").chars().count() && !lines.is_empty() {
        let last = lines.last_mut().unwrap();
        while last.chars().count() > 1 && last.chars().count() > max_chars.saturating_sub(1) {
            last.pop();
        }
        let trimmed = last.trim_end_matches([' ', '.', ',', ';', ':']).to_string();
        *last = format!("{}…", trimmed);
    }
    lines
}

/// NIPS⚛CERN wordmark in the site's serif, with the site's own atom glyph
/// (assets/icons/atom.svg) between the words, plus the domain below.
fn brandmark(x: f32, y: f32, scale: f32) -> String {
    let fs = (34.0 * scale).round();      // monospace wordmark size
    let ls = 1.0 * scale;                 // letter-spacing
    let dom_fs = (16.0 * scale).round();
    // JetBrains Mono is monospace (~0.6em advance/char). "NIPS" = 4 glyphs.
    let nips_w = fs * 0.6 * 4.0 + ls * 4.0;
    let d = fs * 0.92;                    // atom diameter
    let gap = fs * 0.22;
    let acx = x + nips_w + gap + d / 2.0; // atom centre x
    let acy = y - fs * 0.33;              // atom centre y (visual middle of caps)
    let cern_x = acx + d / 2.0 + gap;
    let s = d / 256.0;                    // atom.svg is a 256×256 canvas
    let dy = y + dom_fs * 2.0;
    format!(
        r##"<g>
  <text x="{x}" y="{y}" font-family="JetBrains Mono" font-weight="700" font-size="{fs}" fill="#ffffff" letter-spacing="{ls}">NIPS</text>
  <g transform="translate({acx},{acy}) scale({s}) translate(-128,-128)" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="128" cy="128" rx="44.13" ry="116.33" transform="translate(-53.02 128) rotate(-45)" fill="none" stroke="{BRAND}" stroke-width="18"/>
    <ellipse cx="128" cy="128" rx="116.33" ry="44.13" transform="translate(-53.02 128) rotate(-45)" fill="none" stroke="{BRAND}" stroke-width="18"/>
    <circle cx="128" cy="128" r="16" fill="{BRAND}"/>
  </g>
  <text x="{cern_x}" y="{y}" font-family="JetBrains Mono" font-weight="700" font-size="{fs}" fill="#ffffff" letter-spacing="{ls}">CERN</text>
  <text x="{x}" y="{dy}" font-family="Inter" font-weight="600" font-size="{dom_fs}" fill="{BRAND}" letter-spacing="1.2">nipscern.com</text>
</g>"##,
    )
}

/// A neon-blue honeycomb of single-line hexagons confined to the band between
/// `top` and `bottom` (the top of the title block), with a soft opacity fade
/// at both ends so it blends into the dark scrim — it must never run over the
/// title. Pointy-top hexagons in a proper honeycomb — shared edges overlap,
/// so it reads as one continuous mesh, not doubled outlines.
fn hex_mesh(w: f32, top: f32, bottom: f32, r: f32, sw: f32) -> String {
    const NEON: &str = "#3ad2ff";
    let s = 0.866_025_4 * r; // √3/2 · r  (half-width)
    let dx = 2.0 * s;
    let dy = 1.5 * r;
    let span = bottom - top;
    if span < dy * 2.0 {
        return String::new();
    }
    let rows = (span / dy).ceil() as i32;
    let cols = (w / dx).ceil() as i32 + 2;
    let mut out = format!(
        r##"<g fill="none" stroke="{NEON}" stroke-width="{sw}" stroke-linejoin="round">"##
    );
    for row in 0..rows {
        let cy = top + row as f32 * dy;
        if cy + r > bottom {
            break;
        }
        let x_off = if row % 2 == 1 { s } else { 0.0 };
        // Fade: peak in the middle of the band, transparent toward the bright
        // image (top) and toward the title zone (bottom).
        let frac = ((cy - top) / span).clamp(0.0, 1.0);
        let fade_in = (frac / 0.35).clamp(0.0, 1.0);
        let fade_out = ((1.0 - frac) / 0.35).clamp(0.0, 1.0);
        let op = 0.20 * fade_in.min(fade_out);
        if op <= 0.02 {
            continue;
        }
        for col in -1..cols {
            let cx = x_off + col as f32 * dx;
            out.push_str(&format!(
                r##"<path d="M{:.1},{:.1} L{:.1},{:.1} L{:.1},{:.1} L{:.1},{:.1} L{:.1},{:.1} L{:.1},{:.1} Z" stroke-opacity="{:.3}"/>"##,
                cx, cy - r, cx + s, cy - r / 2.0, cx + s, cy + r / 2.0,
                cx, cy + r, cx - s, cy + r / 2.0, cx - s, cy - r / 2.0, op,
            ));
        }
    }
    out.push_str("</g>");
    out
}

/// Point on a quadratic Bézier at parameter t.
fn qbez(p0: (f32, f32), c: (f32, f32), p1: (f32, f32), t: f32) -> (f32, f32) {
    let u = 1.0 - t;
    (
        u * u * p0.0 + 2.0 * u * t * c.0 + t * t * p1.0,
        u * u * p0.1 + 2.0 * u * t * c.1 + t * t * p1.1,
    )
}

/// The signature background of every NIPS-CERN news card: an "event display".
/// A soft brand-blue glow rises from the lower-left corner (where the title
/// sits) and a fan of thin, magnetically-bent particle tracks sweeps from
/// off-canvas bottom-left across the title zone, each fading in and out along
/// its own length, with a few bright hit-points where the "detector" saw them.
/// Geometry is anchored to the title zone (`zone_top`) so it composes the same
/// way on every format, and it is deterministic — the same quiet signature on
/// every post rather than a new gimmick each time.
fn event_layer(w: f32, h: f32, zone_top: f32, scale: f32) -> String {
    const NEON: &str = "#3ad2ff";
    let zh = (h - zone_top).max(1.0);
    let sw = (1.5 * scale).max(1.0);
    let p0 = (-0.08 * w, h + 0.08 * zh);
    // (control point, end point, stroke gradient, stroke opacity, spark ts)
    let tracks: [((f32, f32), (f32, f32), &str, f32, &[f32]); 5] = [
        ((0.38 * w, zone_top + 0.14 * zh), (1.06 * w, zone_top + 0.02 * zh), "trkA", 0.30, &[0.58]),
        ((0.44 * w, zone_top + 0.36 * zh), (1.06 * w, zone_top + 0.28 * zh), "trkB", 0.24, &[0.40, 0.70]),
        ((0.50 * w, zone_top + 0.60 * zh), (1.06 * w, zone_top + 0.58 * zh), "trkA", 0.18, &[0.74]),
        ((0.34 * w, zone_top + 0.52 * zh), (0.92 * w, h + 0.08 * zh), "trkB", 0.14, &[]),
        ((0.56 * w, zone_top + 0.86 * zh), (1.06 * w, zone_top + 0.90 * zh), "trkA", 0.12, &[]),
    ];
    let glow_r = zh * 1.6;
    let mut out = format!(
        r##"<radialGradient id="glow" gradientUnits="userSpaceOnUse" cx="{gx:.1}" cy="{h}" r="{glow_r:.1}">
<stop offset="0" stop-color="#2f6fe0" stop-opacity="0.34"/>
<stop offset="0.55" stop-color="#2f6fe0" stop-opacity="0.10"/>
<stop offset="1" stop-color="#2f6fe0" stop-opacity="0"/>
</radialGradient>
<linearGradient id="trkA" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="{BRAND}" stop-opacity="0"/>
<stop offset="0.45" stop-color="{BRAND}" stop-opacity="1"/>
<stop offset="1" stop-color="{BRAND}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="trkB" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="{NEON}" stop-opacity="0"/>
<stop offset="0.45" stop-color="{NEON}" stop-opacity="1"/>
<stop offset="1" stop-color="{NEON}" stop-opacity="0"/>
</linearGradient>
<rect x="0" y="0" width="{w}" height="{h}" fill="url(#glow)"/>
<g fill="none" stroke-width="{sw:.2}" stroke-linecap="round">"##,
        gx = 0.10 * w,
    );
    let mut sparks = String::new();
    for (c, p1, grad, op, ts) in &tracks {
        out.push_str(&format!(
            r##"<path d="M{:.1},{:.1} Q{:.1},{:.1} {:.1},{:.1}" stroke="url(#{grad})" stroke-opacity="{op}"/>"##,
            p0.0, p0.1, c.0, c.1, p1.0, p1.1,
        ));
        for t in *ts {
            let (sx, sy) = qbez(p0, *c, *p1, *t);
            sparks.push_str(&format!(
                r##"<circle cx="{sx:.1}" cy="{sy:.1}" r="{:.1}" fill="{NEON}" fill-opacity="0.10"/><circle cx="{sx:.1}" cy="{sy:.1}" r="{:.1}" fill="{NEON}" fill-opacity="0.45"/>"##,
                7.0 * scale,
                2.4 * scale,
            ));
        }
    }
    out.push_str(&sparks);
    out.push_str("</g>");
    out
}

/// Build the share SVG for one format. `cover_uri` is a JPEG/PNG data URI or None.
fn build_share_svg(format: &Format, title: &str, _category: &str, date: &str, cover_uri: &Option<String>) -> String {
    let (w, h) = (format.w as f32, format.h as f32);

    let cover = match cover_uri {
        Some(uri) => format!(
            r##"<image href="{uri}" x="0" y="0" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice"/>"##
        ),
        None => format!(r##"<rect x="0" y="0" width="{w}" height="{h}" fill="url(#bgFallback)"/>"##),
    };

    if !format.text {
        return format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs><radialGradient id="bgFallback" cx="50%" cy="38%" r="80%">
<stop offset="0%" stop-color="#12203a"/><stop offset="100%" stop-color="#070a12"/></radialGradient></defs>
{cover}
</svg>"##
        );
    }

    let scale = w / 1200.0;
    let pad = (64.0 * scale).round();
    let title_fs = ((if format.key == "og" { 60.0 } else { 76.0 }) * scale).round();
    let line_h = (title_fs * 1.14).round();
    let max_lines = if format.key == "og" { 4 } else if format.key == "story" { 6 } else { 5 };
    let lines = wrap_title(title, w - pad * 2.0, title_fs, max_lines);

    let brand_y = h - pad;
    let title_bottom = brand_y - (96.0 * scale).round();
    let title_top = title_bottom - (lines.len().saturating_sub(1) as f32) * line_h;
    let tspans: String = lines
        .iter()
        .enumerate()
        .map(|(i, ln)| format!(r##"<tspan x="{pad}" y="{}">{}</tspan>"##, title_top + i as f32 * line_h, xml_escape(ln)))
        .collect();

    let date_fs = (24.0 * scale).round();
    let rule_w = (70.0 * scale).round();
    let rule_h = (5.0 * scale).round().max(3.0);
    // Decorative neon hexagonal mesh: a band over the photo that fades out
    // BEFORE the accent rule / title — it must never sit behind the text.
    let rule_y = title_top - (title_fs * 0.9).round();
    let mesh_top = (h * 0.28).round();
    let mesh_bottom = (rule_y - 14.0 * scale).round();
    let mesh_r = 22.0 * scale;
    let mesh_sw = (1.3 * scale).max(0.9);
    // Date, top-left (no badge), bright.
    let date_svg = if date.is_empty() {
        String::new()
    } else {
        format!(
            r##"<text x="{pad}" y="{}" font-family="Inter" font-weight="600" font-size="{date_fs}" fill="#eef4ff" letter-spacing="0.6">{}</text>"##,
            (pad + date_fs * 0.9).round(),
            xml_escape(date),
        )
    };

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs>
<radialGradient id="bgFallback" cx="50%" cy="38%" r="80%">
<stop offset="0%" stop-color="#12203a"/><stop offset="100%" stop-color="#070a12"/></radialGradient>
<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#05070d" stop-opacity="0.55"/>
<stop offset="42%" stop-color="#05070d" stop-opacity="0.15"/>
<stop offset="72%" stop-color="#05070d" stop-opacity="0.72"/>
<stop offset="100%" stop-color="#05070d" stop-opacity="0.95"/></linearGradient>
</defs>
{cover}
<rect x="0" y="0" width="{w}" height="{h}" fill="url(#scrim)"/>
<linearGradient id="titleShade" gradientUnits="userSpaceOnUse" x1="0" y1="{shade_top}" x2="0" y2="{h}">
<stop offset="0" stop-color="#05070d" stop-opacity="0"/>
<stop offset="0.38" stop-color="#05070d" stop-opacity="0.62"/>
<stop offset="1" stop-color="#05070d" stop-opacity="0.92"/>
</linearGradient>
<rect x="0" y="{shade_top}" width="{w}" height="{shade_h}" fill="url(#titleShade)"/>
{event}
{mesh}
{date_svg}
<rect x="{pad}" y="{rule_y}" width="{rule_w}" height="{rule_h}" rx="2" fill="{BRAND_DEEP}"/>
<text font-family="DM Serif Display" font-weight="400" font-size="{title_fs}" fill="#ffffff">{tspans}</text>
{brand}
</svg>"##,
        shade_top = (rule_y - 170.0 * scale).round(),
        shade_h = h - (rule_y - 170.0 * scale).round(),
        event = event_layer(w, h, rule_y, scale),
        mesh = hex_mesh(w, mesh_top, mesh_bottom, mesh_r, mesh_sw),
        brand = brandmark(pad, brand_y, scale),
    )
}

// ---- cover + rendering ----

fn fetch_cover(url: &str) -> Option<Vec<u8>> {
    let resp = ureq::get(url).call().ok()?;
    let mut bytes = Vec::new();
    resp.into_reader().read_to_end(&mut bytes).ok()?;
    Some(bytes)
}

/// Load a cover from an absolute URL (fetch) or a repo-relative path (read the
/// file locally). Some posts store `assets/images/news/…` rather than a CDN URL.
fn load_cover(cover: &str, repo: &Path) -> Option<Vec<u8>> {
    if cover.is_empty() {
        return None;
    }
    if cover.starts_with("http://") || cover.starts_with("https://") {
        fetch_cover(cover)
    } else {
        fs::read(repo.join(cover.trim_start_matches('/'))).ok()
    }
}

/// Decode a cover (WebP/JPEG/PNG), cover-crop to the box, return a JPEG data URI.
fn cover_data_uri(bytes: &[u8], w: u32, h: u32) -> Option<String> {
    let img = image::load_from_memory(bytes).ok()?;
    let filled = img.resize_to_fill(w, h, FilterType::Lanczos3);
    let mut jpg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpg, 97).encode_image(&filled).ok()?;
    Some(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(&jpg)))
}

/// Render the SVG at SS× and downscale with Lanczos3 → crisp text/mesh, then
/// encode a high-quality JPEG.
fn render_jpeg(svg: &str, w: u32, h: u32, opt: &usvg::Options) -> Result<Vec<u8>, Box<dyn Error>> {
    let tree = usvg::Tree::from_str(svg, opt)?;
    let (pw, ph) = (w * SS, h * SS);
    let mut pixmap = tiny_skia::Pixmap::new(pw, ph).ok_or("pixmap alloc")?;
    pixmap.fill(tiny_skia::Color::from_rgba8(7, 10, 18, 255));
    resvg::render(&tree, tiny_skia::Transform::from_scale(SS as f32, SS as f32), &mut pixmap.as_mut());
    let mut rgb = Vec::with_capacity((pw * ph * 3) as usize);
    for px in pixmap.data().chunks_exact(4) {
        rgb.extend_from_slice(&px[..3]);
    }
    let big = image::RgbImage::from_raw(pw, ph, rgb).ok_or("rgb build")?;
    let small = image::DynamicImage::ImageRgb8(big).resize_exact(w, h, FilterType::Lanczos3);
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, 96).encode_image(&small)?;
    Ok(out)
}

// ---- per-post Open Graph page (static, for crawlers) ----

fn og_page(slug: &str, title: &str, desc: &str) -> String {
    let t = xml_escape(&format!("{} — NIPS-CERN", title));
    let d = xml_escape(&desc.chars().take(300).collect::<String>());
    let url = format!("{SITE}/news/{slug}");
    let img = format!("{CDN}/{slug}/og-en.jpg?v={IMG_VER}");
    let spa = format!("/news/post?id={slug}");
    format!(
        r##"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{t}</title>
<meta name="description" content="{d}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{img}">
<meta property="og:image:secure_url" content="{img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{t}">
<meta property="og:site_name" content="NIPS-CERN">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">
<link rel="canonical" href="{url}">
<script>location.replace('{spa}' + location.hash);</script>
</head>
<body style="background:#070a12;color:#c9d4e6;font-family:system-ui,sans-serif;padding:2rem">
<p>Redirecting to <a href="{spa}" style="color:#7cb5ff">{t}</a>…</p>
</body>
</html>
"##
    )
}

// ---- driver ----

fn process_post(post: &Value, opt: &usvg::Options, dist: &Path, news_dir: &Path, repo: &Path) -> Result<(), Box<dyn Error>> {
    let slug = slug_of(post);
    if slug.is_empty() {
        return Ok(());
    }
    let category = s(post, "category");
    let cover_url = s(post, "image");
    let langs = available_langs(post);
    println!("\n# {slug}  ({category}, langs: {})", langs.join("/"));

    let out_dir = dist.join("share").join(&slug);
    fs::create_dir_all(&out_dir)?;

    // Decode the cover once per size (absolute URL → fetch; relative → local file).
    let cover_bytes = load_cover(cover_url, repo);
    if cover_bytes.is_none() && !cover_url.is_empty() {
        println!("  ! capa não carregou: {cover_url}");
    }

    for f in FORMATS {
        let uri = cover_bytes
            .as_ref()
            .and_then(|b| cover_data_uri(b, f.w * SS, f.h * SS));
        let variants: Vec<String> = if f.text { langs.clone() } else { vec!["_".to_string()] };
        for lang in &variants {
            let title = if f.text { title_for(post, lang) } else { String::new() };
            let date = if f.text { date_label(s(post, "date"), lang) } else { String::new() };
            let svg = build_share_svg(f, &title, category, &date, &uri);
            let jpg = render_jpeg(&svg, f.w, f.h, opt)?;
            let name = if f.text { format!("{}-{}.jpg", f.key, lang) } else { format!("{}.jpg", f.key) };
            fs::write(out_dir.join(&name), &jpg)?;
            println!("  ✓ {:<20} {}×{}  {} KB", name, f.w, f.h, jpg.len() / 1024);
        }
    }

    // Static OG page (English default), committed to the site.
    let og = og_page(&slug, &title_for(post, "en"), &excerpt_for(post, "en"));
    fs::write(news_dir.join(format!("{slug}.html")), og)?;
    println!("  → news/{slug}.html (OG page)");
    Ok(())
}

fn main() -> Result<(), Box<dyn Error>> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo = manifest.join("..").join("..");
    let dist = manifest.join("dist");
    let news_dir = repo.join("news");
    fs::create_dir_all(&dist)?;

    // Fonts once.
    let mut opt = usvg::Options::default();
    opt.fontdb_mut().load_font_data(DM_TTF.to_vec());
    opt.fontdb_mut().load_font_data(INTER_TTF.to_vec());
    opt.fontdb_mut().load_font_data(MONO_TTF.to_vec());

    // Which posts? default: all in news.json (+ featured). Or slugs from argv.
    let args: Vec<String> = std::env::args().skip(1).collect();
    let news: Value = serde_json::from_str(&fs::read_to_string(repo.join("data/news.json"))?)?;
    let mut posts: Vec<Value> = news.as_array().cloned().unwrap_or_default();
    if let Ok(feat) = fs::read_to_string(repo.join("data/news-featured.json")) {
        if let Ok(v) = serde_json::from_str::<Value>(&feat) {
            posts.push(v);
        }
    }

    let mut count = 0;
    for post in &posts {
        let slug = slug_of(post);
        if !args.is_empty() && !args.iter().any(|a| a == &slug || Some(a.as_str()) == post.get("id").and_then(Value::as_str)) {
            continue;
        }
        process_post(post, &opt, &dist, &news_dir, &repo)?;
        count += 1;
    }

    println!("\nDone: {count} post(s).");
    println!("Images → {}", dist.join("share").display());
    println!("Upload dist/share/* to cdn.nipscern.com/share/ , and commit the new news/<slug>.html pages.");
    Ok(())
}
