/* The four experiments, drawn from their own geometry
   ------------------------------------------------------------------
   The pins around the ring on the CERN page used to carry the collaborations'
   logos, and then photographs of the caverns. A logo is a trademark CERN asks
   permission for; a photograph of a 7,000-tonne machine shrunk to a 44-pixel
   disc is an orange smear. Neither answers the question the reader has at
   that size, which is: what shape is this machine, and why is it not the same
   shape as the other three.

   So the pins carry figures, built here the way the TileCal pulse and the
   Meyrin map are built, from published numbers, by a tool, committed as
   files. Each figure is the whole pin: a porthole cut into the page, dark
   like the page, with the machine drawn to its rim. There is no white disc
   behind it any more, because a white disc is a container for a mark that was
   drawn for paper, and these are not marks.

   Each is a section through the real detector at its real radii, in metres:

     ATLAS   inner detector 1.15, LAr EM 1.5-2.0, tile 2.28-4.25,
             barrel toroid 4.7-10.05 (eight coils), muon chambers to 11
     CMS     tracker 1.1, ECAL 1.29-1.75, HCAL 1.77-2.95,
             solenoid 2.95-3.8, twelve-sided return yoke 3.95-7.4
     ALICE   ITS 0.43, TPC 0.85-2.50 (eighteen sectors), TRD 2.90-3.68,
             TOF 3.70-3.99, octagonal L3 magnet 5.0-5.9
     LHCb    a forward spectrometer, not a barrel: VELO at the crossing,
             RICH1, the warm dipole at 4-8 m, tracking stations, RICH2,
             calorimeters, five muon stations, out to 19.5 m along the beam,
             inside the 10-250 mrad acceptance that is the whole point of it

   Two rules hold the set together. The magnet is what makes each of these
   machines a different shape, so the magnet is the one warm thing in each
   figure: eight toroid coils for ATLAS, the solenoid ring for CMS, the L3
   octagon for ALICE, the dipole for LHCb. And every figure carries tracks
   out of the crossing, because a detector without an event in it is a
   drawing of a hole: charged tracks bend, muons run through everything,
   ALICE's are thick as grass because that is what a lead-lead event is, and
   LHCb's all leave to one side and kink where the dipole bends them.

   The tracks are thrown by a seeded generator, so the files this writes are
   the same files on every machine and the data guard can compare them.

   Run:  node tools/build-experiment-figures.js
*/

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets', 'images', 'cern', 'experiments');

/* The page is dark, so the figures are drawn for a dark ground: light
   structure, warm magnet, the page's own blue at the beam. */
const BODY = '#0b1322';        /* the porthole itself */
const RIM = '#5b9cf6';         /* one thin blue line, and that is the whole
                                  container: the white disc the marks used to
                                  sit on was a slab against the countryside */
const STRUCT = '#c9d6ea';      /* the heavy parts */
const SOFT = '#7f95b8';        /* the lighter ones */
const FAINT = '#3f537a';
const WARM = '#efa84e';        /* the magnet, whichever magnet it is */
const BEAM = '#5b9cf6';

/* The event colours, at full chroma. These are the one place in the figure
   allowed to shout: everything around them is structure, held down in greys,
   and the tracks are the physics. The same four run on the ring in cern.js,
   so a reader who watches a collision fire at Point 1 and then looks at the
   pin is reading one palette. */
const TRACK = {
  charged: '#ffc21f',   /* bending in the field, the amber of every display */
  muon: '#ff3b5c',      /* through everything, and drawn red everywhere */
  neutral: '#22e0ff',   /* no charge, no bend */
  photon: '#3ef08a',    /* into the electromagnetic calorimeter and stops */
};

const VB = 100;
const C = VB / 2;
const RIM_R = 49.2;            /* the drawing runs to here, the pin's own edge */
const n = (v) => Number(v.toFixed(2));

/* Seeded, so two runs write the same bytes. */
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const circle = (r, attrs) => `<circle cx="${C}" cy="${C}" r="${n(r)}" ${attrs}/>`;

