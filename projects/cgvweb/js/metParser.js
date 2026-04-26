// JS-side parser for <ETMis> (Missing Transverse Energy) blocks.
//
// JiveXML stores per collection:
//   <et>   — sumET, total transverse activity (NOT the MET magnitude)
//   <etx>  — MET vector x component (GeV)
//   <ety>  — MET vector y component (GeV)
// MET magnitude is sqrt(etx² + ety²); the misleading <et> field name in the
// XML is a JiveXML quirk worth keeping in mind for tooltips.
//
// Multiple variants per event (MET_Reference_AntiKt4EMPFlow_xAOD,
// MET_Reference_AntiKt4EMTopo_xAOD, MET_Calo_xAOD, ...). Returns them all so
// the caller (processXml) picks one — usually EMPFlow as the modern default.

function _readNum(body, tag) {
  const re = new RegExp(`<${tag}(?:\\s+multiple="[^"]+")?>([\\s\\S]*?)</${tag}>`);
  const m = body.match(re);
  if (!m) return NaN;
  const trimmed = m[1].trim();
  if (!trimmed) return NaN;
  // <ETMis count="1"> always has count=1, so first token is the value.
  return parseFloat(trimmed.split(/\s+/)[0]);
}

export function parseMet(xmlText) {
  const collections = [];
  if (!xmlText) return collections;
  const re = /<ETMis\s+count="\d+"\s+storeGateKey="([^"]+)">([\s\S]*?)<\/ETMis>/g;
  let m;
  while ((m = re.exec(xmlText)) !== null) {
    const key = m[1];
    const body = m[2];
    const et = _readNum(body, 'et');
    const etx = _readNum(body, 'etx');
    const ety = _readNum(body, 'ety');
    if (!Number.isFinite(etx) || !Number.isFinite(ety)) continue;
    collections.push({
      key,
      sumEt: Number.isFinite(et) ? et : 0,
      etx,
      ety,
      magnitude: Math.hypot(etx, ety),
    });
  }
  return collections;
}

// Picks the collection we render by default (EMPFlow when present).
const _PREFERRED_KEY = 'MET_Reference_AntiKt4EMPFlow_xAOD';
export function pickPreferredMet(collections) {
  if (!collections || !collections.length) return null;
  return collections.find((c) => c.key === _PREFERRED_KEY) ?? collections[0];
}
