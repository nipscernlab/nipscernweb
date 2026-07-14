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
const BRAND: &str = "#7cb5ff";
const BRAND_DEEP: &str = "#5b9cf6";

const DM_TTF: &[u8] = include_bytes!("../fonts/DMSerifDisplay-Regular.ttf");
const INTER_TTF: &[u8] = include_bytes!("../fonts/Inter-Regular.ttf");

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

fn category_color(cat: &str) -> &'static str {
    match cat {
        "milestone" => "#a78bfa",
        "award" => "#fbbf24",
        "event" => "#34d399",
        "publication" => "#60a5fa",
        _ => BRAND,
    }
}

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

fn brandmark(x: f32, y: f32, scale: f32) -> String {
    let fs = (38.0 * scale).round();
    let dom_fs = (20.0 * scale).round();
    let atom = fs * 0.42;
    let gap = fs * 0.30;
    let nips_w = fs * 0.62 * 4.0;
    let ax = x + nips_w + gap;
    let ay = y - fs * 0.34;
    let sw = (atom * 0.09_f32).max(2.0);
    format!(
        r##"<g>
  <text x="{x}" y="{y}" font-family="Inter" font-weight="700" font-size="{fs}" fill="#ffffff" letter-spacing="0.5">NIPS</text>
  <g transform="translate({ax},{ay})">
    <circle cx="0" cy="0" r="{r}" fill="{BRAND}"/>
    <g fill="none" stroke="{BRAND}" stroke-width="{sw}">
      <ellipse cx="0" cy="0" rx="{rx}" ry="{ry}"/>
      <ellipse cx="0" cy="0" rx="{rx}" ry="{ry}" transform="rotate(60)"/>
      <ellipse cx="0" cy="0" rx="{rx}" ry="{ry}" transform="rotate(120)"/>
    </g>
  </g>
  <text x="{cx}" y="{y}" font-family="Inter" font-weight="700" font-size="{fs}" fill="#ffffff" letter-spacing="0.5">CERN</text>
  <text x="{x}" y="{dy}" font-family="Inter" font-weight="500" font-size="{dom_fs}" fill="{BRAND}" letter-spacing="1">nipscern.com</text>
</g>"##,
        r = atom * 0.16,
        rx = atom * 0.5,
        ry = atom * 0.2,
        cx = ax + atom * 0.7,
        dy = y + dom_fs * 1.7,
    )
}

/// Build the share SVG for one format. `cover_uri` is a JPEG/PNG data URI or None.
fn build_share_svg(format: &Format, title: &str, category: &str, date: &str, cover_uri: &Option<String>) -> String {
    let (w, h) = (format.w as f32, format.h as f32);
    let accent = category_color(category);

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
    let title_fs = ((if format.key == "og" { 66.0 } else { 82.0 }) * scale).round();
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

    let badge_fs = (24.0 * scale).round();
    let badge_text = category.to_uppercase();
    let badge_pad_x = (18.0 * scale).round();
    let badge_pad_y = (10.0 * scale).round();
    let badge_w = (badge_text.chars().count() as f32 * badge_fs * 0.62).round() + badge_pad_x * 2.0;
    let badge_h = (badge_fs * 1.7).round();
    let badge_y = pad;
    let date_fs = (22.0 * scale).round();
    let stroke = (1.5 * scale).max(1.0);
    let rule_w = (70.0 * scale).round();
    let rule_h = (5.0 * scale).round().max(3.0);
    let date_svg = if date.is_empty() {
        String::new()
    } else {
        format!(
            r##"<text x="{}" y="{}" font-family="Inter" font-weight="500" font-size="{date_fs}" fill="#c9d4e6" letter-spacing="0.5">{}</text>"##,
            pad + badge_w + (18.0 * scale).round(),
            badge_y + badge_h - badge_pad_y - (2.0 * scale).round(),
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
<rect x="{pad}" y="{badge_y}" rx="{brx}" ry="{brx}" width="{badge_w}" height="{badge_h}" fill="{accent}" fill-opacity="0.18" stroke="{accent}" stroke-opacity="0.55" stroke-width="{stroke}"/>
<text x="{btx}" y="{bty}" font-family="Inter" font-weight="700" font-size="{badge_fs}" fill="{accent}" letter-spacing="1.5">{badge_text}</text>
{date_svg}
<rect x="{pad}" y="{rule_y}" width="{rule_w}" height="{rule_h}" rx="2" fill="{BRAND_DEEP}"/>
<text font-family="DM Serif Display" font-weight="400" font-size="{title_fs}" fill="#ffffff">{tspans}</text>
{brand}
</svg>"##,
        brx = badge_h / 2.0,
        btx = pad + badge_pad_x,
        bty = badge_y + badge_h - badge_pad_y - (2.0 * scale).round(),
        rule_y = title_top - (title_fs * 0.9).round(),
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

/// Decode a cover (WebP/JPEG/PNG), cover-crop to the box, return a JPEG data URI.
fn cover_data_uri(bytes: &[u8], w: u32, h: u32) -> Option<String> {
    let img = image::load_from_memory(bytes).ok()?;
    let filled = img.resize_to_fill(w, h, FilterType::Lanczos3);
    let mut jpg = Vec::new();
    JpegEncoder::new_with_quality(&mut jpg, 88).encode_image(&filled).ok()?;
    Some(format!("data:image/jpeg;base64,{}", base64::engine::general_purpose::STANDARD.encode(&jpg)))
}

fn render_jpeg(svg: &str, w: u32, h: u32, opt: &usvg::Options) -> Result<Vec<u8>, Box<dyn Error>> {
    let tree = usvg::Tree::from_str(svg, opt)?;
    let mut pixmap = tiny_skia::Pixmap::new(w, h).ok_or("pixmap alloc")?;
    pixmap.fill(tiny_skia::Color::from_rgba8(7, 10, 18, 255));
    resvg::render(&tree, tiny_skia::Transform::identity(), &mut pixmap.as_mut());
    let mut rgb = Vec::with_capacity((w * h * 3) as usize);
    for px in pixmap.data().chunks_exact(4) {
        rgb.extend_from_slice(&px[..3]);
    }
    let rgb_img = image::RgbImage::from_raw(w, h, rgb).ok_or("rgb build")?;
    let mut out = Vec::new();
    JpegEncoder::new_with_quality(&mut out, 82).encode_image(&rgb_img)?;
    Ok(out)
}

// ---- per-post Open Graph page (static, for crawlers) ----

fn og_page(slug: &str, title: &str, desc: &str) -> String {
    let t = xml_escape(&format!("{} — NIPS-CERN", title));
    let d = xml_escape(&desc.chars().take(300).collect::<String>());
    let url = format!("{SITE}/news/{slug}");
    let img = format!("{CDN}/{slug}/og-en.jpg");
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
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{img}">
<link rel="canonical" href="{url}">
<meta http-equiv="refresh" content="0; url={spa}">
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

fn process_post(post: &Value, opt: &usvg::Options, dist: &Path, news_dir: &Path) -> Result<(), Box<dyn Error>> {
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

    // Decode the cover once per size.
    let cover_bytes = if cover_url.is_empty() { None } else { fetch_cover(cover_url) };

    for f in FORMATS {
        let uri = cover_bytes
            .as_ref()
            .and_then(|b| cover_data_uri(b, f.w, f.h));
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
        process_post(post, &opt, &dist, &news_dir)?;
        count += 1;
    }

    println!("\nDone: {count} post(s).");
    println!("Images → {}", dist.join("share").display());
    println!("Upload dist/share/* to cdn.nipscern.com/share/ , and commit the new news/<slug>.html pages.");
    Ok(())
}
