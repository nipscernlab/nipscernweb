// JS-side jet parser for JiveXML.
//
// The Rust WASM parser doesn't extract jets today, so we do a light second pass
// in JS over the same XML text after the worker returns. Cost is negligible —
// only a few jet collections per event with tens of jets each.
//
// Output shape:
//   [
//     {
//       key: "AntiKt4EMTopoJets_xAOD",
//       jets: [{ eta, phi, etGev, energyGev, cells: [id...], tracks: [{key,index}...] }, ...]
//     },
//     ...
//   ]
// `cells` are calorimeter-cell IDs as strings (matches the format used by the
// cluster filter), present only for collections that publish <cells> in the
// XML (EMTopo / LCTopo R=0.4 and R=1.0). Empty array otherwise.
// Tracks are flat (key, index) tuples — sliced from flat trackKey/trackIndex
// arrays using trackLinkCount per jet.

function _readNums(body, tag) {
  const re = new RegExp(`<${tag}(?:\\s+multiple="[^"]+")?>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  if (!m) return [];
  const trimmed = m[1].trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map(Number);
}

function _readStrings(body, tag) {
  const re = new RegExp(`<${tag}(?:\\s+multiple="[^"]+")?>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  if (!m) return [];
  const trimmed = m[1].trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/);
}

export function parseJets(xmlText) {
  const collections = [];
  // Fresh regex per call — avoids any stale lastIndex state from a previous run.
  const jetRe = /<Jet\s+count="(\d+)"\s+storeGateKey="([^"]+)">([\s\S]*?)<\/Jet>/g;
  let match;
  while ((match = jetRe.exec(xmlText)) !== null) {
    const count = parseInt(match[1], 10);
    const key = match[2];
    const body = match[3];
    if (!count) {
      collections.push({ key, jets: [] });
      continue;
    }

    const etas = _readNums(body, 'eta');
    const phis = _readNums(body, 'phi');
    const ets = _readNums(body, 'et');
    const energies = _readNums(body, 'energy');
    const masses = _readNums(body, 'mass');
    const pxs = _readNums(body, 'px');
    const pys = _readNums(body, 'py');
    if (etas.length !== count || phis.length !== count) {
      // Malformed jet block — keep the collection key so the dropdown still
      // shows it, but with no usable entries.
      collections.push({ key, jets: [] });
      continue;
    }

    const trackIndex = _readNums(body, 'trackIndex');
    const trackKey = _readStrings(body, 'trackKey');
    const trackLinkCount = _readNums(body, 'trackLinkCount');

    // <cells> is a flat list of 64-bit cell IDs (kept as strings so the
    // browser's Number precision doesn't truncate). <numCells> tells us how
    // many belong to each jet so we can slice.
    const numCells = _readNums(body, 'numCells');
    const cellsFlat = _readStrings(body, 'cells');

    const jets = [];
    let trkOffset = 0;
    let cellOffset = 0;
    for (let i = 0; i < count; i++) {
      const tlc = trackLinkCount[i] | 0;
      const tracks = [];
      for (let j = 0; j < tlc; j++) {
        const tk = trackKey[trkOffset + j];
        const ti = trackIndex[trkOffset + j];
        if (tk == null || !Number.isFinite(ti)) continue;
        tracks.push({ key: tk, index: ti | 0 });
      }
      trkOffset += tlc;

      const nc = numCells[i] | 0;
      const cells = [];
      for (let j = 0; j < nc; j++) {
        const id = cellsFlat[cellOffset + j];
        if (id) cells.push(id);
      }
      cellOffset += nc;

      // pT preferred from <px>/<py> when available (the canonical observable
      // physicists work with); fall back to <et> for collections that don't
      // expose 4-momentum components.
      const px = Number.isFinite(pxs[i]) ? pxs[i] : NaN;
      const py = Number.isFinite(pys[i]) ? pys[i] : NaN;
      const ptGev =
        Number.isFinite(px) && Number.isFinite(py)
          ? Math.sqrt(px * px + py * py)
          : Number.isFinite(ets[i])
            ? ets[i]
            : 0;

      jets.push({
        eta: etas[i],
        phi: phis[i],
        etGev: Number.isFinite(ets[i]) ? ets[i] : 0,
        energyGev: Number.isFinite(energies[i]) ? energies[i] : 0,
        massGev: Number.isFinite(masses[i]) ? masses[i] : 0,
        ptGev,
        cells,
        tracks,
      });
    }
    collections.push({ key, jets });
  }
  return collections;
}