/* An annulus as one path, so a layer can be a body rather than two strokes. */
const annulus = (r0, r1, attrs) => {
  const ring = (r) => `M ${n(C - r)} ${C} a ${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0 a ${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0 Z`;
  return `<path d="${ring(r1)} ${ring(r0)}" fill-rule="evenodd" ${attrs}/>`;
};

const polygon = (sides, r, rot, attrs) => {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * 2 * Math.PI) / sides;
    pts.push(n(C + r * Math.cos(a)) + ',' + n(C + r * Math.sin(a)));
  }
  return `<polygon points="${pts.join(' ')}" ${attrs}/>`;
};

const spokes = (count, r0, r1, rot, attrs) => {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = rot + (i * 2 * Math.PI) / count;
    s += `<line x1="${n(C + r0 * Math.cos(a))}" y1="${n(C + r0 * Math.sin(a))}"`
      + ` x2="${n(C + r1 * Math.cos(a))}" y2="${n(C + r1 * Math.sin(a))}" ${attrs}/>`;
  }
  return s;
};

/* Chambers laid around a radius, in the gaps: the muon stations are boxes,
   not a ring, and at this size a dozen short bars say "chambers" where a
   dashed circle says "dotted line". */
const chambers = (count, r, len, thick, rot, attrs) => {
  let s = '';
  for (let i = 0; i < count; i++) {
    const a = rot + (i * 2 * Math.PI) / count;
    const ca = Math.cos(a), sa = Math.sin(a);
    const p = (rr, sx) => `${n(C + ca * rr - sa * sx)},${n(C + sa * rr + ca * sx)}`;
    s += `<polygon points="${p(r - thick / 2, len / 2)} ${p(r + thick / 2, len / 2)}`
      + ` ${p(r + thick / 2, -len / 2)} ${p(r - thick / 2, -len / 2)}" ${attrs}/>`;
  }
  return s;
};

/* One event, drawn the way the ring draws its collisions: charged tracks
   curve, muons run straight and far, neutrals go out short. Radii in the
   figure's own units. */
function tracksRadial(rand, count, rMax, opts = {}) {
  const {
    width = 1.4, muonFrac = 0.16, neutralFrac = 0.12, photonFrac = 0.12,
    opacity = 0.88, curve = 1.0,
  } = opts;
  const SEG = 14;
  let s = '';
  for (let i = 0; i < count; i++) {
    const u = rand();
    const kind = u < muonFrac ? 'muon'
      : u < muonFrac + neutralFrac ? 'neutral'
        : u < muonFrac + neutralFrac + photonFrac ? 'photon' : 'charged';
    const a0 = rand() * Math.PI * 2;
    /* A photon stops in the electromagnetic calorimeter, which is why it is
       the short one; a muon is the only thing that reaches the far rim. */
    const len = kind === 'muon' ? rMax
      : kind === 'photon' ? rMax * (0.3 + rand() * 0.16)
        : rMax * (0.45 + rand() * 0.5);
    const k = kind === 'charged' ? (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 1.6) * curve / rMax : 0;
    const step = len / SEG;
    let a = a0, x = C, y = C, d = `M ${n(x)} ${n(y)}`;
    for (let sgm = 0; sgm < SEG; sgm++) {
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      a += k * step;
      d += ` L ${n(x)} ${n(y)}`;
    }
    s += `<path d="${d}" fill="none" stroke="${TRACK[kind]}" stroke-width="${width}"`
      + ` stroke-opacity="${opacity}" stroke-linecap="round"/>`;
  }
  return s;
}

/* The one the page is about carries a brighter line, which is the only
   emphasis it needs now that it is also the bigger pin. */
const doc = (id, title, body, main) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" role="img" aria-label="${title}">`
  + `<title>${title}</title>`
  + `<defs><clipPath id="${id}"><circle cx="${C}" cy="${C}" r="${n(RIM_R)}"/></clipPath></defs>`
  + `<circle cx="${C}" cy="${C}" r="${n(RIM_R)}" fill="${BODY}"/>`
  + `<g clip-path="url(#${id})">${body}</g>`
  + `<circle cx="${C}" cy="${C}" r="${n(RIM_R - 0.7)}" fill="none" stroke="${RIM}"`
  + ` stroke-width="${main ? 2.0 : 1.4}" stroke-opacity="${main ? 1 : 0.75}"/>`
  + `</svg>`;

