/* The ground above the ring, from real lines
   ------------------------------------------------------------------
   The hero of the CERN page draws the LHC under the Meyrin countryside, and
   the countryside is not invented: the France–Switzerland border and the
   watercourses come from OpenStreetMap, fetched once by this tool and
   committed as data/meyrin-map.json. © OpenStreetMap contributors, ODbL —
   credited in credits.html.

   The LHC circle itself is placed at its real position: centre near
   46.271 N, 6.055 E, radius 4.243 km (26.659 km of circumference), which is
   why the border crosses the ring on the figure the way it does on the
   published maps.

   Run:  node tools/build-meyrin-map.js     (network: overpass-api.de)
*/

const fs = require('fs');
const path = require('path');
const https = require('https');

const OUT = path.join(__dirname, '..', 'data', 'meyrin-map.json');

/* The window around the ring. Generous to the north on purpose: the figure
   tilts the ground away from the reader, so the top of the canvas holds
   about sixteen kilometres of countryside where the bottom holds five, and
   the data has to reach at least as far as the frame can see. */
const BBOX = { s: 46.13, w: 5.87, n: 46.43, e: 6.24 };

/* LHC centre and radius. Circumference 26,659 m -> r = C / 2π = 4,243 m. */
const RING = { lat: 46.271, lon: 6.055, r_m: 4243 };

const QUERY = `
[out:json][timeout:60];
(
  way["boundary"="administrative"]["admin_level"="2"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["waterway"="river"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["waterway"="stream"]["name"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out geom tags;
`;

/* Mirrors, tried in order: the main instance rate-limits freely. */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function overpassAt(url, query) {
  const body = 'data=' + encodeURIComponent(query);
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'nipscern.com site build (contact via nipscern.com)',
      },
    }, (res) => {
      let s = '';
      res.on('data', (c) => { s += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) reject(new Error('HTTP ' + res.statusCode + ': ' + s.slice(0, 200)));
        else resolve(JSON.parse(s));
      });
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function overpass(query) {
  let last;
  for (const url of ENDPOINTS) {
    try { return await overpassAt(url, query); }
    catch (e) { last = e; console.log('  (' + url.split('/')[2] + ': ' + e.message.slice(0, 60) + ')'); }
  }
  throw last;
}

/* Equirectangular around the ring centre, in metres: good to well under a
   metre across a 25 km window at this latitude, which is far below the width
   of the stroke it will be drawn with. */
const M_PER_DEG_LAT = 111320;
const mPerDegLon = M_PER_DEG_LAT * Math.cos(RING.lat * Math.PI / 180);
const toXY = (lat, lon) => [
  Math.round((lon - RING.lon) * mPerDegLon),
  Math.round((lat - RING.lat) * M_PER_DEG_LAT),
];

/* Douglas–Peucker, so a stream drawn with thousands of nodes ships with the
   dozens that shape it. Tolerance in metres. */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = (v) => v * v;
  const d2 = (p, a, b) => {
    const L2 = sq(b[0] - a[0]) + sq(b[1] - a[1]);
    if (!L2) return sq(p[0] - a[0]) + sq(p[1] - a[1]);
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / L2;
    t = Math.max(0, Math.min(1, t));
    return sq(p[0] - a[0] - t * (b[0] - a[0])) + sq(p[1] - a[1] - t * (b[1] - a[1]));
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = d2(pts[i], pts[a], pts[b]);
      if (d > best) { best = d; idx = i; }
    }
    if (idx > 0 && best > tol * tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

(async () => {
  const res = await overpass(QUERY);
  const border = [], rivers = [], streams = [];
  for (const el of res.elements) {
    if (!el.geometry) continue;
    const pts = simplify(el.geometry.map((g) => toXY(g.lat, g.lon)), 60);
    if (pts.length < 2) continue;
    if (el.tags && el.tags.boundary === 'administrative') border.push(pts);
    else if (el.tags && el.tags.waterway === 'river') rivers.push(pts);
    else streams.push(pts);
  }

  const count = (a) => a.reduce((n, p) => n + p.length, 0);
  const data = {
    source: '© OpenStreetMap contributors, ODbL. overpass-api.de, fetched ' + new Date().toISOString().slice(0, 10),
    bbox_m: {
      w: Math.round((BBOX.w - RING.lon) * mPerDegLon),
      e: Math.round((BBOX.e - RING.lon) * mPerDegLon),
      s: Math.round((BBOX.s - RING.lat) * M_PER_DEG_LAT),
      n: Math.round((BBOX.n - RING.lat) * M_PER_DEG_LAT),
    },
    ring_r_m: RING.r_m,
    /* Where to write FRANCE and SUISSE: inside the window, either side of the
       border as it runs past the ring. Chosen from the map, in metres. */
    labels: { fr: [-6500, 3600], ch: [5200, -4400] },
    border,
    rivers,
    streams,
  };

  fs.writeFileSync(OUT, JSON.stringify(data));
  console.log('escrito data/meyrin-map.json ', (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
  console.log('  border:', border.length, 'ways,', count(border), 'pts');
  console.log('  rivers:', rivers.length, 'ways,', count(rivers), 'pts');
  console.log('  streams:', streams.length, 'ways,', count(streams), 'pts');
})();
