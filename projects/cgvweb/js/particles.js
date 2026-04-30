// @ts-check
// Per-particle render barrel. Each particle class lives in its own file
// under js/particles/ — this module just re-exports the public API so the
// historical `from './particles.js'` imports stay working.
//
//   js/particles/_internal.js   shared infra (group disposers, η/φ-line +
//                               anchored-label builders, label-visibility
//                               sync, calo-cylinder constants).
//   js/particles/{tracks,photons,electrons,muons,clusters,jets,taus}.js
//                               one file per particle class — its draw* /
//                               clear* / sync* / get* functions and any
//                               class-private materials & constants.
//
// Adding a new particle class means a new file under js/particles/ and a
// re-export here; no other consumers need to change.

export { clearTracks, drawTracks } from './particles/tracks.js';
export { clearPhotons, drawPhotons } from './particles/photons.js';
export {
  clearElectrons,
  drawElectrons,
  syncElectronTrackMatch,
  getLastElectrons,
} from './particles/electrons.js';
export { clearMuons, drawMuons, syncMuonTrackMatch, getLastMuons } from './particles/muons.js';
export { clearClusters, drawClusters } from './particles/clusters.js';
export { clearJets, drawJets } from './particles/jets.js';
export { clearTaus, drawTaus, syncTauTrackMatch, getLastTaus } from './particles/taus.js';
export { syncParticleLabelVisibility } from './particles/_internal.js';