const vertex = (r) => `<circle cx="${C}" cy="${C}" r="${n(r)}" fill="#ffffff"/>`
  + `<circle cx="${C}" cy="${C}" r="${n(r * 2.1)}" fill="${BEAM}" fill-opacity="0.45"/>`;

/* ------------------------------------------------------------------
   ATLAS — eight barrel toroids in open air, and nothing else looks like it
   ------------------------------------------------------------------ */
function atlas() {
  const S = RIM_R / 11.0;
  const m = (v) => v * S;
  const rand = rng(0x0a71a5);
  let s = '';

  /* Muon spectrometer: three stations of chambers in the air between the
     coils, which is where they hang in the cavern. */
  s += chambers(16, m(6.0), m(1.05), m(0.16), Math.PI / 16, `fill="${FAINT}"`);
  s += chambers(16, m(8.0), m(1.15), m(0.16), Math.PI / 16, `fill="${FAINT}"`);
  s += chambers(16, m(10.4), m(1.3), m(0.18), Math.PI / 16, `fill="${SOFT}" fill-opacity="0.55"`);

  /* Tracks: through the calorimeters and out into the muon system. */
  s += tracksRadial(rand, 11, m(10.6), { width: 1.5, opacity: 0.92, curve: 1.1 });

  /* The barrel toroid: eight coils, radially long, azimuthally thin. */
  const r0 = m(4.7), r1 = m(10.05), hw = m(0.62);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const ca = Math.cos(a), sa = Math.sin(a);
    const p = (r, sx) => `${n(C + ca * r - sa * sx)},${n(C + sa * r + ca * sx)}`;
    s += `<polygon points="${p(r0, hw)} ${p(r1, hw)} ${p(r1, -hw)} ${p(r0, -hw)}"`
      + ` fill="${WARM}" fill-opacity="0.95" rx="1"/>`;
  }

  /* Tile calorimeter, LAr EM calorimeter, inner detector. */
  s += annulus(m(2.28), m(4.25), `fill="${STRUCT}" fill-opacity="0.2"`);
  s += spokes(16, m(2.28), m(4.25), 0, `stroke="${STRUCT}" stroke-width="0.7" stroke-opacity="0.35"`);
  s += circle(m(4.25), `fill="none" stroke="${STRUCT}" stroke-width="1.5" stroke-opacity="0.75"`);
  s += annulus(m(1.5), m(2.0), `fill="${SOFT}" fill-opacity="0.65"`);
  s += circle(m(1.15), `fill="none" stroke="${SOFT}" stroke-width="1.2"`);
  s += vertex(1.5);
  return doc('a', 'ATLAS: transverse section, eight barrel toroid coils around the calorimeters', s, true);
}

/* ------------------------------------------------------------------
   CMS — one huge solenoid and the twelve-sided yoke that returns it
   ------------------------------------------------------------------ */
function cms() {
  const S = RIM_R / 7.4;
  const m = (v) => v * S;
  const rand = rng(0x0c3151);
  const rot = Math.PI / 12;
  let s = '';

  /* Return yoke: 12,500 tonnes of steel in twelve sides, with the muon
     chambers in the gaps between its layers. */
  s += polygon(12, m(7.4), rot, `fill="${STRUCT}" fill-opacity="0.14"`);
  s += polygon(12, m(3.95), rot, `fill="${BODY}"`);
  for (const r of [4.55, 5.55, 6.55]) {
    s += polygon(12, m(r), rot, `fill="none" stroke="${SOFT}" stroke-width="1.1" stroke-opacity="0.5"`);
  }
  s += polygon(12, m(7.4), rot, `fill="none" stroke="${STRUCT}" stroke-width="1.6" stroke-opacity="0.8"`);

  s += tracksRadial(rand, 10, m(7.0), { width: 1.5, opacity: 0.92, curve: 1.3 });

  /* The solenoid: 3.8 T through a 6 m bore, the reason the yoke is that big
     and the boldest thing in the figure. */
  s += annulus(m(2.95), m(3.8), `fill="${WARM}" fill-opacity="0.95"`);

  /* HCAL, ECAL, tracker. */
  s += annulus(m(1.77), m(2.95), `fill="${STRUCT}" fill-opacity="0.22"`);
  s += spokes(18, m(1.77), m(2.95), 0, `stroke="${STRUCT}" stroke-width="0.6" stroke-opacity="0.3"`);
  s += annulus(m(1.29), m(1.75), `fill="${SOFT}" fill-opacity="0.7"`);
  s += circle(m(1.1), `fill="none" stroke="${SOFT}" stroke-width="1.2"`);
  s += vertex(1.5);
  return doc('c', 'CMS: transverse section, the solenoid inside its twelve-sided return yoke', s);
}

