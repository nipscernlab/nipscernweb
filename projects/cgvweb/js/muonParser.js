// JS-side parser for <Muon> blocks (reconstructed muon objects).
//
// The XML lists each muon with eta, phi, pt, energy, mass, pdgId, chi2.
// pdgId is ±13. The existing electron pipeline treats pdgId < 0 as the
// negatively-charged lepton (e-); we mirror that interpretation here so
// μ- / μ+ labels stay consistent with e- / e+ across the viewer.
//
// Output shape mirrors parseElectrons: a flat array of
//   { eta, phi, ptGev, pdgId, energyGev, key }
// where `key` is the storeGateKey (Muons_xAOD typically). The downstream
// matcher (recomputeMuonTrackMatch) uses (eta, phi) to attach each muon to
// its closest CombinedMuonTrack so the sprite label lands on the rendered
// blue polyline.

function _readNums(body, tag) {
  const re = new RegExp(`<${tag}(?:\\s+multiple="[^"]+")?>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  if (!m) return [];
  const trimmed = m[1].trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map(Number);
}

export function parseMuons(xmlText) {
  const out = [];
  if (!xmlText) return out;
  const re = /<Muon\s+count="(\d+)"\s+storeGateKey="([^"]+)">([\s\S]*?)<\/Muon>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const count = parseInt(m[1], 10);
    const key = m[2];
    const body = m[3];
    if (!count) continue;

    const etas = _readNums(body, 'eta');
    const phis = _readNums(body, 'phi');
    const pts = _readNums(body, 'pt');
    const energies = _readNums(body, 'energy');
    const pdgIds = _readNums(body, 'pdgId');
    if (etas.length !== count || phis.length !== count) continue;

    for (let i = 0; i < count; i++) {
      // Keep pdgId as null when missing or zero — the sprite renderer falls
      // back to a charge-less "μ" label in that case. Forcing a default sign
      // would mislabel real muons with stripped/corrupted charge info.
      const raw = pdgIds[i];
      const pdgId = Number.isFinite(raw) && raw !== 0 ? raw | 0 : null;
      out.push({
        eta: etas[i],
        phi: phis[i],
        ptGev: Number.isFinite(pts[i]) ? pts[i] : 0,
        energyGev: Number.isFinite(energies[i]) ? energies[i] : 0,
        pdgId,
        key,
      });
    }
  }
  return out;
}
