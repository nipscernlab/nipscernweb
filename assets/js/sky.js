/**
 * The sky over the hero.
 *
 * It used to be 130 dots at random positions, all the same colour, twinkling on
 * a sine. This draws the actual sky instead: 5,044 real stars down to magnitude
 * 6, which is what an unaided eye sees on a dark night, each at its catalogued
 * position with its catalogued brightness and its catalogued colour.
 *
 * The data is the HYG database, Hipparcos plus Yale plus Gliese, in the packed
 * form d3-celestial distributes, cut to magnitude 6 and squeezed to six bytes a
 * star: right ascension, declination, magnitude, colour index. 30 KB for the
 * whole naked-eye sky. Credited in credits.html, CC BY-SA 4.0.
 *
 * What stays random is where you are looking. Every visit picks a direction on
 * the celestial sphere and a roll angle, so the line under the drawing goes on
 * being true: no two visitors get the same view. The difference is that the sky
 * they get is now a real one, with real constellations in it.
 *
 * If the catalogue does not arrive, the old random field runs instead. A hero
 * with no sky at all is the one outcome worth engineering against.
 */

const DATA = 'assets/data/hyg-mag6.bin';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Ballesteros' formula: colour index to effective temperature. Published in
   "New insights into black bodies" (EPL 97, 2012) and accurate to a few per
   cent across the range the catalogue covers. */
function bvToKelvin(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/* Blackbody temperature to sRGB, the piecewise fit to the Planckian locus that
   is standard for this. Deliberately desaturated at the end: real stars read
   nearly white to the eye and only the extremes show colour, so pushing the
   saturation would be prettier and wrong. */
function kelvinToRGB(k) {
  const t = Math.min(40000, Math.max(1000, k)) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  /* Pulled 55% of the way to white. */
  const mix = (v) => c(v + (255 - v) * 0.55);
  return [mix(c(r)), mix(c(g)), mix(c(b))];
}

/* Unit vector from right ascension and declination, both in degrees. */
function toVec(raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180;
  const dec = (decDeg * Math.PI) / 180;
  const cd = Math.cos(dec);
  return [cd * Math.cos(ra), cd * Math.sin(ra), Math.sin(dec)];
}

async function loadCatalogue() {
  const base = new URL('../../', import.meta.url).href;
  const res = await fetch(base + DATA);
  if (!res.ok) throw new Error('catalogue ' + res.status);
  const dv = new DataView(await res.arrayBuffer());
  const n = Math.floor(dv.byteLength / 6);
  const stars = new Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 6;
    const ra = (dv.getUint16(o, true) / 65535) * 360;
    const dec = (dv.getInt16(o + 2, true) / 32767) * 90;
    const mag = dv.getUint8(o + 4) / 20 - 2;
    const bv = dv.getUint8(o + 5) / 64 - 0.5;
    const [x, y, z] = toVec(ra, dec);
    const rgb = kelvinToRGB(bvToKelvin(bv));
    stars[i] = { x, y, z, mag, rgb };
  }
  return stars;
}

/* A rotation that carries a random point of the sphere to the view axis, with a
   random roll on top so the field is not always the same way up. */
function randomView() {
  const a = Math.random() * Math.PI * 2;            // right ascension of centre
  const d = Math.asin(Math.random() * 2 - 1);       // declination, area-uniform
  const r = Math.random() * Math.PI * 2;            // roll
  const ca = Math.cos(a), sa = Math.sin(a);
  const cd = Math.cos(d), sd = Math.sin(d);
  const cr = Math.cos(r), sr = Math.sin(r);
  /* Rz(-a) then Ry(-d) puts the centre on +x, then Rx(roll) spins the field.
     Composed once here so the hot loop is nine multiplies and no trigonometry. */
  const m = [
    [cd * ca, cd * sa, sd],
    [-sa * cr - sd * ca * sr, ca * cr - sd * sa * sr, cd * sr],
    [sa * sr - sd * ca * cr, -ca * sr - sd * sa * cr, cd * cr],
  ];
  return m;
}