/* ------------------------------------------------------------------
   ALICE — the largest TPC ever built, inside the L3 octagon
   ------------------------------------------------------------------ */
function alice() {
  const S = RIM_R / 5.9;
  const m = (v) => v * S;
  const rand = rng(0x0a11ce);
  let s = '';

  /* The L3 magnet, inherited from LEP: an octagonal red yoke, 0.5 T, and the
     reason ALICE's silhouette has eight flat sides. */
  s += polygon(8, m(5.9), Math.PI / 8, `fill="${WARM}" fill-opacity="0.95"`);
  s += polygon(8, m(5.0), Math.PI / 8, `fill="${BODY}"`);

  /* A lead-lead event is thousands of tracks; the figure says so with
     forty, which at this size is already a thicket. This is the one thing
     ALICE is for and the one figure in the set that should look crowded. */
  s += tracksRadial(rand, 40, m(4.6), { width: 1.05, opacity: 0.8, curve: 1.5,
    muonFrac: 0.05, neutralFrac: 0.26, photonFrac: 0.16 });

  /* TOF and TRD. */
  s += annulus(m(2.9), m(3.99), `fill="${STRUCT}" fill-opacity="0.18"`);
  s += circle(m(3.99), `fill="none" stroke="${STRUCT}" stroke-width="1.3" stroke-opacity="0.7"`);
  s += spokes(18, m(2.9), m(3.99), Math.PI / 18, `stroke="${STRUCT}" stroke-width="0.6" stroke-opacity="0.28"`);

  /* The TPC: 88 cubic metres of gas read out through eighteen sectors either
     side of the central electrode. */
  s += annulus(m(0.85), m(2.5), `fill="${SOFT}" fill-opacity="0.16"`);
  s += spokes(12, m(0.85), m(2.5), Math.PI / 12, `stroke="${SOFT}" stroke-width="0.8" stroke-opacity="0.6"`);
  s += circle(m(2.5), `fill="none" stroke="${STRUCT}" stroke-width="1.3" stroke-opacity="0.8"`);
  s += circle(m(0.85), `fill="none" stroke="${SOFT}" stroke-width="1"`);
  s += vertex(1.4);
  return doc('l', 'ALICE: transverse section, the TPC inside the octagonal L3 magnet', s);
}

/* ------------------------------------------------------------------
   LHCb — not a barrel at all: a spectrometer looking one way
   ------------------------------------------------------------------ */
