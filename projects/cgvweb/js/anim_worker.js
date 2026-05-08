// Off-main-thread loading screen animation — OffscreenCanvas + Web Worker.
//
// WHY A WORKER: Vanta TRUNK (p5.js) runs its RAF on the main thread. When
// GLTFLoader.parse() blocks the main thread, Vanta's RAF stalls and the
// animation freezes. This worker schedules its own RAF independently — it
// keeps running at 60 fps even while the main thread is completely stalled.
//
// ALGORITHM: branching trunks grow from seed points, taper linearly, drift
// with per-archetype chaos, and spawn children probabilistically. Twelve
// archetypes give variety: spirals, bursts, creepers, starbursts, wild.
// Bifurcation (Y-splits) adds realism. A soft glow pass on main trunks adds
// depth. The canvas is slowly cleared each frame so old strokes persist as
// long-lived wood-grain trails.
//
// Message API:
//   { type: 'init',   canvas: OffscreenCanvas }
//   { type: 'resize', w: number, h: number    }
//   { type: 'stop'                             }

'use strict';

let canvas, ctx, W, H, rafId;

const BG          = '#0e1014';  // --bg
const TRAIL_ALPHA = 0.016;      // slow fade → long wood-grain trails
const MAX_TREES   = 22;         // concurrent trunk-tree systems

// ── Colour palette ──────────────────────────────────────────────────────────
// Variations around --accent #6398ff.  Base colour is weighted 4× so it
// dominates; rare tints add occasional depth without breaking the theme.
const PALETTES = [
  [99,  152, 255],  // base accent  ×4
  [99,  152, 255],
  [99,  152, 255],
  [99,  152, 255],
  [118, 168, 255],  // lighter blue
  [80,  130, 255],  // deeper blue
  [99,  195, 255],  // cyan tint   (rare)
  [128, 118, 255],  // lavender    (rare)
];

// ── Archetypes ───────────────────────────────────────────────────────────────
// Each archetype is a distinct growth personality.
//
//  chaos    – max random heading drift per step
//  branchP  – probability of spawning a child each step
//  speed    – base speed multiplier
//  maxDepth – maximum branching generations
//  taper    – width lost per step
//  spokes   – trunks started simultaneously from the seed point
//  bias     – constant heading drift (positive → CW spiral, negative → CCW)
//
// Weights: standard appears 3×, everything else once.
const ARCHETYPES = [
  // ── Standard (x3) ───────────────────────────────────────────────────────
  { chaos:0.10, branchP:0.018, speed:1.0,  maxDepth:5, taper:0.007, spokes:1, bias: 0      },
  { chaos:0.10, branchP:0.018, speed:1.0,  maxDepth:5, taper:0.007, spokes:1, bias: 0      },
  { chaos:0.10, branchP:0.018, speed:1.0,  maxDepth:5, taper:0.007, spokes:1, bias: 0      },
  // ── Wild — high chaos, branches everywhere ───────────────────────────────
  { chaos:0.24, branchP:0.032, speed:1.4,  maxDepth:4, taper:0.009, spokes:1, bias: 0      },
  // ── Gentle creeper — slow, very deep, long-lived ────────────────────────
  { chaos:0.04, branchP:0.009, speed:0.60, maxDepth:8, taper:0.004, spokes:1, bias: 0      },
  // ── Triple spoke — three trunks from one seed ────────────────────────────
  { chaos:0.12, branchP:0.022, speed:1.1,  maxDepth:4, taper:0.008, spokes:3, bias: 0      },
  // ── Pentagram — five spokes, low chaos so arms stay elegant ─────────────
  { chaos:0.09, branchP:0.045, speed:1.25, maxDepth:3, taper:0.010, spokes:5, bias: 0      },
  // ── Starburst — seven spokes, fast, shallow ──────────────────────────────
  { chaos:0.14, branchP:0.060, speed:1.7,  maxDepth:2, taper:0.013, spokes:7, bias: 0      },
  // ── CW spiral ────────────────────────────────────────────────────────────
  { chaos:0.06, branchP:0.013, speed:0.85, maxDepth:6, taper:0.005, spokes:1, bias: 0.014  },
  // ── CCW spiral ───────────────────────────────────────────────────────────
  { chaos:0.06, branchP:0.013, speed:0.85, maxDepth:6, taper:0.005, spokes:1, bias:-0.014  },
  // ── Fast streaker — covers the whole screen quickly ──────────────────────
  { chaos:0.08, branchP:0.020, speed:2.4,  maxDepth:4, taper:0.011, spokes:1, bias: 0      },
  // ── Deep creeper — ultra-slow, maximal depth, hairline branches ──────────
  { chaos:0.05, branchP:0.007, speed:0.45, maxDepth:9, taper:0.003, spokes:1, bias: 0      },
];

