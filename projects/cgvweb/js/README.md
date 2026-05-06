# `js/` module map

Navigation aid for the frontend codebase. Imports are explicit ES modules.
Folder structure mirrors the responsibility groups below:

```
js/
├── bootstrap/    — entry wiring (mode toolbar, scene init, layers panel, top toolbar)
├── i18n/         — translations (en / fr / no / pt) + language picker
├── modes/        — data-source modes (live / sample / server)
├── overlays/     — per-event extras drawn on top of the cells
├── parsers/      — JiveXML element parsers (one file per object type)
├── visibility/   — visibility-pipeline helpers; visibility.js orchestrates them
└── *.js          — core scene, UI, utils
```

The largest god-modules have been split into focused files; see `visibility.js`
and the modules under `visibility/` for an example.

## Entry & wiring

| Module | Role |
|---|---|
| `main.js` | App entry. Boots renderer + scene, wires every module together, registers shortcuts. |
| `bootstrap/sceneInit.js` | Asynchronous scene init (renderer, controls, lights, axes). |
| `bootstrap/modeWiring.js` | Connects the three data-source modes (live / sample / server) to the sidebar UI. |
| `bootstrap/topToolbar.js` | Wires the top toolbar (cinema, ghost, info, screenshot, lang…). |
| `bootstrap/layersPanel.js` | Renders + controls the floating Layers panel (per-detector visibility tree). |

## Core scene & state

| Module | Role |
|---|---|
| `renderer.js` | Three.js WebGLRenderer + scene + camera + dirty-flag rendering. |
| `renderLoop.js` | requestAnimationFrame loop, only renders when something changes. |
| `state.js` | Canonical cell-handle / active-map / WASM-pool state + ID encoders. |
| `viewLevel.js` | View-level (1/2/3) selector + change listeners. |
| `loader.js` | Loads `CaloGeometry.glb`, builds InstancedMeshes, registers cell handles. |
| `ghost.js` | Envelope "ghost" mesh visibility. |
| `slicer.js` | Cylindrical-wedge slicer controller (lets the user carve into the detector). |
| `minimap.js` | η×φ radar minimap. |
| `labelSprite.js` | Text-as-canvas sprite helper. |
| `outlines.js` | Cell-edge outline rendering. |

## Visibility pipeline

The previously-monolithic `visibility.js` was split into focused modules; it is
now the orchestrator that wires the rest together.

| Module | Role | `@ts-check` |
|---|---|---|
| `visibility.js` | `apply*Threshold` loops, slicer mask, show-all sweep, view-level gate. Top-level orchestrator that re-exports the helpers below. | ✅ |
| `visibility/layerVis.js` | Panel state tree + `isLayerOn(handle)` dispatcher. | ✅ |
| `visibility/thresholds.js` | Mutable threshold scalars (cell MeV, track/cluster/jet GeV) + slider ranges. | ✅ |
| `visibility/detectorGroups.js` | Per-event Three.js group registry (track / photon / electron / muon / cluster / jet / τ / MET / vertex). | ✅ |
| `visibility/clusterFilter.js` | Level-2/3 cell-membership filter (which cells belong to a passing cluster/jet). | ✅ |
| `visibility/muonVisibility.js` | Atlas-tree A/C-side mirror; writes `userData.muonForceVisible`. | ✅ |
| `visibility/fcalRenderer.js` | FCAL per-event InstancedMesh + outline rebuild (FCAL has no static handles). | ✅ |
| `cellClassifier.js` | Mesh-name → `{det, subDet, sampling}` routing tags. | ✅ |
| `coords.js` | η/φ formulas (mirror of `parser/src/lib.rs`). | ✅ |
| `palette.js` | Energy → RGB colour tables per detector. | ✅ |

## XML processing

