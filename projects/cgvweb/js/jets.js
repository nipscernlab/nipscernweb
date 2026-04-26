// Jet state + collection picker.
//
// Holds the parsed jet collections for the current event and which one is
// currently displayed. Subscribers (drawing code, dropdown UI) listen for
// changes via onJetStateChange and re-read getActiveCollection().

// Coleção preferida quando a default existe no evento.
const _PREFERRED_KEY = 'AntiKt4EMTopoJets_xAOD';

let _collections = []; // [{ key, jets: [...] }]
let _activeKey = null;
const _listeners = new Set();

function _notify() {
  for (const cb of _listeners) cb();
}

export function getJetCollections() {
  return _collections;
}

export function getActiveJetKey() {
  return _activeKey;
}

export function getActiveJetCollection() {
  if (!_activeKey) return null;
  return _collections.find((c) => c.key === _activeKey) ?? null;
}

// Called from processXml when a new event lands. Replaces collections and
// re-elects an active key (preferred → first non-empty → null).
export function setJetCollections(list) {
  _collections = Array.isArray(list) ? list : [];
  const preferred = _collections.find((c) => c.key === _PREFERRED_KEY && c.jets.length);
  if (preferred) {
    _activeKey = preferred.key;
  } else {
    const firstNonEmpty = _collections.find((c) => c.jets.length);
    _activeKey = firstNonEmpty ? firstNonEmpty.key : null;
  }
  _notify();
}

export function setActiveJetKey(key) {
  if (key === _activeKey) return;
  if (!_collections.some((c) => c.key === key)) return;
  _activeKey = key;
  _notify();
}

export function clearJetState() {
  _collections = [];
  _activeKey = null;
  _notify();
}

export function onJetStateChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}
