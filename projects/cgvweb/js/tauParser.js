// JS-side parser for <TauJet> blocks (hadronic tau candidates).
//
// Single collection per event: TauJets_xAOD (6-9 candidates typical). Each
// candidate publishes:
//   eta, phi, pt    — direction + transverse momentum (no <et> field)
//   isTauString     — ID quality: Loose / Medium / Tight / "none"
//   label           — descriptive string (`xAOD_tauJet_withoutQuality`)
//   numTracks       — number of associated tracks (1 or 3 for hadronic τ)
//   trackIndex / trackKey — links into the rendered tracks
//   logLhRatio      — likelihood-ratio score for the ID
//   isolFrac        — isolation fraction
//   mass            — empty in current XMLs
//
// Tracks are sliced by numTracks the same way jets do — flat arrays per
// candidate paired with a per-candidate count.

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

// Returns an array of taus (flattened across collections — usually only one).
// Each entry: { eta, phi, ptGev, isTau, numTracks, tracks: [{key, index}], key }
//   `isTau` is the isTauString token (used in tooltip).
//   `key` is the storeGateKey (e.g. "TauJets_xAOD"), kept for the tooltip.
export function parseTaus(xmlText) {
  const out = [];
  if (!xmlText) return out;
  const re = /<TauJet\s+count="(\d+)"\s+storeGateKey="([^"]+)">([\s\S]*?)<\/TauJet>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const count = parseInt(m[1], 10);
    const key = m[2];
    const body = m[3];
    if (!count) continue;

    const etas = _readNums(body, 'eta');
    const phis = _readNums(body, 'phi');
    const pts = _readNums(body, 'pt');
    if (etas.length !== count || phis.length !== count) continue;

    const isTauString = _readStrings(body, 'isTauString');
    const trackIndex = _readNums(body, 'trackIndex');
    const trackKey = _readStrings(body, 'trackKey');
    const trackLinkCount = _readNums(body, 'trackLinkCount');
    const numTracks = _readNums(body, 'numTracks');

    let trkOffset = 0;
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

      out.push({
        eta: etas[i],
        phi: phis[i],
        ptGev: Number.isFinite(pts[i]) ? pts[i] : 0,
        isTau: isTauString?.[i] ?? '',
        numTracks: Number.isFinite(numTracks?.[i]) ? numTracks[i] : tracks.length,
        tracks,
        key,
      });
    }
  }
  return out;
}