// ── Trunk ────────────────────────────────────────────────────────────────────
// A single growing line segment. Steps one unit per frame; probabilistically
// spawns children via `spawnCb` (so TrunkTree can own the flat pool).
// Supports bifurcation: on ~35% of branch events the parent terminates and
// two children continue from the split point, creating realistic Y-splits.

class Trunk {
  constructor(x, y, angle, width, depth, arch, r, g, b) {
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.angle  = angle;
    this.width  = width;
    this.depth  = depth;
    this.arch   = arch;
    this.r = r; this.g = g; this.b = b;
    this.speed  = (0.85 + Math.random() * 1.05) * arch.speed;
    this.age    = 0;
    // Deeper branches live shorter lives so tips don't outlast their trunk
    this.maxAge = Math.max(35, ((160 + (Math.random() * 260) | 0) / (1 + depth * 0.65)));
    this.dead   = false;
  }

  step(spawnCb) {
    if (this.dead) return;
    this.px = this.x; this.py = this.y;

    // Chaos drift + optional spiral bias
    this.angle += (Math.random() - 0.5) * this.arch.chaos * 2 + this.arch.bias;

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.age++;
    this.width = Math.max(0.1, this.width - this.arch.taper);

    // Branch spawn
    if (Math.random() < this.arch.branchP && this.depth < this.arch.maxDepth && this.width > 0.42) {
      const sign = Math.random() > 0.5 ? 1 : -1;
      // Side branch — always spawned
      spawnCb(new Trunk(
        this.x, this.y,
        this.angle + sign * (0.26 + Math.random() * 0.62),
        this.width * 0.64, this.depth + 1, this.arch, this.r, this.g, this.b
      ));
      // Bifurcation (35%) — spawn a near-continuation too, terminate self
      if (Math.random() < 0.35 && this.depth < this.arch.maxDepth - 1) {
        spawnCb(new Trunk(
          this.x, this.y,
          this.angle + (Math.random() - 0.5) * 0.20,
          this.width * 0.78, this.depth + 1, this.arch, this.r, this.g, this.b
        ));
        this.dead = true;
        return;
      }
    }

    if (this.age >= this.maxAge || this.width <= 0.1 ||
        this.x < -80 || this.x > W + 80 || this.y < -80 || this.y > H + 80) {
      this.dead = true;
    }
  }

