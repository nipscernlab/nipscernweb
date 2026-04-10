/**
 * decode_lar.mjs
 * Decodes LAr EM IDs from JiveXML using atlas-id-parser (WASM),
 * computes statistics for each decoded field, and writes lar_em_stats.txt
 *
 * LAr EM filter: subdet=4, part=±1 (LArEM electromagnetic or LArEMdisc)
 * Fields returned by parser: subdet, part, barrel-endcap, sampling, region, eta, phi
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 1. Initialize WASM module synchronously ─────────────────────────────────
const { initSync, parse_atlas_id } = await import('./atlas-id-parser/pkg/atlas_id_parser.js');
const wasmBuffer = readFileSync(join(__dirname, 'atlas-id-parser/pkg/atlas_id_parser_bg.wasm'));
initSync({ module: wasmBuffer });
console.log('WASM parser initialized.');

// ── 2. Extract LAr AllCalo <id> section from XML ────────────────────────────
console.log('Reading XML...');
const xml = readFileSync(join(__dirname, 'JiveXML_516761_840521342.xml'), 'utf8');

const LAR_OPEN  = '<LAr count="27694" storeGateKey="AllCalo">';
const LAR_CLOSE = '</LAr>';

const larStart = xml.indexOf(LAR_OPEN);
if (larStart === -1) throw new Error('LAr AllCalo section not found');
const larEnd   = xml.indexOf(LAR_CLOSE, larStart);
const larBlock = xml.slice(larStart, larEnd);

const idOpen  = larBlock.indexOf('<id>');
const idClose = larBlock.indexOf('</id>');
if (idOpen === -1) throw new Error('<id> tag not found');

const ids = larBlock.slice(idOpen + 4, idClose).trim().split(/\s+/).filter(Boolean);
console.log(`Total IDs in <LAr AllCalo>: ${ids.length}`);

// ── 3. Decode every ID with the WASM parser ──────────────────────────────────
console.log('Decoding...');

const larEM   = [];   // cells with subdet=4, |part|=1
let nInvalid  = 0;
let nOther    = 0;

// Collect labels for each field value (for the report)
const labelMap = {};   // fieldName -> Map<value, label>

for (let i = 0; i < ids.length; i++) {
  if (i > 0 && i % 5000 === 0) process.stdout.write(`  ${i}/${ids.length}\r`);

  let parsed;
  try   { parsed = parse_atlas_id(ids[i]); }
  catch { nInvalid++; continue; }

  if (!parsed?.valid) { nInvalid++; continue; }

  // Build field map: name -> {value, label}
  const fmap = {};
  for (const f of (parsed.fields ?? [])) {
    fmap[f.name] = { value: f.value, label: f.label };
    // Accumulate label for this (field, value) pair
    if (!labelMap[f.name]) labelMap[f.name] = new Map();
    if (!labelMap[f.name].has(f.value)) labelMap[f.name].set(f.value, f.label);
  }

  const subdet = fmap['subdet']?.value;
  const part   = fmap['part']?.value;

  if (subdet === 4 && (part === 1 || part === -1)) {
    larEM.push({
      id:             ids[i],
      fields:         fmap,
      physEta:        parsed.eta,
      physPhi:        parsed.phi,
      subsystem:      parsed.subsystem,
    });
  } else {
    nOther++;
  }
}

console.log(`\nLAr EM cells decoded          : ${larEM.length}`);
console.log(`Other subdet/part (ignored)   : ${nOther}`);
console.log(`Invalid / parse error         : ${nInvalid}`);

if (larEM.length === 0) { console.error('No LAr EM cells found!'); process.exit(1); }

// ── 4. Compute statistics per field ─────────────────────────────────────────
function statsOf(arr) {
  // arr is an array of numbers
  const counts = new Map();
  let min = Infinity, max = -Infinity, sum = 0;
  for (const v of arr) {
    counts.set(v, (counts.get(v) ?? 0) + 1);
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  const sorted = [...counts.entries()].sort((a, b) => a[0] - b[0]);
  return { sorted, min, max, mean: sum / arr.length, n: arr.length };
}

// Ordered field list (as returned by the parser for LAr EM)
const FIELD_ORDER = ['subdet', 'part', 'barrel-endcap', 'sampling', 'region', 'eta', 'phi'];

// ── 5. Build report ──────────────────────────────────────────────────────────
const N  = larEM.length;
const HR = '─'.repeat(72);
const EQ = '═'.repeat(72);

function pad(s, w, right = false) {
  s = String(s);
  return right ? s.padEnd(w) : s.padStart(w);
}
function pct(c) { return ((c / N) * 100).toFixed(2) + '%'; }

const lines = [];

lines.push(EQ);
lines.push('  ESTATÍSTICAS — IDs LAr EM (Calorimetro Eletromagnético de Árgônio)');
lines.push('  Arquivo: JiveXML_516761_840521342.xml  |  Bloco: <LAr storeGateKey="AllCalo">');
lines.push('  Parser:  atlas-id-parser (WASM)  |  Filtro: subdet=4, part=±1');
lines.push(EQ);
lines.push('');
lines.push(`  Total de IDs no bloco LAr AllCalo : ${pad(ids.length, 6)}`);
lines.push(`  Células LAr EM (subdet=4,|part|=1): ${pad(N, 6)}`);
lines.push(`  Outros subdetectores / ignorados  : ${pad(nOther, 6)}`);
lines.push(`  IDs inválidos / erro de parse     : ${pad(nInvalid, 6)}`);
lines.push('');

// Physical eta/phi ranges
const etas = larEM.map(c => c.physEta);
const phis = larEM.map(c => c.physPhi);
const etaMin = Math.min(...etas).toFixed(4);
const etaMax = Math.max(...etas).toFixed(4);
const phiMin = Math.min(...phis).toFixed(4);
const phiMax = Math.max(...phis).toFixed(4);

lines.push(`  Cobertura física η : [${etaMin}, ${etaMax}]`);
lines.push(`  Cobertura física φ : [${phiMin}, ${phiMax}] rad`);
lines.push('');

// Per-field statistics
for (const fieldName of FIELD_ORDER) {
  const values = larEM.map(c => c.fields[fieldName]?.value).filter(v => v !== undefined);
  if (values.length === 0) continue;

  const s = statsOf(values);
  const lm = labelMap[fieldName] ?? new Map();

  lines.push(HR);
  lines.push(`  Campo: ${fieldName.toUpperCase()}`);
  lines.push('');
  lines.push(`    n total       = ${s.n}`);
  lines.push(`    mínimo        = ${s.min}`);
  lines.push(`    máximo        = ${s.max}`);
  lines.push(`    média         = ${s.mean.toFixed(4)}`);
  lines.push(`    valores únicos= ${s.sorted.length}`);
  lines.push('');
  lines.push(`    ${'valor'.padEnd(8)} ${'count'.padEnd(8)} ${'%'.padEnd(8)} ${'descrição'}`);
  lines.push(`    ${'─'.repeat(65)}`);

  for (const [v, c] of s.sorted) {
    const label = lm.get(v) ?? '';
    lines.push(`    ${pad(v, 6)}   ${pad(c, 6)}   ${pct(c).padEnd(8)} ${label}`);
  }
  lines.push('');
}

// Physical eta index distribution (condensed — show every 10th bin for large fields)
lines.push(HR);
lines.push('  NOTA: Campo ETA acima mostra índice eta (0-based dentro de cada região).');
lines.push('  Campo BARREL-ENDCAP determina a região física do detector:');
lines.push('    -3 → Endcap negativo roda interna (C-side)');
lines.push('    -2 → Endcap negativo roda externa (C-side)');
lines.push('    -1 → Barrel negativo (C-side)');
lines.push('     1 → Barrel positivo (A-side)');
lines.push('     2 → Endcap positivo roda externa (A-side)');
lines.push('     3 → Endcap positivo roda interna (A-side)');
lines.push('');
lines.push('  Combinações (barrel-endcap × sampling):');
lines.push(`    ${'bec'.padEnd(6)} ${'samp'.padEnd(6)} ${'count'.padEnd(8)} ${'%'.padEnd(10)} ${'bec-label'}`);
lines.push(`    ${'─'.repeat(60)}`);

const combo = new Map();
const comboLabel = new Map();
for (const c of larEM) {
  const bec  = c.fields['barrel-endcap']?.value;
  const samp = c.fields['sampling']?.value;
  const key  = `${bec}_${samp}`;
  combo.set(key, (combo.get(key) ?? 0) + 1);
  if (!comboLabel.has(key)) {
    comboLabel.set(key, labelMap['barrel-endcap']?.get(bec) ?? '');
  }
}
const comboSorted = [...combo.entries()].sort((a, b) => {
  const [ab, as_] = a[0].split('_').map(Number);
  const [bb, bs]  = b[0].split('_').map(Number);
  return ab !== bb ? ab - bb : as_ - bs;
});
for (const [key, c] of comboSorted) {
  const [bec, samp] = key.split('_');
  const label = comboLabel.get(key);
  lines.push(`    ${pad(bec, 4)}   ${pad(samp, 4)}   ${pad(c, 6)}   ${pct(c).padEnd(10)} ${label}`);
}

lines.push('');
lines.push(EQ);
lines.push('  FIM DO RELATÓRIO');
lines.push(EQ);

const report = lines.join('\n');
const outPath = join(__dirname, 'lar_em_stats.txt');
writeFileSync(outPath, report, 'utf8');

console.log(`\nRelatório escrito em: ${outPath}`);
console.log('\n' + report);
