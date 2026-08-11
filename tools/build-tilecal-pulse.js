/* The TileCal pulse, tabulated
   ------------------------------------------------------------------
   The figure on the CERN page is drawn from data rather than from a curve
   invented in a stylesheet, so the shape lives here as numbers and ships as
   data/tilecal-pulse.json.

   Source, and what is taken from it:

     J. M. de Seixas, on behalf of the ATLAS Collaboration,
     "The TileCal Energy Reconstruction for LHC Run2 and Future Perspectives",
     arXiv:1510.01690 / ATL-TILECAL-PROC-2015-xxx.

   From that paper, verbatim facts the drawing rests on:

     - the front-end shapes the signal into a fixed and stable 150 ns pulse;
     - the pulse is sampled at 40 MHz and the readout window is 7 samples,
       which is 175 ns of window for a 150 ns pulse;
     - the amplitude is estimated online by Optimal Filtering, a weighted sum
       of the seven samples, y_i = ped + A·g(t_i + tau) + n_i;
     - out-of-time pile-up from a subsequent bunch crossing rides on the same
       window and deforms it (their figure 2 puts the second signal at +50 ns).

   What this file does NOT claim: the sample values are not measured ADC counts
   from a real channel. g(t) is the published reference shape reproduced from
   its landmarks (peak at t=0, rise faster than the fall, ~150 ns of usable
   width, no undershoot), tabulated at 1 ns. A caption on the page says exactly
   this, and credits.html carries the reference.

   Run:  node tools/build-tilecal-pulse.js
*/

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'data', 'tilecal-pulse.json');

/* Two half-Gaussians joined at the peak: the shaped TileCal pulse rises faster
   than it falls, which is the whole reason out-of-time pile-up from the NEXT
   crossing matters more than from the previous one. Widths chosen so the curve
   reaches the published landmarks: FWHM near 50 ns and effectively zero by
   +100 ns, inside a 150 ns shaped pulse. */
const RISE = 17.5;
const FALL = 26.5;

function g(t) {
  const s = t < 0 ? RISE : FALL;
  const v = Math.exp(-0.5 * (t / s) * (t / s));
  return v < 1e-4 ? 0 : v;
}

/* One nanosecond apart, over the window the paper plots. */
const T0 = -100, T1 = 150;
const curve = [];
for (let t = T0; t <= T1; t++) curve.push(Number(g(t).toFixed(5)));

/* The readout window: seven samples, 25 ns apart, the peak on the fourth.
   This is the sampling the front-end actually performs, so the samples are
   the curve read at those instants, not a second set of numbers. */
const SAMPLE_T = [-75, -50, -25, 0, 25, 50, 75];

/* Pile-up: one out-of-time signal from a subsequent crossing, at +50 ns, at
   60% of the amplitude of the signal of interest, which is the case their
   figure 2 illustrates. The distorted waveform is the sum, and it is what the
   electronics actually digitises. */
const OOT_SHIFT = 50;
const OOT_AMP = 0.6;

const sum = curve.map((v, i) => {
  const t = T0 + i;
  return Number((v + OOT_AMP * g(t - OOT_SHIFT)).toFixed(5));
});

const data = {
  source: 'arXiv:1510.01690, ATLAS Collaboration (TileCal energy reconstruction)',
  note: 'Reference pulse shape reproduced from published landmarks and tabulated at 1 ns. Not measured ADC counts.',
  t0: T0,
  t1: T1,
  step: 1,
  sampleT: SAMPLE_T,
  oot: { shift: OOT_SHIFT, amp: OOT_AMP },
  /* What the seven samples read in each case. The clean set is what a lone
     signal gives; the piled-up set is what the same channel gives when the
     next crossing lands on top of it, and the gap between them is the problem
     this laboratory works on. */
  clean: SAMPLE_T.map((t) => Number(g(t).toFixed(5))),
  piled: SAMPLE_T.map((t) => Number((g(t) + OOT_AMP * g(t - OOT_SHIFT)).toFixed(5))),
  curve,
  sum,
};

fs.writeFileSync(OUT, JSON.stringify(data), 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('escrito data/tilecal-pulse.json  ' + kb + ' KB');
console.log('  amostras limpas :', data.clean.join(' '));
console.log('  com empilhamento:', data.piled.join(' '));