function lhcb() {
  /* Side view through a porthole. z along the beam, 0 at the crossing near
     the left of the circle; y vertical. Three of these four experiments
     surround the collision and this one stands beside it, because the b
     hadrons it is after are thrown forward. */
  const Z0 = -1.5, Z1 = 20.5, YMAX = 8.0;
  const W = 2 * RIM_R, H = W * (2 * YMAX) / (Z1 - Z0);
  const x = (z) => n(C - W / 2 + ((z - Z0) / (Z1 - Z0)) * W);
  const y = (v) => n(C - (v / YMAX) * (H / 2));
  const sc = W / (Z1 - Z0);
  const rand = rng(0x1cb00b);
  let s = '';

  /* The acceptance: 10 to 250 mrad, the wedge everything else is built to
     fill. */
  const zEnd = 20.5;
  s += `<path d="M ${x(0)} ${y(0)} L ${x(zEnd)} ${y(zEnd * 0.25)} L ${x(zEnd)} ${y(-zEnd * 0.25)} Z"`
    + ` fill="${BEAM}" fill-opacity="0.1"/>`;

  /* Tracks: out of the crossing, into the acceptance, kinked where the
     dipole bends them, which is how the momentum is measured at all. */
  for (let i = 0; i < 9; i++) {
    const slope = (rand() * 2 - 1) * 0.23;
    const kick = (rand() * 2 - 1) * 0.1;
    const kind = rand() < 0.2 ? 'muon' : 'charged';
    const zMag = 6.0, zOut = kind === 'muon' ? 20.3 : 12 + rand() * 8;
    const yMag = slope * zMag;
    const yOut = yMag + (slope + kick) * (zOut - zMag);
    s += `<path d="M ${x(0)} ${y(0)} L ${x(zMag)} ${y(yMag)} L ${x(zOut)} ${y(yOut)}"`
      + ` fill="none" stroke="${TRACK[kind]}" stroke-width="1.45" stroke-opacity="0.92"`
      + ` stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  /* The dipole: 4 Tm across z = 4-8 m, the only warm shape here. */
  s += `<path d="M ${x(4.0)} ${y(2.4)} L ${x(8.0)} ${y(3.6)} L ${x(8.0)} ${y(-3.6)} L ${x(4.0)} ${y(-2.4)} Z"`
    + ` fill="${WARM}" fill-opacity="0.92"/>`;

  /* The stations along the beam, each as tall as the acceptance reaches at
     its own z. */
  const plate = (z, hw, fill, op) => {
    const hh = Math.max(0.9, z * 0.25 + 0.6);
    s += `<rect x="${x(z - hw)}" y="${y(hh)}" width="${n(2 * hw * sc)}"`
      + ` height="${n(y(-hh) - y(hh))}" fill="${fill}" fill-opacity="${op}" rx="0.5"/>`;
  };
  plate(2.0, 0.62, STRUCT, 0.16);     /* RICH1 */
  plate(2.8, 0.15, SOFT, 0.9);        /* TT */
  plate(8.6, 0.15, SOFT, 0.9);        /* T1 */
  plate(9.3, 0.15, SOFT, 0.9);        /* T2 */
  plate(10.0, 0.15, SOFT, 0.9);       /* T3 */
  plate(11.4, 0.8, STRUCT, 0.16);     /* RICH2 */
  plate(13.0, 0.18, SOFT, 0.9);       /* M1 */
  plate(13.9, 0.38, STRUCT, 0.55);    /* ECAL */
  plate(15.0, 0.55, STRUCT, 0.4);     /* HCAL */
  plate(16.3, 0.18, SOFT, 0.9);       /* M2 */
  plate(17.4, 0.18, SOFT, 0.9);       /* M3 */
  plate(18.5, 0.18, SOFT, 0.9);       /* M4 */
  plate(19.6, 0.18, SOFT, 0.9);       /* M5 */

  /* The beam line, and the VELO sitting on it 8 mm from the protons. */
  s += `<line x1="${x(Z0)}" y1="${y(0)}" x2="${x(Z1)}" y2="${y(0)}"`
    + ` stroke="${FAINT}" stroke-width="0.9"/>`;
  s += `<rect x="${x(-0.5)}" y="${y(1.15)}" width="${n(1.6 * sc)}" height="${n(y(-1.15) - y(1.15))}"`
    + ` fill="${STRUCT}" fill-opacity="0.75" rx="0.6"/>`;
  s += `<circle cx="${x(0.3)}" cy="${y(0)}" r="2.6" fill="${BEAM}" fill-opacity="0.45"/>`;
  s += `<circle cx="${x(0.3)}" cy="${y(0)}" r="1.3" fill="#ffffff"/>`;
  return doc('b', 'LHCb: side view, the forward spectrometer along the beam with its dipole magnet', s);
}

const FIGS = {
  'atlas-figure.svg': atlas(),
  'cms-figure.svg': cms(),
  'alice-figure.svg': alice(),
  'lhcb-figure.svg': lhcb(),
};

for (const [name, svg] of Object.entries(FIGS)) {
  if (svg.includes('undefined') || svg.includes('NaN')) throw new Error(name + ' has a hole in it');
  fs.writeFileSync(path.join(OUT, name), svg);
  console.log('escrito assets/images/cern/experiments/' + name, (svg.length / 1024).toFixed(1) + ' KB');
}