| Module | Role |
|---|---|
| `processXml.js` | Top-level XML pipeline orchestrator (called from each mode). |
| `wasm_worker.js` | Web Worker that runs the Rust/WASM ATLAS-ID decoder. |
| `parsers/jetParser.js` | `<Jet>` parser. |
| `parsers/metParser.js` | `<ETMis>` parser. |
| `parsers/muonParser.js` | `<Muon>` parser. |
| `parsers/tauParser.js` | `<TauJet>` parser. |
| `parsers/vertexParser.js` | `<RVx>` (reconstructed vertex) parser. |
| `parsers/hitsParser.js` | Inner-detector + muon-chamber hit positions. |
| `particles.js` | Photon / electron / muon / τ / MET data + label sprites. |
| `jets.js` | Active jet-collection state + change listeners. |
| `trackAtlasIntersections.js` | Track ↔ muon-chamber raycast (ANDs with `userData.muonForceVisible`). |

## Overlays (per-event extras drawn on top of the cells)

| Module | Role |
|---|---|
| `overlays/hitsOverlay.js` | Pixel / SCT / TRT / muon-chamber hit markers on hover. |
| `overlays/metOverlay.js` | MET arrow + label. |
| `overlays/vertexOverlay.js` | Reconstructed-vertex markers. |

## UI (panels, controls, popups)

| Module | Role |
|---|---|
| `sidebarControls.js` | Left-sidebar pin / auto-open behaviour. |
| `panelResize.js` | Resizable side panels. |
| `detectorPanels.js` | Right-side per-detector threshold panel (sliders + tabs). |
| `hoverTooltip.js` | Hover tooltip (cell / track / jet / vertex / MET). |
| `tooltipRows.js` | Pure HTML builder for the hover tooltip's extra rows (XSS-safe). |
| `statusHud.js` | Top-right HUD (run / event / lumi / timestamp). |
| `buttonTooltips.js` | Tooltip on toolbar button hover. |
| `mobileToolbar.js` | Mobile toolbar layout. |
| `viewerShortcuts.js` | Keyboard shortcuts (T/L/H/F/J/K/I/G/...). |
| `colorpicker.js` | Background-colour popover. |

## Modes (data sources)

| Module | Role |
|---|---|
| `modes/liveMode.js` | Polls ATLAS Live (ATLANTIS) feed via Cloudflare Worker proxy. |
| `modes/sampleMode.js` | Built-in JiveXML samples + user-uploaded XML. |
| `modes/serverMode.js` | Local folder via File System Access API or remote `/api/xml/*`. |

## Effects / chrome

| Module | Role |
|---|---|
| `cinema.js` | Cinema-mode auto-camera tour. |
| `screenshot.js` | Screenshot capture (with optional collision-info overlay). |
| `loadingScreen.js` | Initial loading-screen progress bar + request counter. |
| `downloadProgress.js` | Per-download progress UI for the live feed. |

## i18n

`i18n/translations.js` aggregates `i18n/locales/{en,fr,no,pt}.js`. `en.js` is
the source of truth — `tests/i18nCoverage.test.mjs` fails CI when any other
locale drops a key. `i18n/index.js` exposes `t(key)`, `initLanguage()`, and
the language-picker setup.

## Pure utilities

| Module | Role |
|---|---|
| `utils.js` | `fmtMev`, `esc`, `addCleanupListener`, `makeRelTime`, `dateGroup`. |

## Test coverage

Pure modules have vitest specs in `tests/`:
- `tests/keys.test.mjs` — cell-key encoders (`state.js`)
- `tests/utils.test.mjs` — utility helpers (`utils.js`)
- `tests/layerVis.test.mjs` — panel state tree (`layerVis.js`)
- `tests/isLayerOn.test.mjs` — handle → visibility dispatcher (`layerVis.js`)
- `tests/cellClassifier.test.mjs` — mesh-name router (`cellClassifier.js`)
- `tests/tooltipRows.test.mjs` — tooltip row builder + XSS guard (`tooltipRows.js`)
- `tests/i18nCoverage.test.mjs` — i18n key drift across locales

Modules that touch Three.js / DOM / scene aren't covered yet — they would
need jsdom + module mocking, which the project chose not to invest in (the
SPA never re-runs `setup*`, so the practical risk is low).