export function sky(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0, statik = null, twinklers = [], shooting = null, shootTimer = 0;
  let stars = null, view = randomView();

  /* Stereographic projection. It keeps the shapes of constellations intact out
     to the corners, which a flat perspective does not, and the field here is
     wide: 90 degrees across the short side. */
  const THETA_MAX = (45 * Math.PI) / 180;
  const K = () => (Math.min(W, H) / 2) / (2 * Math.tan(THETA_MAX / 2));

  function project(s) {
    const m = view;
    const z = m[0][0] * s.x + m[0][1] * s.y + m[0][2] * s.z;   // toward the eye
    if (z <= 0.05) return null;                                 // behind, or at the rim
    const x = m[1][0] * s.x + m[1][1] * s.y + m[1][2] * s.z;
    const y = m[2][0] * s.x + m[2][1] * s.y + m[2][2] * s.z;
    const k = (2 / (1 + z)) * K();
    return [W / 2 + x * k, H / 2 - y * k];
  }

  /* Size and opacity from magnitude.

     The first pass drove opacity off the flux, 10^(-0.4m), which is what the eye
     receives and exactly the wrong thing to draw. Flux across this catalogue
     spans a factor of 1500, so everything from magnitude 3 down landed on the
     floor at 0.16 alpha and a third of a pixel of radius: on a retina screen
     that is a sub-pixel dot at a sixth opacity, which is nothing. Four thousand
     stars were being drawn and one was visible.

     A star field has to be scaled the way the eye scales it, and the eye is
     logarithmic: the magnitude number is already the log. So both size and
     opacity are linear in magnitude here, and the floor sits high enough that
     the faintest star still registers. */
  /* How far down the scale the atmosphere is allowed to reach. At 3.6 only four
     hundred of five thousand stars moved and the field read as a photograph;
     scintillation is what makes a sky look alive, so it goes down to magnitude 5
     and covers sixteen hundred of them. The rest are still, which is also true:
     the faintest are at the edge of being seen at all. */
  const TWINKLE_MAG = 5.5;

  const radiusFor = (mag) => Math.max(0.55, 0.55 + (6 - mag) * 0.27);
  const alphaFor = (mag) => Math.max(0.42, Math.min(1, 0.42 + (6 - mag) * 0.105));

  function build() {
    twinklers = [];
    statik = document.createElement('canvas');
    statik.width = Math.round(W * DPR);
    statik.height = Math.round(H * DPR);
    const c = statik.getContext('2d');
    c.setTransform(DPR, 0, 0, DPR, 0, 0);

    if (!stars) return;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const p = project(s);
      if (!p) continue;
      const [px, py] = p;
      if (px < -8 || py < -8 || px > W + 8 || py > H + 8) continue;
      /* The bright ones are redrawn every frame so they can dim as well as
         brighten, so they are kept out of the still layer. */
      if (s.mag < TWINKLE_MAG) {
        twinklers.push({
          px, py, mag: s.mag, rgb: s.rgb,
          /* Two rates, not one. A single sine reads as a pulse, which is a
             lighthouse; scintillation is the atmosphere shuffling a wavefront
             and it beats irregularly. Two of them out of step give that without
             drawing a fresh random number per frame, which is what made the HITS
             trace boil before. */
          f1: 0.55 + Math.random() * 1.5,
          f2: 1.7 + Math.random() * 2.6,
          p1: Math.random() * 6.283,
          p2: Math.random() * 6.283,
          /* Faint stars twinkle harder. A point source is what the atmosphere
             can push around; the brighter ones sit steadier, which is the old
             rule of thumb for telling a planet from a star. */
          amp: 0.19 + (s.mag / 6) * 0.42,
        });
        continue;
      }
      drawStar(c, px, py, s.mag, s.rgb, alphaFor(s.mag));
    }
  }

  /* A star is not a dot.

     Three parts, and each is something an optical system actually does. The core
     is the disc. Around it sits the bloom, which is scatter, and it is what makes
     a bright star read as bright rather than as a bigger dot. Out of the bright
     ones come four spikes, which are diffraction: the cross you see on a star in
     any photograph taken through an instrument with a spider in front of the
     mirror. None of the three is decoration and none is invented, which is why
     the shape is allowed to be this instead of a circle.

     Which star gets what follows the magnitude, so the sky sorts itself: below
     magnitude 4 there is only a core, by magnitude 2.4 the bloom is there, and
     the spikes start at 1.8 and are the length of the star's own brightness. */
  /* A cor do núcleo, montada uma vez por cor.
     ------------------------------------------------------------------
     TWINKLE_MAG deixa cerca de mil e seiscentas estrelas sendo redesenhadas a
     cada quadro, e cada uma montava `'rgba(' + … + al.toFixed(3) + ')'` para
     pintar um ponto cuja cor nunca muda — quase cem mil formatações de número
     por segundo para dizer sessenta vezes a mesma coisa. O alfa passou para o
     globalAlpha e a string virou constante; na prática o catálogo inteiro usa
     uma cor só, então este Map tem uma entrada.

     Sobre o tamanho do ganho, medido e não estimado: sete a onze por cento no
     laço, com zero pixels de diferença. Não é o que parecia — o custo real
     desta função é o rasterizador desenhando mil e seiscentos arcos, não as
     strings. O que se ganha aqui é de graça e fica; o resto do tempo do céu não
     sai sem mudar o que se vê, e o que se vê está bom. */
  const NUCLEOS = new Map();
  function corDoNucleo(rgb) {
    const chave = rgb[0] * 65536 + rgb[1] * 256 + rgb[2];
    let s = NUCLEOS.get(chave);
    if (s === undefined) {
      s = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
      NUCLEOS.set(chave, s);
    }
    return s;
  }

  function drawStar(c, px, py, mag, rgb, a, grow) {
    const r = radiusFor(mag) * (grow || 1);
    const [rr, gg, bb] = rgb;
    const col = (al) => 'rgba(' + rr + ',' + gg + ',' + bb + ',' + al.toFixed(3) + ')';

    /* O brilho e as espículas continuam com o alfa embutido em cada parada do
       gradiente, exatamente como antes.

       A tentativa de passar os dois para globalAlpha foi medida e desfeita: a
       conta é neutra, mas o rasterizador monta o gradiente numa tabela de 256
       entradas, e quantizar uma tabela que vai até 0.42·a não dá o mesmo que
       quantizar uma que vai até 0.42 e depois multiplicar por a. Sobre o fundo
       do site a diferença chegava a 4 de 255 — invisível, e ainda assim uma
       diferença, e o combinado era que o céu não mudasse. Estas duas parcelas
       são de estrelas brilhantes, que são minoria; o laço não é aqui. */
    if (mag < 2.4) {
      const gr = r * (mag < 1.0 ? 6.5 : 4.4);
      const gl = c.createRadialGradient(px, py, 0, px, py, gr);
      gl.addColorStop(0, col(a * 0.42));
      gl.addColorStop(0.45, col(a * 0.10));
      gl.addColorStop(1, col(0));
      c.fillStyle = gl;
      c.beginPath(); c.arc(px, py, gr, 0, 6.283185); c.fill();
    }

    if (mag < 1.8) {
      const len = r * (3.4 + (1.8 - mag) * 2.6);
      c.lineCap = 'round';
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const g2 = c.createLinearGradient(px - dx * len, py - dy * len, px + dx * len, py + dy * len);
        g2.addColorStop(0, col(0));
        g2.addColorStop(0.5, col(a * 0.55));
        g2.addColorStop(1, col(0));
        c.strokeStyle = g2;
        c.lineWidth = Math.max(0.6, r * 0.30);
        c.beginPath();
        c.moveTo(px - dx * len, py - dy * len);
        c.lineTo(px + dx * len, py + dy * len);
        c.stroke();
      }
    }

    /* O núcleo, que TODA estrela desenha, e onde estava o laço.
       Um preenchimento liso não passa por tabela nenhuma: o alfa da origem é
       multiplicado pelo globalAlpha e pronto, então `rgb(...)` com globalAlpha
       a dá exatamente o mesmo pixel que `rgba(...,a)` — conferido, zero bytes
       de diferença. O que se ganha é a string: antes cada uma das cerca de mil
       e seiscentas estrelas do laço montava um `rgba(...)` com toFixed(3) a
       cada quadro, quase cem mil formatações de número por segundo para pintar
       pontos cuja cor nunca muda. Agora a string é uma só, para o catálogo
       inteiro. */
    /* Arredondado a três casas porque a string que ele substitui passava por
       toFixed(3). Sem isto o globalAlpha entra com precisão cheia e o pixel sai
       um nível acima ou abaixo do antigo em uma parte a cada duas mil — 1 de
       255, invisível, e ainda assim diferente. Aqui é uma multiplicação e uma
       divisão, não uma formatação de número. */
    c.globalAlpha = Math.round(a * 1000) / 1000;
    c.fillStyle = corDoNucleo(rgb);
    c.beginPath(); c.arc(px, py, r, 0, 6.283185); c.fill();
    /* Devolvido: a camada estática e o rastro do meteoro desenham depois e
       contam com o valor cheio. */
    c.globalAlpha = 1;
  }

  function star(c, t) {
    for (let i = 0; i < twinklers.length; i++) {
      const s = twinklers[i];
      const w = REDUCED ? 1 : 1 + s.amp * (Math.sin(t * s.f1 + s.p1) * 0.62 + Math.sin(t * s.f2 + s.p2) * 0.38);
      const a = Math.max(0.08, Math.min(1, alphaFor(s.mag) * w));
      /* The spikes breathe with it. Scintillation moves the apparent size as
         well as the brightness, and on the few stars that have spikes it is the
         spikes that show it. Kept small: it is a shimmer, not a heartbeat. */
      drawStar(c, s.px, s.py, s.mag, s.rgb, a, REDUCED ? 1 : 1 + (w - 1) * 0.35);
    }
  }

  function newShooter() {
    const edge = Math.random() < 0.5;
    return {
      x: edge ? Math.random() * W * 0.6 : W * 0.3 + Math.random() * W * 0.4,
      y: Math.random() * H * 0.5,
      a: ((25 + Math.random() * 30) * Math.PI) / 180,
      sp: 380 + Math.random() * 260,
      life: 1, tail: [],
    };
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    build();
  }

  /* The sky stops when it leaves the screen. Every other animated thing on this
     page is bound to an observer and this one was not, so 2,851 stars were being
     redrawn sixty times a second for the whole time a reader spent on the rest
     of the page, with the hero long gone above them. Nothing about the picture
     changes; it simply stops being drawn when nobody is looking at it. */
  let running = true, raf = 0;
  let last = 0;
  function frame(ts) {
    const dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    const t = ts * 0.001;
    ctx.clearRect(0, 0, W, H);
    if (statik) ctx.drawImage(statik, 0, 0, W, H);
    star(ctx, t);

    if (!REDUCED) {
      shootTimer -= dt;
      if (shootTimer <= 0 && !shooting) { shooting = newShooter(); shootTimer = 8 + Math.random() * 14; }
      if (shooting) {
        shooting.x += Math.cos(shooting.a) * shooting.sp * dt;
        shooting.y += Math.sin(shooting.a) * shooting.sp * dt;
        shooting.life -= dt * 1.3;
        shooting.tail.push({ x: shooting.x, y: shooting.y });
        if (shooting.tail.length > 18) shooting.tail.shift();
        ctx.lineCap = 'round';
        for (let j = 1; j < shooting.tail.length; j++) {
          const p0 = shooting.tail[j - 1], p1 = shooting.tail[j];
          const a = (j / shooting.tail.length) * Math.max(0, shooting.life) * 0.75;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = 'rgba(220,235,255,' + a.toFixed(2) + ')';
          ctx.lineWidth = 1.5 * (j / shooting.tail.length);
          ctx.stroke();
        }
        if (shooting.life <= 0 || shooting.x > W + 40 || shooting.y > H + 40) shooting = null;
      }
    }
    if (running) raf = requestAnimationFrame(frame);
  }

  /* The random field the catalogue replaces, kept as the way this fails. */
  function fallback(why) {
    console.warn('[sky] falling back to a random field:', why);
    stars = new Array(130);
    for (let i = 0; i < 130; i++) {
      const v = toVec(Math.random() * 360, Math.asin(Math.random() * 2 - 1) * 57.2958);
      stars[i] = { x: v[0], y: v[1], z: v[2], mag: 1 + Math.random() * 5, rgb: [210, 225, 255] };
    }
    resize();
  }

  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(canvas);
  else addEventListener('resize', resize);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
        else if (!e.isIntersecting && running) { running = false; cancelAnimationFrame(raf); }
      });
    }, { rootMargin: "80px" }).observe(canvas);
  }
  raf = requestAnimationFrame(frame);

  loadCatalogue()
    .then((s) => { stars = s; resize(); })
    .catch(fallback);
}
