/**
 * map_lar_cells.mjs
 *
 * Reads <LAr storeGateKey="AllCalo"> from JiveXML, decodes every ID
 * with atlas-id-parser (WASM), then builds mesh-path strings in the form:
 *
 *   Calorimeter → EMXYZ_W → EMXYZK_K → cell_P
 *
 * Rules:
 *   X = "Barrel"  if barrel-endcap ∈ {-1, +1}
 *       "EndCap"  if barrel-endcap ∈ {-2, +2, -3, +3}
 *   Y = sampling value (0-3)
 *   Z = "p" if barrel-endcap > 0, "n" if < 0
 *   W = 0 if X=Barrel, 1 if X=EndCap
 *   K = eta index
 *   P = phi index
 *
 * Outputs:
 *   lar_em_cells.txt       — one valid path string per line
 *   lar_em_cells_debug.txt — summary counts (valid / invalid / reasons)
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEP = '\t→\t';   // tab → tab  (matches CGV path format)

// ── 1. Initialize WASM ──────────────────────────────────────────────────────
const { initSync, parse_atlas_id } =
  await import('./atlas-id-parser/pkg/atlas_id_parser.js');
initSync({
  module: readFileSync(join(__dirname, 'atlas-id-parser/pkg/atlas_id_parser_bg.wasm')),
});
console.log('WASM initialized.');

// ── 2. Extract LAr AllCalo <id> block ───────────────────────────────────────
console.log('Reading XML...');
const xml = readFileSync(join(__dirname, 'JiveXML_516761_840521342.xml'), 'utf8');

// Match <LAr ... storeGateKey="AllCalo"> with any count value
const larTagRe = /<LAr\b[^>]*storeGateKey="AllCalo"[^>]*>/;
const larTagMatch = larTagRe.exec(xml);
if (!larTagMatch) throw new Error('<LAr storeGateKey="AllCalo"> not found');

const larStart = larTagMatch.index;
const larEnd   = xml.indexOf('</LAr>', larStart);
const larBlock = xml.slice(larStart, larEnd);

const idOpen  = larBlock.indexOf('<id>');
const idClose = larBlock.indexOf('</id>');
if (idOpen === -1) throw new Error('<id> tag not found inside <LAr>');

const ids = larBlock.slice(idOpen + 4, idClose).trim().split(/\s+/).filter(Boolean);
console.log(`IDs found in <LAr AllCalo>: ${ids.length}`);

// ── 3. Decode and map each ID ────────────────────────────────────────────────
const validLines   = [];
const invalidItems = [];   // { id, reason }

for (let i = 0; i < ids.length; i++) {
  if (i > 0 && i % 5000 === 0) process.stdout.write(`  ${i}/${ids.length}\r`);

  const rawId = ids[i];

  // --- parse ---
  let parsed;
  try { parsed = parse_atlas_id(rawId); }
  catch (e) { invalidItems.push({ id: rawId, reason: `exception: ${e.message}` }); continue; }

  if (!parsed?.valid) {
    invalidItems.push({ id: rawId, reason: parsed?.error || 'parse returned invalid' });
    continue;
  }

  // --- extract fields ---
  const fmap = {};
  for (const f of (parsed.fields ?? [])) fmap[f.name] = f.value;

  const subdet = fmap['subdet'];
  const part   = fmap['part'];
  const bec    = fmap['barrel-endcap'];
  const samp   = fmap['sampling'];
  const eta    = fmap['eta'];
  const phi    = fmap['phi'];

  // --- validate subdet / part ---
  if (subdet !== 4) {
    invalidItems.push({ id: rawId, reason: `subdet=${subdet} (expected 4)` }); continue;
  }
  if (part !== 1 && part !== -1) {
    invalidItems.push({ id: rawId, reason: `part=${part} (expected ±1)` }); continue;
  }

  // --- validate required fields present ---
  if (bec === undefined || samp === undefined || eta === undefined || phi === undefined) {
    invalidItems.push({ id: rawId, reason: 'missing field (bec/samp/eta/phi)' }); continue;
  }

  // --- map barrel-endcap to X and W ---
  let X, W;
  if (bec === -1 || bec === 1) {
    X = 'Barrel';  W = 0;
  } else if (bec === -2 || bec === 2 || bec === -3 || bec === 3) {
    X = 'EndCap';  W = 1;
  } else {
    invalidItems.push({ id: rawId, reason: `barrel-endcap=${bec} unexpected value` }); continue;
  }

  const Y = samp;
  const Z = bec > 0 ? 'p' : 'n';
  const K = eta;
  const P = phi;

  // --- build path string ---
  const name1 = `EM${X}${Y}${Z}_${W}`;         // e.g. EMBarrel1p_0
  const name2 = `EM${X}${Y}${Z}${K}_${K}`;     // e.g. EMBarrel1p41_41
  const name3 = `cell_${P}`;                    // e.g. cell_48

  validLines.push(`Calorimeter${SEP}${name1}${SEP}${name2}${SEP}${name3}`);
}

console.log(`\nValid   : ${validLines.length}`);
console.log(`Invalid : ${invalidItems.length}`);

// ── 4. Write output files ────────────────────────────────────────────────────
const outCells = join(__dirname, 'lar_em_cells.txt');
writeFileSync(outCells, validLines.join('\n') + '\n', 'utf8');
console.log(`Cells written to: ${outCells}`);

// --- debug file ---
const debugLines = [];
debugLines.push('═'.repeat(60));
debugLines.push('  LAr EM Cell Mapping — Debug Summary');
debugLines.push('  Source: JiveXML_516761_840521342.xml');
debugLines.push('═'.repeat(60));
debugLines.push('');
debugLines.push(`  Total IDs processed : ${ids.length}`);
debugLines.push(`  Strings válidas     : ${validLines.length}`);
debugLines.push(`  Strings inválidas   : ${invalidItems.length}`);
debugLines.push('');

if (invalidItems.length > 0) {
  debugLines.push('─'.repeat(60));
  debugLines.push('  Inválidos por razão:');
  debugLines.push('');
  const byReason = new Map();
  for (const item of invalidItems) {
    byReason.set(item.reason, (byReason.get(item.reason) ?? 0) + 1);
  }
  for (const [reason, count] of [...byReason.entries()].sort((a,b) => b[1]-a[1])) {
    debugLines.push(`    ${String(count).padStart(6)}  ${reason}`);
  }
  debugLines.push('');
  if (invalidItems.length <= 20) {
    debugLines.push('  IDs inválidos:');
    for (const item of invalidItems) {
      debugLines.push(`    ${item.id}  →  ${item.reason}`);
    }
  }
}

debugLines.push('─'.repeat(60));
debugLines.push('  Primeiras 10 strings válidas geradas:');
debugLines.push('');
for (const line of validLines.slice(0, 10)) {
  debugLines.push('  ' + line);
}
debugLines.push('');
debugLines.push('═'.repeat(60));

const outDebug = join(__dirname, 'lar_em_cells_debug.txt');
writeFileSync(outDebug, debugLines.join('\n') + '\n', 'utf8');
console.log(`Debug written to:  ${outDebug}`);
