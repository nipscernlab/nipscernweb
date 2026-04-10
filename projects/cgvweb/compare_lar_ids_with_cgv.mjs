import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CGV_PATH = join(__dirname, 'CaloGeometry.cgv');
const XML_PATH = join(__dirname, 'default_xml', 'JiveXML_516761_840521342.xml');
const WASM_JS = join(__dirname, 'atlas-id-parser', 'pkg', 'atlas_id_parser.js');
const WASM_BIN = join(__dirname, 'atlas-id-parser', 'pkg', 'atlas_id_parser_bg.wasm');
const OUTPUT_PATH = join(__dirname, 'output.txt');
const SEP = '\t→\t';

function normalizePath(line) {
  return line
    .split('→')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' → ');
}

function loadCgvPaths() {
  const raw = readFileSync(CGV_PATH, 'utf8');
  const lines = raw.split(/\r?\n/);
  const paths = new Set();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const normalized = normalizePath(trimmed);
    if (normalized) paths.add(normalized);
  }

  return paths;
}

function extractLArIds(xml) {
  const larTagRe = /<LAr\b[^>]*storeGateKey="AllCalo"[^>]*>/;
  const match = larTagRe.exec(xml);
  if (!match) throw new Error('<LAr storeGateKey="AllCalo"> not found');

  const start = match.index;
  const end = xml.indexOf('</LAr>', start);
  if (end === -1) throw new Error('</LAr> closing tag not found');

  const larBlock = xml.slice(start, end);
  const idOpen = larBlock.indexOf('<id>');
  const idClose = larBlock.indexOf('</id>');
  if (idOpen === -1 || idClose === -1) throw new Error('<id> block not found inside <LAr>');

  const rawIds = larBlock.slice(idOpen + 4, idClose).trim();
  return rawIds.split(/\s+/).filter(Boolean);
}

function buildCgvPaths(parsed) {
  const fmap = {};
  for (const f of parsed.fields ?? []) fmap[f.name] = f.value;

  const subdet = fmap['subdet'];
  const part = fmap['part'];
  const bec = fmap['barrel-endcap'];
  const samp = fmap['sampling'];
  const eta = fmap['eta'];
  const phi = fmap['phi'];

  if (subdet !== 4 || (part !== 1 && part !== -1)) return null;
  if (bec === undefined || samp === undefined || eta === undefined || phi === undefined) return null;

  const X = bec === -1 || bec === 1 ? 'Barrel' : 'EndCap';
  const W = X === 'Barrel' ? 0 : 1;
  const Z = bec > 0 ? 'p' : 'n';
  const K = eta;
  const P = phi;

  const name1 = `EM${X}${samp}${Z}_${W}`;
  const name2 = `EM${X}${samp}${Z}${K}_${K}`;
  const candidatePaths = [
    normalizePath(`Calorimeter${SEP}${name1}${SEP}${name2}${SEP}cell_${P}`),
    normalizePath(`Calorimeter${SEP}${name1}${SEP}${name2}${SEP}cell2_${P}`),
  ];

  return candidatePaths;
}

async function main() {
  const cgvPaths = loadCgvPaths();
  console.log(`Loaded ${cgvPaths.size} paths from ${CGV_PATH}`);

  const xml = readFileSync(XML_PATH, 'utf8');
  const ids = extractLArIds(xml);
  console.log(`Extracted ${ids.length} IDs from ${XML_PATH}`);

  const { initSync, parse_atlas_id } = await import(`./atlas-id-parser/pkg/atlas_id_parser.js`);
  const wasmBytes = readFileSync(WASM_BIN);
  initSync({ module: wasmBytes });
  console.log('WASM parser initialized.');

  const missing = [];
  let decoded = 0;
  let invalid = 0;

  for (let i = 0; i < ids.length; i++) {
    if (i > 0 && i % 5000 === 0) process.stdout.write(`Decoded ${i}/${ids.length}\r`);
    const rawId = ids[i];
    let parsed;
    try {
      parsed = parse_atlas_id(rawId);
    } catch (err) {
      invalid += 1;
      continue;
    }
    if (!parsed?.valid) {
      invalid += 1;
      continue;
    }

    const paths = buildCgvPaths(parsed);
    if (!paths) {
      invalid += 1;
      continue;
    }

    decoded += 1;
    const found = paths.some((p) => cgvPaths.has(p));
    if (!found) {
      missing.push(`${rawId} -> ${paths[0]}`);
    }
  }

  console.log(`\nDecoded valid paths : ${decoded}`);
  console.log(`Invalid / skipped   : ${invalid}`);
  console.log(`Missing in CGV      : ${missing.length}`);

  const lines = missing.length > 0
    ? missing
    : ['# Nenhum caminho faltante encontrado no CaloGeometry.cgv para IDs decodificados.'];

  writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
