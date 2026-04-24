// Physical η/φ coordinate helpers — mirror the formulas from parser/src/lib.rs
// so tooltip values match what the Rust WASM decoder produces.

// ── TileCal cell display label ────────────────────────────────────────────────
export function cellLabel(x, k) {
  switch (x) {
    case 1:
      return `A${k + 1}`;
    case 23:
      return `BC${k + 1}`;
    case 4:
      return `D${k}`;
    case 5:
      return `A${k + 12}`;
    case 6:
      return `B${k + 11}`;
    case 7:
      return `D${k + 5}`;
    case 8:
      return 'D4';
    case 9:
      return 'C10';
    case 10:
      return 'E1';
    case 11:
      return 'E2';
    case 12:
      return 'E3';
    case 13:
      return 'E4';
    default:
      return '?';
  }
}

// ── HEC group metadata ────────────────────────────────────────────────────────
export const HEC_NAMES = ['1', '23', '45', '67'];
export const HEC_INNER = [10, 10, 9, 8]; // inner η bins per group

// ── LAr EM ────────────────────────────────────────────────────────────────────
function _larEmGlobalEtaOffset(absbe, sampling, region) {
  if (absbe === 1 && sampling === 1 && region === 1) return 448;
  if (absbe === 1 && sampling === 2 && region === 1) return 56;
  if (absbe === 2 && sampling === 1 && region === 1) return 1;
  if (absbe === 2 && sampling === 1 && region === 2) return 4;
  if (absbe === 2 && sampling === 1 && region === 3) return 100;
  if (absbe === 2 && sampling === 1 && region === 4) return 148;
  if (absbe === 2 && sampling === 1 && region === 5) return 212;
  if (absbe === 2 && sampling === 2 && region === 1) return 1;
  if (absbe === 3 && sampling === 1 && region === 0) return 216;
  if (absbe === 3 && sampling === 2 && region === 0) return 44;
  return 0;
}
const _LAR_EM_ETA_TABLE = {
  '1,0,0': [0.0, 0.025],
  '1,1,0': [0.003125, 0.003125],
  '1,1,1': [1.4, 0.025],
  '1,2,0': [0.0, 0.025],
  '1,2,1': [1.4, 0.075],
  '1,3,0': [0.0, 0.05],
  '2,0,0': [1.5, 0.025],
  '2,1,0': [1.375, 0.05],
  '2,1,1': [1.425, 0.025],
  '2,1,2': [1.5, 0.003125],
  '2,1,3': [1.8, 0.004167],
  '2,1,4': [2.0, 0.00625],
  '2,1,5': [2.4, 0.025],
  '2,2,0': [1.375, 0.05],
  '2,2,1': [1.425, 0.025],
  '2,3,0': [1.5, 0.05],
  '3,1,0': [2.5, 0.1],
  '3,2,0': [2.5, 0.1],
};
export function physLarEmEta(be, sampling, region, globalEta) {
  const absbe = Math.abs(be);
  const offset = _larEmGlobalEtaOffset(absbe, sampling, region);
  const [eta0, deta] = _LAR_EM_ETA_TABLE[`${absbe},${sampling},${region}`] ?? [0.0, 0.1];
  const absEta = eta0 + (globalEta - offset) * deta + deta / 2;
  return be < 0 ? -absEta : absEta;
}
export function physLarEmPhi(be, sampling, region, phiIdx) {
  const absbe = Math.abs(be);
  let nPhi = 64;
  if (absbe === 1 && region === 1) nPhi = 256;
  else if (absbe === 1 && (sampling === 2 || sampling === 3)) nPhi = 256;
  else if (absbe === 2 && (sampling === 2 || sampling === 3)) nPhi = 256;
  return _wrapPhi(((phiIdx + 0.5) * 2 * Math.PI) / nPhi);
}

// ── LAr HEC ──────────────────────────────────────────────────────────────────
const _LAR_HEC_ETA_TABLE = {
  '0,0': [1.5, 0.1],
  '1,0': [1.5, 0.1],
  '2,0': [1.6, 0.1],
  '3,0': [1.7, 0.1],
  '0,1': [2.5, 0.2],
  '1,1': [2.5, 0.2],
  '2,1': [2.5, 0.2],
  '3,1': [2.5, 0.2],
};
export function physLarHecEta(be, sampling, region, etaIdx) {
  const [eta0, deta] = _LAR_HEC_ETA_TABLE[`${sampling},${region}`] ?? [1.5, 0.1];
  const absEta = eta0 + etaIdx * deta + deta / 2;
  return be < 0 ? -absEta : absEta;
}
export function physLarHecPhi(region, phiIdx) {
  return _wrapPhi(((phiIdx + 0.5) * 2 * Math.PI) / (region === 0 ? 64 : 32));
}

// ── TileCal ───────────────────────────────────────────────────────────────────
export function physTileEta(section, side, tower, sampling) {
  let absEta;
  if (section === 3) {
    if (tower === 8) absEta = 0.8;
    else if (tower === 9) absEta = 1.05;
    else if (tower === 10) absEta = 1.15;
    else if (tower === 11) absEta = 1.25;
    else if (tower === 13) absEta = 1.45;
    else if (tower === 15) absEta = 1.65;
    else absEta = 0.05 + 0.1 * tower;
  } else if (sampling === 2) {
    // D cells: Δη=0.2, each cell covers 2 towers → centre at k×0.2 where k=floor(tower/2)
    absEta = Math.floor(tower / 2) * 0.2;
  } else {
    absEta = 0.05 + 0.1 * tower;
  }
  return side < 0 ? -absEta : absEta;
}

export function _wrapPhi(phi) {
  return phi > Math.PI ? phi - 2 * Math.PI : phi;
}
export function physTilePhi(module) {
  return _wrapPhi(((module + 0.5) * 2 * Math.PI) / 64);
}