  draw() {
    if (this.dead || this.age === 0) return;
    const alpha = (0.80 - this.depth * 0.085) * (1 - (this.age / this.maxAge) * 0.32);
    if (alpha <= 0.008) return;
    const { r, g, b } = this;

    // Soft glow halo on main trunks (depth 0–1) when still thick
    if (this.depth <= 1 && this.width > 1.1) {
      ctx.beginPath();
      ctx.moveTo(this.px, this.py); ctx.lineTo(this.x, this.y);
      ctx.lineWidth   = this.width * 3.0;
      ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.07).toFixed(3)})`;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(this.px, this.py); ctx.lineTo(this.x, this.y);
    ctx.lineWidth   = this.width;
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
    ctx.stroke();
  }
}

// ── TrunkTree ────────────────────────────────────────────────────────────────
// Manages a flat pool of Trunk objects sharing one seed point and archetype.
// Children are appended to the same array; dead entries are pruned lazily
// once the pool grows large to keep iteration fast.

class TrunkTree {
  constructor() {
    const arch = ARCHETYPES[(Math.random() * ARCHETYPES.length) | 0];
    const [r, g, b] = PALETTES[(Math.random() * PALETTES.length) | 0];

    // Seed position: interior-biased (25% edge) to match Vanta spacing:0
    let x, y, baseAngle;
    if (Math.random() < 0.25) {
      const edge = (Math.random() * 4) | 0;
      const sp   = Math.PI * 0.55;
      if      (edge === 0) { x = Math.random()*W; y = -2;   baseAngle = Math.PI*0.5 + (Math.random()-0.5)*sp; }
      else if (edge === 1) { x = W+2; y = Math.random()*H;  baseAngle = Math.PI     + (Math.random()-0.5)*sp; }
      else if (edge === 2) { x = Math.random()*W; y = H+2;  baseAngle = Math.PI*1.5 + (Math.random()-0.5)*sp; }
      else                 { x = -2; y = Math.random()*H;   baseAngle =                (Math.random()-0.5)*sp; }
    } else {
      x = Math.random() * W;
      y = Math.random() * H;
      baseAngle = Math.random() * Math.PI * 2;
    }

    // Width divided by √spokes so multi-spoke trees look proportional
    const baseW = (2.0 + Math.random() * 2.8) / Math.sqrt(arch.spokes);
    this.trunks = [];
    for (let s = 0; s < arch.spokes; s++) {
      const angle = arch.spokes === 1
        ? baseAngle
        : baseAngle + (Math.PI * 2 * s / arch.spokes) + (Math.random() - 0.5) * 0.38;
      this.trunks.push(new Trunk(x, y, angle, baseW, 0, arch, r, g, b));
    }
    this.dead = false;
  }

  step() {
    const spawn = [];
    for (const t of this.trunks) if (!t.dead) t.step(c => spawn.push(c));
    if (spawn.length) this.trunks.push(...spawn);
    // Lazy prune — only when the pool is large enough to be worth it
    if (this.trunks.length > 160) this.trunks = this.trunks.filter(t => !t.dead);
    this.dead = !this.trunks.length || this.trunks.every(t => t.dead);
  }

  draw() { for (const t of this.trunks) t.draw(); }
}

// ── Tree pool ────────────────────────────────────────────────────────────────
const trees = [];
function addTree() { trees.push(new TrunkTree()); }
function initTrees() {
  trees.length = 0;
  for (let i = 0; i < MAX_TREES; i++) addTree();
}

// ── Frame (shared by pre-warm and RAF tick) ──────────────────────────────────
function frame() {
  ctx.fillStyle   = BG;
  ctx.globalAlpha = TRAIL_ALPHA;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  for (let i = trees.length - 1; i >= 0; i--) {
    trees[i].step();
    trees[i].draw();
    if (trees[i].dead) trees.splice(i, 1);
  }
  while (trees.length < MAX_TREES) addTree();
}

function tick() { frame(); rafId = requestAnimationFrame(tick); }

// ── Message handler ──────────────────────────────────────────────────────────
self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'init':
      canvas = data.canvas;
      W = canvas.width; H = canvas.height;
      ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      initTrees();
      // Pre-warm: run frames synchronously (worker thread only, not main thread)
      // so the canvas is already filled when the first painted frame appears.
      for (let i = 0; i < 90; i++) frame();
      rafId = requestAnimationFrame(tick);
      break;

    case 'resize':
      W = canvas.width  = data.w;
      H = canvas.height = data.h;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      initTrees();
      break;

    case 'stop':
      cancelAnimationFrame(rafId);
      break;
  }
};
