import * as THREE         from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import wasmInit, { parse_atlas_id } from '../parser/pkg/atlas_id_parser.js';

let LivePoller = null;
try { ({ LivePoller } = await import('../live_atlas/live_cern/live_poller.js')); } catch (_) {}

// ── i18n ─────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    'logo-full': 'Calorimeter Geometry Viewer', 'logo-lab': 'NIPSCERN · ATLAS',
    'btn-live': 'Live', 'btn-local': 'Local', 'btn-sample': 'Samples',
    'sample-loading': 'Loading events…', 'sample-empty': 'No sample events found.',
    'sample-error': 'Error loading event list.',
    'live-starting': 'Starting…', 'live-polling': 'Polling…', 'live-same': 'Up to date',
    'live-fetching': 'Fetching…', 'live-error': 'Error', 'live-stopped': 'Stopped',
    'local-folder': 'Select Folder', 'local-or': 'or', 'local-upload': 'Upload XML',
    'log-title': 'Session Log', 'status-init': 'Initializing…',
    'status-ready': 'Ready — waiting for event…',
    'cinema-exit': 'Exit Cinema',
    'slbl-energy': 'Energy', 'slbl-threshold': 'Threshold', 'thr-placeholder': 'e.g. 200 MeV',
    'about-title': 'Calorimeter Geometry Viewer', 'about-sub': 'ATLAS · TileCal · NIPSCERN',
    'about-p1': 'Interactive 3D visualization of the ATLAS calorimeter providing real-time display of TileCal cell energies from live or local JiveXML event data.',
    'about-advisor-lbl': 'Scientific Advisor', 'about-advisor-name': 'Prof. Dr. Luciano Manhães de Andrade Filho',
    'about-dev-lbl': 'Development', 'about-dev-name': 'Chrysthofer Arthur Amaro Afonso',
    'about-dev-sub': 'Undergraduate Research · NIPSCERN Laboratory',
    'about-lab1': 'NIPSCERN — Núcleo de Investigação em Física para o CERN',
    'about-lab2': 'ATLAS Collaboration · CERN, Geneva',
    'about-close': 'Close', 'tip-energy-key': 'Energy',
    'tip-panel': 'Toggle the sidebar panel',
    'tip-cinema': 'Cinema mode — auto-rotation, hide UI',
    'tip-ghost': 'ATLAS ghost — toggle sub-detector outlines',
    'tip-info': 'Cell info — show tooltip and outline on hover',
    'tip-beam': 'Beam axis — show Z-axis N/S direction cones',
    'tip-lang': 'Switch display language',
    'tip-shot': 'Save screenshot — choose resolution',
    'tip-reset': 'Reset camera to default position',
    'tip-about': 'About this project', 'tip-pin': 'Pin panel open at all times',
    'tip-poll-play': 'Resume live polling', 'tip-poll-stop': 'Pause live polling',
    'shot-title': 'Save Screenshot',
    'shot-sub': 'Select resolution. The scene renders at full quality — UI is hidden. The active tooltip is composited if visible.',
    'shot-cancel': 'Cancel', 'shot-save': 'Save PNG',
    'shot-rendering': 'Rendering {w}×{h}…',
    'shot-done': 'PNG saved — download started',
    'shot-error': 'Error: {msg}',
    'just-now': 'just now', 's-ago': 's ago', 'm-ago': 'm ago', 'h-ago': 'h ago',
    'log-glb-loaded': 'CaloGeometry.glb loaded',
    'log-glb-notfound': 'CaloGeometry.glb not found',
    'log-wasm-ready': 'WASM ID parser ready',
    'log-wasm-error': 'WASM error: ',
    'log-poller-init': 'Live poller initialized',
    'log-poller-unavail': 'Live poller unavailable — local mode',
    'log-poll-resumed': 'Polling resumed',
    'log-poll-paused': 'Polling paused',
    'log-poll-error': 'Polling error',
    'log-no-xml': 'No XML files found in selected folder',
    'log-folder-loaded': 'Folder loaded: {n} XML file(s)',
    'log-loading': 'Loading: ',
    'log-read-error': 'Read error: ',
    'log-live-download': 'Downloading new event from live feed',
    'log-new-event': 'New event: ',
    'log-downloading': 'Downloading: ',
    'log-event': 'Event: ',
  },
  fr: {
    'logo-full': 'Visionneur de Géométrie Calorimétrique', 'logo-lab': 'NIPSCERN · ATLAS',
    'btn-live': 'Direct', 'btn-local': 'Local', 'btn-sample': 'Exemples',
    'sample-loading': 'Chargement des événements…', 'sample-empty': 'Aucun événement exemple trouvé.',
    'sample-error': 'Erreur lors du chargement de la liste.',
    'live-starting': 'Démarrage…', 'live-polling': 'Interrogation…', 'live-same': 'À jour',
    'live-fetching': 'Récupération…', 'live-error': 'Erreur', 'live-stopped': 'Arrêté',
    'local-folder': 'Sélectionner un dossier', 'local-or': 'ou', 'local-upload': 'Charger XML',
    'log-title': 'Journal de session', 'status-init': 'Initialisation…',
    'status-ready': 'Prêt — en attente d\'événement…',
    'cinema-exit': 'Quitter le cinéma',
    'slbl-energy': 'Énergie', 'slbl-threshold': 'Seuil', 'thr-placeholder': 'ex. 200 MeV',
    'about-title': 'Visionneur de Géométrie Calorimétrique', 'about-sub': 'ATLAS · TileCal · NIPSCERN',
    'about-p1': 'Visualisation 3D interactive du calorimètre ATLAS affichant en temps réel les énergies des cellules TileCal à partir de données JiveXML en direct ou locales.',
    'about-advisor-lbl': 'Conseiller scientifique', 'about-advisor-name': 'Prof. Dr. Luciano Manhães de Andrade Filho',
    'about-dev-lbl': 'Développement', 'about-dev-name': 'Chrysthofer Arthur Amaro Afonso',
    'about-dev-sub': 'Recherche de premier cycle · Laboratoire NIPSCERN',
    'about-lab1': 'NIPSCERN — Núcleo de Investigação em Física para o CERN',
    'about-lab2': 'Collaboration ATLAS · CERN, Genève',
    'about-close': 'Fermer', 'tip-energy-key': 'Énergie',
    'tip-panel': 'Afficher/masquer le panneau latéral',
    'tip-cinema': 'Mode cinéma — rotation automatique, UI masquée',
    'tip-ghost': 'Fantôme ATLAS — activer/désactiver les contours',
    'tip-info': 'Info cellule — infobulle et contour au survol',
    'tip-beam': 'Axe faisceau — indicateurs N/S sur l\'axe Z',
    'tip-lang': 'Changer la langue d\'affichage',
    'tip-shot': 'Enregistrer une capture d\'écran',
    'tip-reset': 'Réinitialiser la caméra à la position par défaut',
    'tip-about': 'À propos de ce projet', 'tip-pin': 'Épingler le panneau visible',
    'tip-poll-play': 'Reprendre l\'interrogation en direct', 'tip-poll-stop': 'Suspendre l\'interrogation en direct',
    'shot-title': 'Enregistrer une capture',
    'shot-sub': 'Sélectionnez la résolution. La scène est rendue en pleine qualité — l\'interface est masquée. Le tooltip actif est composité si visible.',
    'shot-cancel': 'Annuler', 'shot-save': 'Enregistrer PNG',
    'shot-rendering': 'Rendu {w}×{h}…',
    'shot-done': 'PNG enregistré — téléchargement lancé',
    'shot-error': 'Erreur : {msg}',
    'just-now': 'à l\'instant', 's-ago': 's', 'm-ago': ' min', 'h-ago': ' h',
    'log-glb-loaded': 'CaloGeometry.glb chargé',
    'log-glb-notfound': 'CaloGeometry.glb introuvable',
    'log-wasm-ready': 'Parser WASM prêt',
    'log-wasm-error': 'Erreur WASM : ',
    'log-poller-init': 'Interrogateur en direct initialisé',
    'log-poller-unavail': 'Interrogateur indisponible — mode local',
    'log-poll-resumed': 'Interrogation reprise',
    'log-poll-paused': 'Interrogation suspendue',
    'log-poll-error': 'Erreur d\'interrogation',
    'log-no-xml': 'Aucun fichier XML trouvé dans le dossier',
    'log-folder-loaded': 'Dossier chargé : {n} fichier(s) XML',
    'log-loading': 'Chargement : ',
    'log-read-error': 'Erreur de lecture : ',
    'log-live-download': 'Téléchargement du nouvel événement en direct',
    'log-new-event': 'Nouvel événement : ',
    'log-downloading': 'Téléchargement : ',
    'log-event': 'Événement : ',
  },
  no: {
    'logo-full': 'Kalorimeter Geometri Visning', 'logo-lab': 'NIPSCERN · ATLAS',
    'btn-live': 'Direkte', 'btn-local': 'Lokal', 'btn-sample': 'Eksempler',
    'sample-loading': 'Laster hendelser…', 'sample-empty': 'Ingen eksempelhendelser funnet.',
    'sample-error': 'Feil ved lasting av listen.',
    'live-starting': 'Starter…', 'live-polling': 'Henter data…', 'live-same': 'Oppdatert',
    'live-fetching': 'Laster ned…', 'live-error': 'Feil', 'live-stopped': 'Stoppet',
    'local-folder': 'Velg mappe', 'local-or': 'eller', 'local-upload': 'Last opp XML',
    'log-title': 'Øktlogg', 'status-init': 'Initialiserer…',
    'status-ready': 'Klar — venter på hendelse…',
    'cinema-exit': 'Avslutt kino',
    'slbl-energy': 'Energi', 'slbl-threshold': 'Terskel', 'thr-placeholder': 'f.eks. 200 MeV',
    'about-title': 'Kalorimeter Geometri Visning', 'about-sub': 'ATLAS · TileCal · NIPSCERN',
    'about-p1': 'Interaktiv 3D-visualisering av ATLAS-kalorimeteret som viser TileCal-celleenergier i sanntid fra levende eller lokale JiveXML-hendelsesdata.',
    'about-advisor-lbl': 'Vitenskapelig veileder', 'about-advisor-name': 'Prof. Dr. Luciano Manhães de Andrade Filho',
    'about-dev-lbl': 'Utvikling', 'about-dev-name': 'Chrysthofer Arthur Amaro Afonso',
    'about-dev-sub': 'Bachelorsforskning · NIPSCERN-laboratoriet',
    'about-lab1': 'NIPSCERN — Núcleo de Investigação em Física para o CERN',
    'about-lab2': 'ATLAS-samarbeidet · CERN, Genève',
    'about-close': 'Lukk', 'tip-energy-key': 'Energi',
    'tip-panel': 'Vis/skjul sidepanelet',
    'tip-cinema': 'Kinomodus — autorotasjon, skjul grensesnitt',
    'tip-ghost': 'ATLAS-spøkelse — slå av/på underdetektoromriss',
    'tip-info': 'Celleinformasjon — verktøytips og omriss ved hover',
    'tip-beam': 'Stråleaksen — vis N/S-konuser på Z-aksen',
    'tip-lang': 'Bytt visningsspråk',
    'tip-shot': 'Lagre skjermbilde — velg oppløsning',
    'tip-reset': 'Tilbakestill kamera til standardposisjon',
    'tip-about': 'Om dette prosjektet', 'tip-pin': 'Fest panelet alltid synlig',
    'tip-poll-play': 'Gjenoppta live-henting', 'tip-poll-stop': 'Sett live-henting på pause',
    'shot-title': 'Lagre skjermbilde',
    'shot-sub': 'Velg oppløsning. Scenen gjengis i full kvalitet — grensesnittet er skjult. Aktivt verktøytips legges over hvis synlig.',
    'shot-cancel': 'Avbryt', 'shot-save': 'Lagre PNG',
    'shot-rendering': 'Gjengir {w}×{h}…',
    'shot-done': 'PNG lagret — nedlasting startet',
    'shot-error': 'Feil: {msg}',
    'just-now': 'akkurat nå', 's-ago': ' s siden', 'm-ago': ' min siden', 'h-ago': ' t siden',
    'log-glb-loaded': 'CaloGeometry.glb lastet inn',
    'log-glb-notfound': 'CaloGeometry.glb ikke funnet',
    'log-wasm-ready': 'WASM ID-parser klar',
    'log-wasm-error': 'WASM-feil: ',
    'log-poller-init': 'Live-henter initialisert',
    'log-poller-unavail': 'Live-henting utilgjengelig — lokal modus',
    'log-poll-resumed': 'Henting gjenopptatt',
    'log-poll-paused': 'Henting satt på pause',
    'log-poll-error': 'Hentingsfeil',
    'log-no-xml': 'Ingen XML-filer funnet i valgt mappe',
    'log-folder-loaded': 'Mappe lastet: {n} XML-fil(er)',
    'log-loading': 'Laster: ',
    'log-read-error': 'Lesfeil: ',
    'log-live-download': 'Laster ned ny hendelse fra live-strøm',
    'log-new-event': 'Ny hendelse: ',
    'log-downloading': 'Laster ned: ',
    'log-event': 'Hendelse: ',
  },
  pt: {
    'logo-full': 'Visualizador de Geometria do Calorímetro', 'logo-lab': 'NIPSCERN · ATLAS',
    'btn-live': 'Ao Vivo', 'btn-local': 'Local', 'btn-sample': 'Amostras',
    'sample-loading': 'Carregando eventos…', 'sample-empty': 'Nenhum evento de amostra encontrado.',
    'sample-error': 'Erro ao carregar a lista de eventos.',
    'live-starting': 'Iniciando…', 'live-polling': 'Verificando…', 'live-same': 'Atualizado',
    'live-fetching': 'Baixando…', 'live-error': 'Erro', 'live-stopped': 'Parado',
    'local-folder': 'Selecionar Pasta', 'local-or': 'ou', 'local-upload': 'Enviar XML',
    'log-title': 'Log de Sessão', 'status-init': 'Inicializando…',
    'status-ready': 'Pronto — aguardando evento…',
    'cinema-exit': 'Sair do Cinema',
    'slbl-energy': 'Energia', 'slbl-threshold': 'Limiar', 'thr-placeholder': 'ex. 200 MeV',
    'about-title': 'Visualizador de Geometria do Calorímetro', 'about-sub': 'ATLAS · TileCal · NIPSCERN',
    'about-p1': 'Visualização 3D interativa do calorímetro ATLAS com exibição em tempo real das energias das células TileCal a partir de dados JiveXML ao vivo ou locais.',
    'about-advisor-lbl': 'Orientador Científico', 'about-advisor-name': 'Prof. Dr. Luciano Manhães de Andrade Filho',
    'about-dev-lbl': 'Desenvolvimento', 'about-dev-name': 'Chrysthofer Arthur Amaro Afonso',
    'about-dev-sub': 'Iniciação Científica · Laboratório NIPSCERN',
    'about-lab1': 'NIPSCERN — Núcleo de Investigação em Física para o CERN',
    'about-lab2': 'Colaboração ATLAS · CERN, Genebra',
    'about-close': 'Fechar', 'tip-energy-key': 'Energia',
    'tip-panel': 'Mostrar/ocultar painel lateral',
    'tip-cinema': 'Modo cinema — rotação automática, ocultar interface',
    'tip-ghost': 'ATLAS fantasma — ativar/desativar contornos dos subdetectores',
    'tip-info': 'Info da célula — tooltip e contorno ao passar o mouse',
    'tip-beam': 'Eixo do feixe — cones N/S no eixo Z',
    'tip-lang': 'Mudar idioma de exibição',
    'tip-shot': 'Salvar captura de tela — escolher resolução',
    'tip-reset': 'Redefinir câmera para posição padrão',
    'tip-about': 'Sobre este projeto', 'tip-pin': 'Fixar painel sempre visível',
    'tip-poll-play': 'Retomar monitoramento ao vivo', 'tip-poll-stop': 'Pausar monitoramento ao vivo',
    'shot-title': 'Salvar Captura de Tela',
    'shot-sub': 'Selecione a resolução. A cena é renderizada em qualidade máxima — a interface é ocultada. O tooltip ativo é composto se visível.',
    'shot-cancel': 'Cancelar', 'shot-save': 'Salvar PNG',
    'shot-rendering': 'Renderizando {w}×{h}…',
    'shot-done': 'PNG salvo — download iniciado',
    'shot-error': 'Erro: {msg}',
    'just-now': 'agora mesmo', 's-ago': 's atrás', 'm-ago': ' min atrás', 'h-ago': ' h atrás',
    'log-glb-loaded': 'CaloGeometry.glb carregado',
    'log-glb-notfound': 'CaloGeometry.glb não encontrado',
    'log-wasm-ready': 'Parser WASM pronto',
    'log-wasm-error': 'Erro WASM: ',
    'log-poller-init': 'Monitoramento ao vivo iniciado',
    'log-poller-unavail': 'Monitoramento indisponível — modo local',
    'log-poll-resumed': 'Monitoramento retomado',
    'log-poll-paused': 'Monitoramento pausado',
    'log-poll-error': 'Erro no monitoramento',
    'log-no-xml': 'Nenhum arquivo XML encontrado na pasta',
    'log-folder-loaded': 'Pasta carregada: {n} arquivo(s) XML',
    'log-loading': 'Carregando: ',
    'log-read-error': 'Erro de leitura: ',
    'log-live-download': 'Baixando novo evento do feed ao vivo',
    'log-new-event': 'Novo evento: ',
    'log-downloading': 'Baixando: ',
    'log-event': 'Evento: ',
  },
};

let currentLang = 'en';
function t(key) {
  return (TRANSLATIONS[currentLang] ?? TRANSLATIONS.en)[key]
      ?? TRANSLATIONS.en[key]
      ?? key;
}

function applyLang(lang) {
  currentLang = lang;
  const htmlLang = { no: 'nb', pt: 'pt-BR' };
  document.documentElement.lang = htmlLang[lang] ?? lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n); if (v) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-tip]').forEach(el => {
    const v = t(el.dataset.i18nTip); if (v) el.dataset.tip = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const v = t(el.dataset.i18nPh); if (v) el.placeholder = v;
  });
  document.querySelectorAll('.lang-opt').forEach(o =>
    o.classList.toggle('on', o.dataset.lang === lang)
  );
  localStorage.setItem('cgv-lang', lang);
}

// Auto-detect language
{
  const saved   = localStorage.getItem('cgv-lang');
  const browser = (navigator.language ?? 'en').split('-')[0].replace('nb','no').replace('nn','no');
  const initial = saved ?? (['en','fr','no','pt'].includes(browser) ? browser : 'en');
  applyLang(initial);
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PAL_N   = 2048;
const DEF_THR = 200;

// ── Unmapped cells log buffer ─────────────────────────────────────────────────
const _missLog = [];

// ── State ─────────────────────────────────────────────────────────────────────
const meshByName = new Map();
const origMat    = new Map();
let   active     = new Map();
let   rayTargets = [];
let tileMaxMev = 1, tileMinMev = 0;
let larMaxMev  = 1, larMinMev  = 0;
let hecMaxMev  = 1, hecMinMev  = 0;
let thrTileMev = DEF_THR;
let thrLArMev  = DEF_THR;
let thrHecMev  = 1000; // 1 GeV default (HEC energies are typically higher)
let showHec    = true;
let wasmOk     = false;
let sceneOk    = false;
let dirty      = true;
let curEvtId   = null;
let isLive     = true;
let showInfo   = true;
let cinemaMode = false;
let showTile   = true;
let showLAr    = true;
let showGhostTile = false, showGhostLAr = false, showGhostHec = false;
let beamGroup  = null;
let beamOn     = false;
let panelPinned  = true;
let panelHovered = false;
let reqCount     = 0;
let allOutlinesMesh = null;
let _readyFired  = false;

// ── Loading screen helpers ─────────────────────────────────────────────────────
const _loadBar = document.getElementById('loading-bar');
const _loadMsg = document.getElementById('loading-msg');
function setLoadProgress(pct, msg) {
  if (_loadBar) _loadBar.style.width = Math.round(pct) + '%';
  if (_loadMsg) _loadMsg.textContent = msg;
}
function dismissLoadingScreen() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('done');
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 750);
}

// ── Session log ───────────────────────────────────────────────────────────────
const logListEl = document.getElementById('log-list');
const reqBadge  = document.getElementById('req-badge');
function addLog(msg, type = '') {
  const ts = new Date().toLocaleTimeString(document.documentElement.lang || 'en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const el = document.createElement('div');
  el.className = 'logrow' + (type ? ' ' + type : '');
  el.textContent = `[${ts}] ${msg}`;
  el.title = el.textContent;
  logListEl.prepend(el);
  while (logListEl.children.length > 60) logListEl.lastElementChild.remove();
}
function bumpReq(label = '') {
  reqCount++;
  reqBadge.textContent = `${reqCount} req`;
  if (label) addLog(label);
}

// ── Palette TILE: #ffff00 (min) → #800000 (max), linear ──────────────────────
function palColorTile(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    1.000 + t * (0.502 - 1.000), // R: 1.0 → 0.502
    1.000 + t * (0.000 - 1.000), // G: 1.0 → 0.0
    0.0                           // B: always 0
  );
}
const PAL_TILE = Array.from({ length: PAL_N }, (_, i) => {
  const c = palColorTile(i / (PAL_N - 1));
  return new THREE.MeshPhongMaterial({
    color: c, emissive: c, emissiveIntensity: 0.42,
    shininess: 6, side: THREE.FrontSide,
  });
});
const TILE_SCALE = 2000; // MeV — fixed 0–2 GeV
function palMatTile(eMev) {
  const tv = Math.max(0, Math.min(1, eMev / TILE_SCALE));
  return PAL_TILE[Math.round(tv * (PAL_N - 1))];
}

// ── Palette HEC: #66e0f6 (min) → #0c0368 (max), linear ──────────────────────
// #66e0f6 = [102,224,246]/255 = [0.4000,0.8784,0.9647]
// #0c0368 = [12,3,104]/255   = [0.0471,0.0118,0.4078]
function palColorHec(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.4000 + t * (0.0471 - 0.4000), // R: ~0.40 → ~0.05
    0.8784 + t * (0.0118 - 0.8784), // G: ~0.88 → ~0.01
    0.9647 + t * (0.4078 - 0.9647)  // B: ~0.96 → ~0.41
  );
}
const PAL_HEC = Array.from({ length: PAL_N }, (_, i) =>
  new THREE.MeshPhongMaterial({
    color: palColorHec(i / (PAL_N - 1)),
    emissive: palColorHec(i / (PAL_N - 1)), emissiveIntensity: 0.30,
    shininess: 20, side: THREE.FrontSide,
  })
);
const HEC_SCALE = 5000; // MeV — fixed 0–5 GeV; values above 5 GeV → max colour
function palMatHec(eMev) {
  const tv = Math.max(0, Math.min(1, eMev / HEC_SCALE));
  return PAL_HEC[Math.round(tv * (PAL_N - 1))];
}

// ── Palette LAr: #17cf42 (min) → #270042 (max), linear ───────────────────────
// #17cf42 = [23,207,66]/255 = [0.0902,0.8118,0.2588]
// #270042 = [39,0,66]/255   = [0.1529,0.0000,0.2588]
function palColorLAr(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.0902 + t * (0.1529 - 0.0902), // R: ~0.09 → ~0.15
    0.8118 + t * (0.0000 - 0.8118), // G: ~0.81 → 0
    0.2588                           // B: constant
  );
}
const PAL_LAR = Array.from({ length: PAL_N }, (_, i) =>
  new THREE.MeshPhongMaterial({
    color: palColorLAr(i / (PAL_N - 1)),
    shininess: 25, side: THREE.FrontSide,
  })
);
const LAR_SCALE = 1000; // MeV — fixed 0–1 GeV
function palMatLAr(eMev) {
  const tv = Math.max(0, Math.min(1, eMev / LAR_SCALE));
  return PAL_LAR[Math.round(tv * (PAL_N - 1))];
}

// ── Ghost — TileCal only ──────────────────────────────────────────────────────
// Solid envelope meshes from .glb + procedural phi-segmentation lines.
const GHOST_TILE_NAMES = [
  'Calorimeter→LBTile_0','Calorimeter→LBTileLArg_0',
  'Calorimeter→EBTilep_0','Calorimeter→EBTilen_0',
  'Calorimeter→EBTileHECp_0','Calorimeter→EBTileHECn_0',
];

// Mutable ghost colours / opacity (updated by UI controls)
// RGB(92,95,102) = #5C5F66; 90% transparency = 10% opacity
let ghostSolidColor = 0x5C5F66;
let ghostPhiColor   = 0xFFFFFF;
let ghostSolidOpacity = 0.10;  // 90% transparent

const ghostSolidMat = new THREE.MeshBasicMaterial({
  color: ghostSolidColor, transparent: true, opacity: ghostSolidOpacity,
  depthWrite: false, side: THREE.DoubleSide,
});
const ghostPhiMat = new THREE.LineBasicMaterial({
  color: ghostPhiColor, transparent: true, opacity: ghostSolidOpacity, depthWrite: false,
});

// ── Phi-segmentation lines (TileCal) ─────────────────────────────────────────
// 64 radial planes in φ, each as a rectangle: 4 edges at r_inner → r_outer,
// spanning z_min → z_max of each TileCal barrel+ext-barrel envelope.
// Geometry constants (mm) from the ATLAS TileCal geometry:
//   LB  : r_in=2288  r_out=3835  z = ±2820
//   EB p: r_in=2288  r_out=3835  z = [3600, 6050]
//   EB n: r_in=2288  r_out=3835  z = [-6050, -3600]
const TILE_PHI_SEGS = [
  { rIn: 2288, rOut: 3835, zMin: -2820, zMax:  2820 },  // LB
  { rIn: 2288, rOut: 3835, zMin:  3600, zMax:  6050 },  // EB+
  { rIn: 2288, rOut: 3835, zMin: -6050, zMax: -3600 },  // EB-
];
const N_PHI = 64;
let ghostPhiGroup = null;

function buildPhiLines() {
  if (ghostPhiGroup) { scene.remove(ghostPhiGroup); ghostPhiGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  ghostPhiGroup = new THREE.Group();
  ghostPhiGroup.renderOrder = 6;
  ghostPhiGroup.visible = false;
  for (let i = 0; i < N_PHI; i++) {
    const phi = (i / N_PHI) * Math.PI * 2;
    const cx = Math.cos(phi), cy = Math.sin(phi);
    for (const { rIn, rOut, zMin, zMax } of TILE_PHI_SEGS) {
      const pts = [
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMin),
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMax),
        new THREE.Vector3(cx * rOut, cy * rOut, zMax),
        new THREE.Vector3(cx * rOut, cy * rOut, zMin),
        new THREE.Vector3(cx * rIn,  cy * rIn,  zMin),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      ghostPhiGroup.add(new THREE.Line(geo, ghostPhiMat));
    }
  }
  scene.add(ghostPhiGroup);
}

function applyGhostMesh(visible) {
  for (const name of GHOST_TILE_NAMES) {
    const mesh = meshByName.get(name);
    if (!mesh) continue;
    if (visible) {
      mesh.material  = ghostSolidMat;
      mesh.renderOrder = 5;
      mesh.visible   = true;
    } else {
      mesh.material  = origMat.get(name) ?? mesh.material;
      mesh.renderOrder = 0;
      mesh.visible   = false;
    }
  }
  if (ghostPhiGroup) ghostPhiGroup.visible = visible;
  dirty = true;
}

function toggleGhostType(type) {
  // Only TILE is active; ignore lar/hec calls silently
  if (type !== 'tile') return;
  showGhostTile = !showGhostTile;
  buildPhiLines();
  applyGhostMesh(showGhostTile);
  const btn = document.getElementById('gtog-tile');
  btn.classList.toggle('on', showGhostTile);
  btn.setAttribute('aria-checked', showGhostTile);
  document.getElementById('btn-ghost').classList.toggle('on', showGhostTile);
}

function toggleAllGhosts() {
  const next = !showGhostTile;
  showGhostTile = next;
  showGhostLAr = false; showGhostHec = false;
  buildPhiLines();
  applyGhostMesh(next);
  const btn = document.getElementById('gtog-tile');
  btn.classList.toggle('on', next);
  btn.setAttribute('aria-checked', next);
  document.getElementById('btn-ghost').classList.toggle('on', next);
}

function updateGhostColors() {
  ghostSolidMat.color.set(ghostSolidColor);
  ghostSolidMat.opacity = ghostSolidOpacity;
  ghostPhiMat.opacity   = ghostSolidOpacity;
  ghostPhiMat.color.set(ghostPhiColor);
  if (ghostPhiGroup) ghostPhiGroup.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  dirty = true;
}

// ── Ghost UI controls ─────────────────────────────────────────────────────────
document.getElementById('ghost-alpha-slider').addEventListener('input', e => {
  const pct = parseInt(e.target.value);
  document.getElementById('ghost-alpha-val').textContent = pct + '%';
  ghostSolidOpacity = (100 - pct) / 100;  // pct = transparency%; 90% → 0.10 opacity
  updateGhostColors();
});

function hexToInt(hex) { return parseInt(hex.replace('#',''), 16); }

document.getElementById('ghost-solid-color').addEventListener('input', e => {
  ghostSolidColor = hexToInt(e.target.value);
  document.getElementById('ghost-solid-swatch').style.background = e.target.value;
  updateGhostColors();
});
document.getElementById('ghost-solid-color').addEventListener('click', e => e.stopPropagation());
document.getElementById('ghost-solid-swatch').closest('label').addEventListener('click', () => {
  document.getElementById('ghost-solid-color').click();
});

document.getElementById('ghost-phi-color').addEventListener('input', e => {
  ghostPhiColor = hexToInt(e.target.value);
  document.getElementById('ghost-phi-swatch').style.background = e.target.value;
  updateGhostColors();
});
document.getElementById('ghost-phi-swatch').closest('label').addEventListener('click', () => {
  document.getElementById('ghost-phi-color').click();
});

// Legacy compatibility — no-op for lar/hec since switches are removed
const GHOST_MATS  = {};  // kept to avoid reference errors
const GHOST_NAMES = { tile: GHOST_TILE_NAMES, lar: [], hec: [] };

// ── Renderer ──────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', precision: 'mediump', preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = false;

// ── Scene / Camera / Controls ─────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020d1c);
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 10, 100_000);
camera.position.set(0, 0, 12_000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.14;   // faster stop (~2.5× quicker than 0.055)
controls.zoomSpeed     = 1.2;
// Only clear tooltip while the user is *actively* dragging/panning/zooming.
// During the damped deceleration phase (after release) we let the tooltip
// appear normally so it can show as soon as the mouse enters a cell.
let _ctrlActive = false;
controls.addEventListener('start',  () => { _ctrlActive = true; });
controls.addEventListener('end',    () => { _ctrlActive = false; });
controls.addEventListener('change', () => {
  dirty = true;
  if (!cinemaMode && _ctrlActive) { tooltip.hidden = true; clearOutline(); }
});

// Ambient base + directional key light attached to camera (follows the viewer)
scene.add(new THREE.AmbientLight(0xffffff, 0.68));
const camLight = new THREE.DirectionalLight(0xffffff, 1.1);
camLight.position.set(0, 0, 1); // +Z in camera space = behind camera = toward scene
camera.add(camLight);
scene.add(camera); // camera must be in scene for child lights to update

// ── Render loop ───────────────────────────────────────────────────────────────
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  if (controls.autoRotate) dirty = true;
  if (!dirty) return;
  renderer.render(scene, camera);
  dirty = false;
})();
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  dirty = true;
});

// ── Status bar ────────────────────────────────────────────────────────────────
const statusEl = document.getElementById('statusbar');
function setStatus(h) { statusEl.innerHTML = h; }
function checkReady() {
  if (!wasmOk || !sceneOk) return;
  setStatus(t('status-ready'));
  if (!_readyFired) {
    _readyFired = true;
    setLoadProgress(100, 'Ready');
    // Enable ghost frame and beam axis on startup
    toggleAllGhosts();
    toggleBeam();
    // Dismiss loading screen after a brief moment so 100% is visible
    setTimeout(dismissLoadingScreen, 280);
  }
  if (isLive && poller) {
    poller.start();
    const list = poller.getList();
    if (list.length) { curEvtId = list[0].id; processXml(list[0].text); renderEvtList(); }
  }
}

// ── GLB loader ────────────────────────────────────────────────────────────────
setLoadProgress(5, 'Loading geometry…');
new GLTFLoader().load(
  './geometry_data/CaloGeometry.glb',
  ({ scene: g }) => {
    g.traverse(o => {
      if (!o.isMesh) return;
      o.visible = false;
      meshByName.set(o.name, o);
      origMat.set(o.name, o.material);
    });
    scene.add(g);
    sceneOk = true; dirty = true;
    setLoadProgress(wasmOk ? 100 : 70, 'Geometry loaded');
    addLog(t('log-glb-loaded'), 'ok');
    checkReady();
  },
  x => {
    if (x.total) {
      const pct = Math.round(x.loaded / x.total * 60);
      setLoadProgress(5 + pct, `Loading geometry… ${pct}%`);
      setStatus(`Loading geometry: ${pct}%`);
    }
  },
  () => {
    setStatus('<span class="warn">CaloGeometry.glb not found.</span>');
    addLog(t('log-glb-notfound'), 'warn');
    setLoadProgress(wasmOk ? 100 : 70, 'Geometry skipped');
    sceneOk = true; checkReady();
  }
);

// ── WASM ──────────────────────────────────────────────────────────────────────
setLoadProgress(5, 'Loading WASM parser…');
wasmInit()
  .then(() => {
    wasmOk = true;
    setLoadProgress(sceneOk ? 100 : 35, 'WASM parser ready');
    addLog(t('log-wasm-ready'), 'ok');
    checkReady();
  })
  .catch(e  => {
    setStatus(`<span class="err">WASM: ${esc(e.message)}</span>`);
    addLog(t('log-wasm-error') + e.message, 'err');
  });

// ── TileCal ID → cell name ────────────────────────────────────────────────────
function compX(sec, samp, tow) {
  if (sec < 3) {
    if (samp === 0) return sec === 1 ?  1 :  5;
    if (samp === 1) return sec === 1 ? 23 :  6;
    if (samp === 2) return sec === 1 ?  4 :  7;
  } else {
    if (tow ===  8) return  8; if (tow ===  9) return  9;
    if (tow === 10) return 10; if (tow === 11) return 11;
    if (tow === 13) return 12; if (tow === 15) return 13;
  }
  return null;
}
function compK(tow, samp, x) {
  if (tow < 8) return samp === 2 ? Math.floor(tow/2) : tow;
  if (tow ===  8) { return (x===0||x===1) ? 8 : 0; }
  if (tow ===  9) { if (x===1) return 9; if (x===9) return 0; return null; }
  if (tow === 10) return 0;
  if (tow === 11) { if (x===11||x===5) return 0; if (x===6) return 1; return null; }
  if (tow === 12) { if (x===5) return 1; if (x===6) return 2; if (x===7) return 1; return null; }
  if (tow === 13) { if (x===12) return 0; if (x===5) return 2; if (x===6) return 3; return null; }
  if (tow === 14) { if (x===5) return 3; if (x===6) return 4; return null; }
  if (tow === 15) { if (x===13) return 0; if (x===5) return 4; return null; }
  return null;
}
function cellLabel(x, k) {
  switch (x) {
    case  1: return `A${k+1}`;  case 23: return `BC${k+1}`;
    case  4: return `D${k}`;    case  5: return `A${k+12}`;
    case  6: return `B${k+11}`; case  7: return `D${k+5}`;
    case  8: return 'D4';       case  9: return 'C10';
    case 10: return 'E1';       case 11: return 'E2';
    case 12: return 'E3';       case 13: return 'E4';
    default: return '?';
  }
}

// ── HEC ID → mesh path ────────────────────────────────────────────────────────
// sampling 0→HEC1(inner10), 1→HEC23(inner10), 2→HEC45(inner9), 3→HEC67(inner8)
// cumulative eta = (region===0) ? eta : innerBins + eta
// subgroup B: HEC1 → B=cum;  HEC23/45/67 → B=max(0, cum-1)
const HEC_GROUPS_MAP = [
  { name: '1',  innerBins: 10 },
  { name: '23', innerBins: 10 },
  { name: '45', innerBins: 9  },
  { name: '67', innerBins: 8  },
];
function hecMeshPath(be, sampling, region, eta, phi) {
  const g = HEC_GROUPS_MAP[sampling];
  if (!g) return null;
  const Z   = be > 0 ? 'p' : 'n';
  const cum = region === 0 ? eta : g.innerBins + eta;
  const B   = g.name === '1' ? cum : Math.max(0, cum - 1);
  const path = `Calorimeter\u2192HEC_${g.name}_${region}_${Z}_0\u2192HEC_${g.name}_${region}_${Z}_${cum}_${B}\u2192cell_${phi}`;
  return meshByName.has(path) ? path : null;
}

// ── XML parsers ───────────────────────────────────────────────────────────────
function parseTile(xmlText) {
  const doc  = new DOMParser().parseFromString(xmlText, 'application/xml');
  const pe   = doc.querySelector('parsererror');
  if (pe) throw new Error('XML parse error: ' + pe.textContent.slice(0,120));
  const tiles = [...doc.getElementsByTagName('TILE')];
  if (!tiles.length) return [];   // no TILE block — not an error, LAr may still exist
  const cells = [];
  for (const tile of tiles) {
    let n = 0;
    for (const ch of tile.children) {
      const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
      const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const idEl = tile.querySelector('id, cellID');
    const eEl  = tile.querySelector('energy, e');
    if (idEl && eEl) {
      const ids = idEl.textContent.trim().split(/\s+/);
      const ens = eEl.textContent.trim().split(/\s+/).map(Number);
      const m   = Math.min(ids.length, ens.length);
      for (let i = 0; i < m; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
    }
  }
  return cells;
}

function parseLAr(xmlText) {
  const doc    = new DOMParser().parseFromString(xmlText, 'application/xml');
  const larEls = [...doc.getElementsByTagName('LAr')]
                   .filter(el => el.getAttribute('storeGateKey') === 'AllCalo');
  if (!larEls.length) return [];
  const cells = [];
  for (const lar of larEls) {
    let n = 0;
    for (const ch of lar.children) {
      const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
      const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const idEl = lar.querySelector('id, cellID');
    const eEl  = lar.querySelector('energy, e');
    if (idEl && eEl) {
      const ids = idEl.textContent.trim().split(/\s+/);
      const ens = eEl.textContent.trim().split(/\s+/).map(Number);
      const m   = Math.min(ids.length, ens.length);
      for (let i = 0; i < m; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
    }
  }
  return cells;
}

function parseHec(xmlText) {
  const doc    = new DOMParser().parseFromString(xmlText, 'application/xml');
  // Find HEC block with any storeGateKey — count is read dynamically, not hardcoded
  const hecEls = [...doc.getElementsByTagName('HEC')];
  if (!hecEls.length) return [];
  const cells = [];
  for (const hec of hecEls) {
    let n = 0;
    for (const ch of hec.children) {
      const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
      const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const idEl = hec.querySelector('id, cellID');
    const eEl  = hec.querySelector('energy, e');
    if (idEl && eEl) {
      const ids = idEl.textContent.trim().split(/\s+/);
      const ens = eEl.textContent.trim().split(/\s+/).map(Number);
      const m   = Math.min(ids.length, ens.length);
      for (let i = 0; i < m; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
    }
  }
  return cells;
}

// ── LAr EM ID → mesh path (tries cell_ then cell2_ as fallback) ───────────────
function larMeshPath(bec, samp, region, eta, phi) {
  const X      = (bec === -1 || bec === 1) ? 'Barrel' : 'EndCap';
  const W      = X === 'Barrel' ? 0 : 1;
  const Z      = bec > 0 ? 'p' : 'n';
  const R      = X === 'EndCap' ? Math.abs(bec) : region;
  const prefix = `Calorimeter\u2192EM${X}_${samp}_${R}_${Z}_${W}\u2192EM${X}_${samp}_${R}_${Z}_${eta}_${eta}\u2192`;
  if (meshByName.has(prefix + `cell_${phi}`))  return prefix + `cell_${phi}`;
  if (meshByName.has(prefix + `cell2_${phi}`)) return prefix + `cell2_${phi}`;
  return null;
}

// ── Scene reset ───────────────────────────────────────────────────────────────
function resetScene() {
  for (const [name, mesh] of meshByName) {
    mesh.visible = false; mesh.material = origMat.get(name) ?? mesh.material; mesh.renderOrder = 0;
  }
  active.clear(); rayTargets = [];
  clearOutline(); clearAllOutlines();
  tooltip.hidden = true; dirty = true;
}
function applyThreshold() {
  rayTargets = [];
  for (const [name, { energyMev, det }] of active) {
    const mesh = meshByName.get(name); if (!mesh) continue;
    const thr   = det === 'LAR' ? thrLArMev  : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn = det === 'LAR' ? showLAr    : det === 'HEC' ? showHec   : showTile;
    const vis = detOn && (!isFinite(thr) || energyMev >= thr);
    mesh.visible = vis; if (vis) rayTargets.push(mesh);
  }
  rebuildAllOutlines();
  dirty = true;
}

// ── Process XML ───────────────────────────────────────────────────────────────
function processXml(xmlText) {
  if (!wasmOk) return;
  const t0 = performance.now();

  // Parse TILE, LAr EM and HEC blocks
  let tileCells, larCells, hecCells;
  try { tileCells = parseTile(xmlText); }
  catch (e) { setStatus(`<span class="err">${esc(e.message)}</span>`); addLog(e.message, 'err'); return; }
  try { larCells = parseLAr(xmlText); } catch { larCells = []; }
  try { hecCells = parseHec(xmlText); } catch { hecCells = []; }

  const total = tileCells.length + larCells.length + hecCells.length;
  if (!total) { setStatus('<span class="warn">No TILE, LAr or HEC cells found</span>'); addLog('No cells in XML', 'warn'); return; }

  setStatus(`Decoding ${total} cells…`);
  resetScene();

  // Per-detector energy ranges (first pass)
  const tileMevs = tileCells.map(c => c.energy * 1000).filter(v => isFinite(v) && v > 0);
  const larMevs  = larCells .map(c => c.energy * 1000).filter(v => isFinite(v) && v > 0);
  const hecMevs  = hecCells .map(c => c.energy * 1000).filter(v => isFinite(v) && v > 0);
  tileMinMev = tileMevs.length ? Math.min(...tileMevs) : 0;
  tileMaxMev = tileMevs.length ? Math.max(...tileMevs) : 1;
  larMinMev  = larMevs.length  ? Math.min(...larMevs)  : 0;
  larMaxMev  = larMevs.length  ? Math.max(...larMevs)  : 1;
  hecMinMev  = hecMevs.length  ? Math.min(...hecMevs)  : 0;
  hecMaxMev  = hecMevs.length  ? Math.max(...hecMevs)  : 1;

  let nTile = 0, nLAr = 0, nHec = 0, nMiss = 0, nSkip = 0;
  let nHecMiss = 0;

  // ── TileCal cells ─────────────────────────────────────────────────────────
  for (const { id, energy } of tileCells) {
    const eMev = energy * 1000;
    let p;
    try { p = parse_atlas_id(id); } catch { nSkip++; continue; }
    if (!p?.valid || p.subsystem !== 'TILECAL') { nSkip++; continue; }
    const f = Object.fromEntries(p.fields.map(({ name, value }) => [name, value]));
    const x = compX(f.section, f.sampling, f.tower); if (x === null) { const s = `[TILE] id=${id} | compX failed | section=${f.section} sampling=${f.sampling} tower=${f.tower}`; console.warn(s); _missLog.push(s); nMiss++; continue; }
    const k = compK(f.tower, f.sampling, x);         if (k === null) { const s = `[TILE] id=${id} | compK failed | tower=${f.tower} sampling=${f.sampling} x=${x}`;               console.warn(s); _missLog.push(s); nMiss++; continue; }
    const y    = f.side < 0 ? 'p' : 'n';
    const path = `Calorimeter\u2192Tile${x}${y}_0\u2192Tile${x}${y}${k}_${k}\u2192cell_${f.module}`;
    const mesh = meshByName.get(path);
    if (!mesh) { const s = `[TILE] id=${id} | ${path}`; console.warn(s); _missLog.push(s); nMiss++; continue; }
    mesh.material = palMatTile(eMev); mesh.visible = true; mesh.renderOrder = 2;
    active.set(path, { energyGev: energy, energyMev: eMev, cellName: cellLabel(x, k), det: 'TILE' });
    nTile++;
  }

  // ── LAr EM cells ──────────────────────────────────────────────────────────
  for (const { id, energy } of larCells) {
    const eMev = energy * 1000;
    let p;
    try { p = parse_atlas_id(id); } catch { nSkip++; continue; }
    if (!p?.valid || p.subsystem !== 'LAr EM') { nSkip++; continue; }
    if (p.debug_log?.length) p.debug_log.forEach(msg => addLog(msg, 'info'));
    const f = Object.fromEntries(p.fields.map(({ name, value }) => [name, value]));
    const bec = f['barrel-endcap'];
    if (bec === undefined || f.sampling === undefined || f.eta === undefined || f.phi === undefined) { const s = `[LAr EM] id=${id} | missing fields | bec=${bec} sampling=${f.sampling} eta=${f.eta} phi=${f.phi}`; console.warn(s); _missLog.push(s); nMiss++; continue; }
    const path = larMeshPath(bec, f.sampling, f.region, f.eta, f.phi);
    if (!path) {
      const X = (bec === -1 || bec === 1) ? 'Barrel' : 'EndCap';
      const W = X === 'Barrel' ? 0 : 1;
      const Z = bec > 0 ? 'p' : 'n';
      const R  = X === 'EndCap' ? Math.abs(bec) : f.region;
      const s = `[LAr EM] id=${id} | Calorimeter\u2192EM${X}_${f.sampling}_${R}_${Z}_${W}\u2192EM${X}_${f.sampling}_${R}_${Z}_${f.eta}_${f.eta}\u2192cell_${f.phi}`;
      console.warn(s); _missLog.push(s); nMiss++; continue;
    }
    const mesh = meshByName.get(path);
    if (!mesh) { const s = `[LAr EM] id=${id} | ${path}`; console.warn(s); _missLog.push(s); nMiss++; continue; }
    mesh.material = palMatLAr(eMev); mesh.visible = true; mesh.renderOrder = 2;
    active.set(path, { energyGev: energy, energyMev: eMev, cellName: p.cell_name ?? `LAr η=${f.eta} φ=${f.phi}`, det: 'LAR' });
    nLAr++;
  }

  // ── LAr HEC cells ─────────────────────────────────────────────────────────
  for (const { id, energy } of hecCells) {
    const eMev = energy * 1000;
    let p;
    try { p = parse_atlas_id(id); } catch { nSkip++; continue; }
    if (!p?.valid || p.subsystem !== 'LAr HEC') { nSkip++; continue; }
    const f = Object.fromEntries(p.fields.map(({ name, value }) => [name, value]));
    const be = f['barrel-endcap'];
    if (be === undefined || f.sampling === undefined || f.region === undefined ||
        f.eta === undefined || f.phi === undefined) { const s = `[HEC] id=${id} | missing fields | be=${be} sampling=${f.sampling} region=${f.region} eta=${f.eta} phi=${f.phi}`; console.warn(s); _missLog.push(s); nHecMiss++; continue; }
    const path = hecMeshPath(be, f.sampling, f.region, f.eta, f.phi);
    if (!path) {
      const g = HEC_GROUPS_MAP[f.sampling];
      const Z = be > 0 ? 'p' : 'n';
      const cum = f.region === 0 ? f.eta : (g ? g.innerBins + f.eta : f.eta);
      const B = g?.name === '1' ? cum : Math.max(0, cum - 1);
      const s = g ? `[HEC] id=${id} | Calorimeter\u2192HEC_${g.name}_${f.region}_${Z}_0\u2192HEC_${g.name}_${f.region}_${Z}_${cum}_${B}\u2192cell_${f.phi}` : `[HEC] id=${id} | sampling=${f.sampling} (no group)`;
      console.warn(s); _missLog.push(s); nHecMiss++; continue;
    }
    const mesh = meshByName.get(path);
    if (!mesh) { const s = `[HEC] id=${id} | ${path}`; console.warn(s); _missLog.push(s); nHecMiss++; continue; }
    mesh.material = palMatHec(eMev); mesh.visible = true; mesh.renderOrder = 2;
    const side  = be > 0 ? 'HECA' : 'HECC';
    const sLabel = ['front','middle','back','rear'][f.sampling] ?? `s${f.sampling}`;
    active.set(path, {
      energyGev: energy, energyMev: eMev,
      cellName: `${side} ${sLabel} η=${f.eta} φ=${f.phi}`,
      det: 'HEC'
    });
    nHec++;
  }

  initDetPanel(nTile > 0, nLAr > 0, nHec > 0);
  applyThreshold();
  const dt = ((performance.now() - t0) / 1000).toFixed(2);

  const hitParts = [];
  if (nTile) hitParts.push(`TILE: ${nTile} (${fmtMev(tileMinMev)}–${fmtMev(tileMaxMev)})`);
  if (nLAr)  hitParts.push(`LAr: ${nLAr} (${fmtMev(larMinMev)}–${fmtMev(larMaxMev)})`);
  if (nHec)  hitParts.push(`HEC: ${nHec} (${fmtMev(hecMinMev)}–${fmtMev(hecMaxMev)})`);
  const hitStr  = hitParts.join(' · ') || '0';
  const nHit    = nTile + nLAr + nHec;
  const allMiss = nMiss + nHecMiss;
  const missStr = allMiss ? ` · <span class="warn">${allMiss} unmapped</span>` : '';
  setStatus(`<span class="ok">${nHit} cells</span>${missStr} · ${hitStr}`);
  if (nHecMiss) addLog(`HEC: ${nHec} mapped · ${nHecMiss} unmapped`, 'warn');
  addLog(`${nHit} cells — ${hitStr}${allMiss ? ` · ${allMiss} unmapped` : ''} (${dt}s)`, 'ok');
}

// ── Right panel (rpanel) toggle ───────────────────────────────────────────────
// Simplified state machine:
//   - rpanelPinned: user explicitly opened via the toolbar button (or 'E' key)
//   - rpanelHovered: temporarily open from edge-hover (auto-closes on leave)
// Button click => toggle pinned. Hover is only active when NOT pinned.
const rpanel = document.getElementById('rpanel');
const btnRpanel = document.getElementById('btn-rpanel');
let rpanelPinned = false;
let rpanelHovered = false;

function syncRPanelUI() {
  const open = rpanelPinned || rpanelHovered;
  rpanel.classList.toggle('open', open);
  btnRpanel.classList.toggle('on', rpanelPinned);
  document.body.classList.toggle('rpanel-unpinned', !rpanelPinned);
}
function setPinnedR(v) { rpanelPinned = v; if (v) rpanelHovered = false; syncRPanelUI(); }
function closeRPanel() { setPinnedR(false); rpanelHovered = false; syncRPanelUI(); }
function openRPanel()  { setPinnedR(true); }

// Hover from right edge — temporary show (only when not pinned & auto-open on)
const rpanelEdge = document.getElementById('rpanel-edge');
rpanelEdge.addEventListener('mouseenter', () => {
  if (!rpanelPinned && autoOpenEnabled) { rpanelHovered = true; syncRPanelUI(); }
});
rpanel.addEventListener('mouseleave', () => {
  if (!rpanelPinned && rpanelHovered) { rpanelHovered = false; syncRPanelUI(); }
});
// Toolbar button — toggle pinned state (single source of truth)
btnRpanel.addEventListener('click', e => {
  e.stopPropagation();
  setPinnedR(!rpanelPinned);
});
// Start unpinned (edge hover available)
setPinnedR(false);

// ── Tab switching ─────────────────────────────────────────────────────────────
const TAB_IDS = ['tile', 'lar', 'hec']; // Ghost tab removed (item 8)
function switchTab(det) {
  TAB_IDS.forEach(d => {
    document.getElementById('pane-' + d).style.display = d === det ? 'flex' : 'none';
    document.getElementById('tab-'  + d).classList.toggle('on', d === det);
  });
  // Keep ghost pane always hidden
  const gp = document.getElementById('pane-ghost');
  if (gp) gp.style.display = 'none';
}
TAB_IDS.forEach(d => document.getElementById('tab-' + d).addEventListener('click', () => switchTab(d)));
// Initialize: TILE pane visible, others hidden
switchTab('tile');

// ── Slider helpers ────────────────────────────────────────────────────────────
function parseMevInput(s) {
  s = s.trim().toLowerCase();
  if (!s || s === 'all') return -Infinity;
  const g = s.match(/^([\d.]+)\s*gev$/i); if (g) return parseFloat(g[1]) * 1000;
  const m = s.match(/^([\d.]+)\s*(mev)?$/i); if (m) return parseFloat(m[1]);
  return null;
}
function ratioFromPtr(e, trackEl) {
  const rect = trackEl.getBoundingClientRect();
  return 1 - Math.max(0, Math.min(1, ((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) / rect.height));
}

// Generic vertical energy slider — fixed max in MeV
function makeDetSlider(trackId, thumbId, inputId, getThr, setThr, maxMev) {
  const track = document.getElementById(trackId);
  const thumb = document.getElementById(thumbId);
  const input = document.getElementById(inputId);
  let drag = false;

  function updateUI(mev) {
    const ratio = isFinite(mev) && mev > 0 ? Math.max(0, Math.min(1, mev / maxMev)) : 0;
    thumb.style.top = ((1 - ratio) * 100) + '%';
    if (document.activeElement !== input) input.value = isFinite(mev) && mev > 0 ? fmtMev(mev) : '';
  }

  track.addEventListener('pointerdown', e => {
    drag = true; rpanel.classList.add('dragging'); track.setPointerCapture(e.pointerId);
    const r = ratioFromPtr(e, track); setThr(r <= 0 ? -Infinity : maxMev * r);
    updateUI(getThr()); applyThreshold();
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = ratioFromPtr(e, track); setThr(r <= 0 ? -Infinity : maxMev * r);
    updateUI(getThr()); applyThreshold();
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    track.addEventListener(ev, () => { drag = false; rpanel.classList.remove('dragging'); })
  );
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  input.addEventListener('blur', () => {
    const v = parseMevInput(input.value);
    if (v !== null) { setThr(v); applyThreshold(); }
    updateUI(getThr());
  });

  return { updateUI };
}

const tileSlider = makeDetSlider('tile-strak', 'tile-sthumb', 'tile-thr-input',
  () => thrTileMev, v => { thrTileMev = v; }, TILE_SCALE);
const larSlider  = makeDetSlider('lar-strak',  'lar-sthumb',  'lar-thr-input',
  () => thrLArMev,  v => { thrLArMev = v; },  LAR_SCALE);
const hecSlider  = makeDetSlider('hec-strak',  'hec-sthumb',  'hec-thr-input',
  () => thrHecMev,  v => { thrHecMev = v; },  HEC_SCALE);

// Initialize thumb positions at default threshold
tileSlider.updateUI(thrTileMev);
larSlider.updateUI(thrLArMev);
hecSlider.updateUI(thrHecMev);

function initDetPanel(hasTile, hasLAr, hasHec) {
  tileSlider.updateUI(thrTileMev);
  larSlider.updateUI(thrLArMev);
  hecSlider.updateUI(thrHecMev);
  openRPanel();
  if (hasTile) switchTab('tile'); else if (hasLAr) switchTab('lar'); else if (hasHec) switchTab('hec');
}

// (ghost functions defined above near GHOST_TILE_NAMES)

// ── Z-axis beam indicator ─────────────────────────────────────────────────────
function buildBeamIndicator() {
  if (beamGroup) return;
  beamGroup = new THREE.Group();
  const axisGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,-13000), new THREE.Vector3(0,0,13000)]);
  beamGroup.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0x4a7fcc, transparent: true, opacity: 0.50, depthWrite: false })));
  const northMesh = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({ color: 0xee2222 }));
  northMesh.rotation.x = Math.PI/2; northMesh.position.z = 13260; beamGroup.add(northMesh);
  const ringN = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({ color: 0xff6666, transparent: true, opacity: 0.55 }));
  ringN.rotation.x = Math.PI/2; ringN.position.z = 13000; beamGroup.add(ringN);
  const southMesh = new THREE.Mesh(new THREE.ConeGeometry(90,520,24,1,false), new THREE.MeshBasicMaterial({ color: 0x2244ee }));
  southMesh.rotation.x = -Math.PI/2; southMesh.position.z = -13260; beamGroup.add(southMesh);
  const ringS = new THREE.Mesh(new THREE.TorusGeometry(90,8,8,24), new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.55 }));
  ringS.rotation.x = Math.PI/2; ringS.position.z = -13000; beamGroup.add(ringS);
  beamGroup.visible = false; scene.add(beamGroup);
}
function toggleBeam() {
  buildBeamIndicator(); beamOn = !beamOn;
  beamGroup.visible = beamOn;
  document.getElementById('btn-beam').classList.toggle('on', beamOn);
  dirty = true;
}

// ── EdgesGeometry outline (hover) ─────────────────────────────────────────────
const eGeoCache  = new Map();
const outlineMat = new THREE.LineBasicMaterial({ color: 0xffffff });
let   outlineMesh = null;
function clearOutline() {
  if (!outlineMesh) return; scene.remove(outlineMesh); outlineMesh = null; dirty = true;
}
function showOutline(mesh) {
  if (outlineMesh?.userData.src === mesh.name) return;
  clearOutline();
  mesh.updateWorldMatrix(true, false);
  const uid = mesh.geometry.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 15));
  outlineMesh = new THREE.LineSegments(eGeoCache.get(uid), outlineMat);
  outlineMesh.matrix.copy(mesh.matrixWorld); outlineMesh.matrixAutoUpdate = false;
  outlineMesh.renderOrder = 999; outlineMesh.userData.src = mesh.name;
  scene.add(outlineMesh); dirty = true;
}

// ── All-cells outline (single merged draw call) ───────────────────────────────
const outlineAllMat = new THREE.LineBasicMaterial({ color: 0x000000 });
function clearAllOutlines() {
  if (!allOutlinesMesh) return;
  scene.remove(allOutlinesMesh);
  allOutlinesMesh.geometry.dispose();
  allOutlinesMesh = null;
  dirty = true;
}
function rebuildAllOutlines() {
  clearAllOutlines();
  if (!rayTargets.length) return;
  // Merge all visible cells' edge positions (world space) into one geometry
  const allPos = [];
  for (const mesh of rayTargets) {
    mesh.updateWorldMatrix(true, false);
    const uid = mesh.geometry.uuid;
    if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 15));
    const posArr = eGeoCache.get(uid).getAttribute('position').array;
    const m = mesh.matrixWorld.elements;
    for (let i = 0; i < posArr.length; i += 3) {
      const x = posArr[i], y = posArr[i+1], z = posArr[i+2];
      allPos.push(
        m[0]*x + m[4]*y + m[8]*z  + m[12],
        m[1]*x + m[5]*y + m[9]*z  + m[13],
        m[2]*x + m[6]*y + m[10]*z + m[14]
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allPos), 3));
  allOutlinesMesh = new THREE.LineSegments(geo, outlineAllMat);
  allOutlinesMesh.renderOrder = 3;
  scene.add(allOutlinesMesh);
  dirty = true;
}

// ── Hover tooltip — raycasting fix ───────────────────────────────────────────
const raycast  = new THREE.Raycaster();
const mxy      = new THREE.Vector2();
const tooltip  = document.getElementById('tip');
let   lastRay  = 0;
let   mousePos = { x: 0, y: 0 };
document.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
function doRaycast(clientX, clientY) {
  if (!showInfo || cinemaMode || !active.size) { tooltip.hidden = true; clearOutline(); return; }
  // Don't show cell info when the pointer is over any UI element (panels, toolbar, overlays)
  const topEl = document.elementFromPoint(clientX, clientY);
  if (topEl && topEl !== canvas) { tooltip.hidden = true; clearOutline(); return; }
  const rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    tooltip.hidden = true; clearOutline(); return;
  }
  mxy.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
  camera.updateMatrixWorld();
  raycast.setFromCamera(mxy, camera);
  const hits = raycast.intersectObjects(rayTargets, false);
  if (hits.length) {
    const data = active.get(hits[0].object.name);
    if (data) {
      showOutline(hits[0].object);
      document.getElementById('tip-cell').textContent = data.cellName;
      document.getElementById('tip-e').textContent    = `${data.energyGev.toFixed(4)} GeV`;
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; dirty = true; return;
    }
  }
  clearOutline(); tooltip.hidden = true;
}
document.addEventListener('mousemove', e => {
  const now = Date.now(); if (now-lastRay < 30) return; lastRay = now;
  doRaycast(e.clientX, e.clientY);
});
canvas.addEventListener('mouseleave', () => { clearOutline(); tooltip.hidden = true; });
controls.addEventListener('end', () => { lastRay = 0; setTimeout(() => doRaycast(mousePos.x, mousePos.y), 50); });

// ── Cinema ────────────────────────────────────────────────────────────────────
function enterCinema() {
  cinemaMode = true; document.body.classList.add('cinema');
  controls.autoRotate = true; controls.autoRotateSpeed = 0.38;
  document.getElementById('btn-cinema').classList.add('on');
  clearOutline(); tooltip.hidden = true;
}
function exitCinema() {
  cinemaMode = false; document.body.classList.remove('cinema');
  controls.autoRotate = false; document.getElementById('btn-cinema').classList.remove('on');
}
function resetCamera() {
  camera.position.set(0, 0, 12_000);
  controls.target.set(0, 0, 0);
  controls.update();
  dirty = true;
}
document.getElementById('btn-cinema').addEventListener('click', () => cinemaMode ? exitCinema() : enterCinema());
document.getElementById('cinema-exit').addEventListener('click', exitCinema);
let cDragged = false;
canvas.addEventListener('mousedown', () => { cDragged = false; });
canvas.addEventListener('mousemove', () => { cDragged = true; });
canvas.addEventListener('mouseup',   () => { if (cinemaMode && !cDragged) exitCinema(); });

// ── Tooltip toggle ────────────────────────────────────────────────────────────
document.getElementById('btn-info').addEventListener('click', () => {
  showInfo = !showInfo;
  document.getElementById('btn-info').classList.toggle('on', showInfo);
  document.querySelector('#btn-info use').setAttribute('href', showInfo ? '#i-eye' : '#i-eye-off');
  if (!showInfo) { clearOutline(); tooltip.hidden = true; }
});
document.getElementById('btn-ghost').addEventListener('click', toggleAllGhosts);
document.getElementById('gtog-tile').addEventListener('click', () => toggleGhostType('tile'));
document.getElementById('btn-beam').addEventListener('click', toggleBeam);
document.getElementById('btn-reset').addEventListener('click', resetCamera);


// ── Detector layer toggles + Layers panel ────────────────────────────────────
function syncLayerToggles() {
  const tTile = document.getElementById('ltog-tile');
  const tLAr  = document.getElementById('ltog-lar');
  const tHec  = document.getElementById('ltog-hec');
  tTile.classList.toggle('on', showTile); tTile.setAttribute('aria-checked', showTile);
  tLAr .classList.toggle('on', showLAr);  tLAr .setAttribute('aria-checked', showLAr);
  tHec .classList.toggle('on', showHec);  tHec .setAttribute('aria-checked', showHec);
  // Layers button: dim when all off, lit otherwise
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec);
}

document.getElementById('ltog-tile').addEventListener('click', () => { showTile = !showTile; syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-lar') .addEventListener('click', () => { showLAr  = !showLAr;  syncLayerToggles(); applyThreshold(); });
document.getElementById('ltog-hec') .addEventListener('click', () => { showHec  = !showHec;  syncLayerToggles(); applyThreshold(); });
document.getElementById('lbtn-all') .addEventListener('click', () => { showTile = showLAr = showHec = true;  syncLayerToggles(); applyThreshold(); });
document.getElementById('lbtn-none').addEventListener('click', () => { showTile = showLAr = showHec = false; syncLayerToggles(); applyThreshold(); });

// Layers panel open / close
const layersPanel = document.getElementById('layers-panel');
let layersPanelOpen = false;
function openLayersPanel() {
  layersPanelOpen = true;
  layersPanel.classList.add('open');
  document.getElementById('btn-layers').classList.add('on');
  const br = document.getElementById('btn-layers').getBoundingClientRect();
  // Position above the button, centred
  requestAnimationFrame(() => {
    const pw = layersPanel.offsetWidth  || 210;
    const ph = layersPanel.offsetHeight || 170;
    let left = br.left + br.width / 2 - pw / 2;
    let top  = br.top - ph - 10;
    left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
    top  = Math.max(6, top);
    layersPanel.style.left = left + 'px';
    layersPanel.style.top  = top  + 'px';
  });
}
function closeLayersPanel() {
  layersPanelOpen = false;
  layersPanel.classList.remove('open');
  // Restore btn-layers state (lit if any layer on)
  document.getElementById('btn-layers').classList.toggle('on', showTile || showLAr || showHec);
}
document.getElementById('btn-layers').addEventListener('click', e => {
  e.stopPropagation();
  layersPanelOpen ? closeLayersPanel() : openLayersPanel();
});
document.addEventListener('click', () => { if (layersPanelOpen) closeLayersPanel(); });
layersPanel.addEventListener('click', e => e.stopPropagation());

// ── Panel resize ──────────────────────────────────────────────────────────────
const panelEl      = document.getElementById('panel');
const panelEdge    = document.getElementById('panel-edge');
const panelResizer = document.getElementById('panel-resizer');
const savedPW = localStorage.getItem('cgv-panel-width');
if (savedPW) document.documentElement.style.setProperty('--pw', savedPW + 'px');
let prDrag = false, prStartX = 0, prStartW = 0;
panelResizer.addEventListener('pointerdown', e => {
  prDrag = true; prStartX = e.clientX; prStartW = panelEl.getBoundingClientRect().width;
  panelResizer.setPointerCapture(e.pointerId); panelResizer.classList.add('dragging'); e.preventDefault();
});
document.addEventListener('pointermove', e => {
  if (!prDrag) return;
  const newW = Math.max(180, Math.min(520, prStartW + e.clientX - prStartX));
  document.documentElement.style.setProperty('--pw', newW+'px');
});
document.addEventListener('pointerup', () => {
  if (!prDrag) return; prDrag = false; panelResizer.classList.remove('dragging');
  const w = Math.round(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pw')));
  localStorage.setItem('cgv-panel-width', w);
});

// ── Shared auto-open preference (set by Settings toggle) ─────────────────────
let autoOpenEnabled = true;

// ── Panel pin / unpin ─────────────────────────────────────────────────────────
function setPinned(v) {
  panelPinned = v;
  document.body.classList.toggle('panel-unpinned', !v);
  panelEl.classList.toggle('collapsed', !v);
  document.getElementById('btn-pin').classList.toggle('on', v);
  document.querySelector('#pin-icon use').setAttribute('href', v ? '#i-pin' : '#i-pin-off');
  document.getElementById('btn-pin').dataset.tip = t(v ? 'tip-pin' : 'tip-panel');
  document.getElementById('btn-panel').classList.toggle('on', v);
}
document.getElementById('btn-pin').addEventListener('click', () => setPinned(!panelPinned));
// Hover from left edge — temporary show (only if auto-open enabled)
panelEdge.addEventListener('mouseenter', () => {
  if (!panelPinned && autoOpenEnabled) { panelEl.classList.remove('collapsed'); panelHovered = true; }
});
panelEl.addEventListener('mouseleave', () => {
  if (!panelPinned && panelHovered) { panelEl.classList.add('collapsed'); panelHovered = false; }
});
canvas.addEventListener('click', () => {
  if (!panelPinned && panelHovered) { panelEl.classList.add('collapsed'); panelHovered = false; }
});
if (window.innerWidth < 640) setPinned(false);

// ── Panel toggle button in toolbar (L key) — pin/unpin ───────────────────────
document.getElementById('btn-panel').addEventListener('click', () => {
  // If hovered (temporary): pin it so it stays
  if (!panelPinned && panelHovered) { panelHovered = false; setPinned(true); return; }
  // Otherwise toggle pin
  setPinned(!panelPinned);
});

// ── About overlay ─────────────────────────────────────────────────────────────
const aboutOverlay = document.getElementById('about-overlay');
document.getElementById('btn-about-close').addEventListener('click', () => aboutOverlay.classList.remove('open'));
aboutOverlay.addEventListener('click', e => { if (e.target===aboutOverlay) aboutOverlay.classList.remove('open'); });

// ── Language picker ───────────────────────────────────────────────────────────
const langMenu = document.getElementById('lang-menu');
document.getElementById('btn-lang').addEventListener('click', e => {
  e.stopPropagation();
  const open = langMenu.classList.toggle('open');
  if (open) {
    const br = document.getElementById('btn-lang').getBoundingClientRect();
    const mw = langMenu.offsetWidth || 140;
    const mh = langMenu.offsetHeight || 110;
    let left = br.left + br.width/2 - mw/2;
    let top  = br.top - mh - 10;
    left = Math.max(6, Math.min(left, window.innerWidth - mw - 6));
    top  = Math.max(6, top);
    langMenu.style.left = left + 'px';
    langMenu.style.top  = top  + 'px';
  }
});
document.addEventListener('click', () => langMenu.classList.remove('open'));
document.querySelectorAll('.lang-opt').forEach(opt => {
  opt.addEventListener('click', e => {
    e.stopPropagation();
    applyLang(opt.dataset.lang);
    langMenu.classList.remove('open');
  });
});

// ── Button hint tooltips ──────────────────────────────────────────────────────
const btnTipEl = document.getElementById('btn-tip');
function showBtnTip(anchor, text) {
  btnTipEl.textContent = text;
  btnTipEl.classList.add('show');
  const ar = anchor.getBoundingClientRect();
  const tw = btnTipEl.offsetWidth, th = btnTipEl.offsetHeight, gap = 8;
  let left, top;
  if (anchor.closest('#toolbar')) {
    left = ar.left + ar.width/2 - tw/2; top = ar.top - th - gap;
  } else {
    left = ar.right + gap; top = ar.top + ar.height/2 - th/2;
  }
  left = Math.max(6, Math.min(left, window.innerWidth  - tw - 6));
  top  = Math.max(6, Math.min(top,  window.innerHeight - th - 6));
  btnTipEl.style.left = left+'px'; btnTipEl.style.top = top+'px';
}
function hideBtnTip() { btnTipEl.classList.remove('show'); }
document.querySelectorAll('[data-tip]').forEach(el => {
  el.addEventListener('mouseenter', () => showBtnTip(el, el.dataset.tip));
  el.addEventListener('mouseleave', hideBtnTip);
  el.addEventListener('click',      hideBtnTip);
});

// ── Mode toggle ───────────────────────────────────────────────────────────────
function setMode(mode) {
  // mode: 'live' | 'local' | 'sample'
  isLive = (mode === 'live');
  document.getElementById('btn-live').classList.toggle('on',   mode === 'live');
  document.getElementById('btn-local').classList.toggle('on',  mode === 'local');
  document.getElementById('btn-sample').classList.toggle('on', mode === 'sample');
  document.getElementById('live-sec').hidden   = (mode !== 'live');
  document.getElementById('local-sec').hidden  = (mode !== 'local');
  document.getElementById('sample-sec').hidden = (mode !== 'sample');
  if (mode === 'live') {
    if (poller && wasmOk && sceneOk) poller.start();
  } else {
    if (poller) { poller.stop(); setLiveDot('stopped'); }
    if (mode === 'sample') loadSampleIndex();
  }
}
document.getElementById('btn-live').addEventListener('click',   () => { if (!isLive) setMode('live'); });
document.getElementById('btn-local').addEventListener('click',  () => { if (document.getElementById('local-sec').hidden) setMode('local'); });
document.getElementById('btn-sample').addEventListener('click', () => { if (document.getElementById('sample-sec').hidden) setMode('sample'); });

// ── LivePoller ────────────────────────────────────────────────────────────────
let poller = null;
if (LivePoller) poller = new LivePoller();
function setLiveDot(state) {
  const dot   = document.getElementById('ldot');
  const txt   = document.getElementById('live-txt');
  const brand = document.getElementById('log-brand');
  dot.className = 'ldot';
  const isLiveActive = state === 'polling' || state === 'downloading' || state === 'same';
  if (brand) brand.classList.toggle('live', isLiveActive);
  switch (state) {
    case 'polling':     dot.classList.add('ok','pulse'); txt.textContent = t('live-polling'); break;
    case 'same':        dot.classList.add('ok');         txt.textContent = t('live-same'); break;
    case 'downloading': dot.classList.add('dl','pulse'); txt.textContent = t('live-fetching'); bumpReq(t('log-live-download'));
      if (brand) { startProgress(); advanceProgress('download'); } break;
    case 'error':       dot.classList.add('err');        txt.textContent = t('live-error'); addLog(t('log-poll-error'),'err'); break;
    default:            txt.textContent = t('live-stopped');
      if (brand) brand.classList.remove('live');
  }
}
function renderEvtList() {
  const list = poller ? poller.getList() : [];
  const el   = document.getElementById('evt-list');
  const empty = document.getElementById('live-empty');
  el.innerHTML = '';
  // Show empty state when no events available
  if (empty) empty.hidden = list.length > 0;
  list.slice(0, 10).forEach((entry, idx) => {
    const row = document.createElement('div');
    row.className = 'erow' + (entry.id === curEvtId ? ' cur' : '');
    row.innerHTML = `
      <div class="einfo">
        <div class="ename">${esc(entry.name)}</div>
        <div class="etime" data-ts="${entry.timestamp}">${relTime(entry.timestamp)}</div>
      </div>
      <button class="edl"><svg class="ic" style="width:11px;height:11px"><use href="#i-dl"/></svg></button>`;
    row.querySelector('.einfo').addEventListener('click', () => {
      curEvtId = entry.id; processXml(entry.text); renderEvtList(); addLog(t('log-event') + entry.name, 'info');
    });
    row.querySelector('.edl').addEventListener('click', ev => { ev.stopPropagation(); poller.download(idx); addLog(t('log-downloading') + entry.name); });
    el.appendChild(row);
  });
}
setInterval(() => {
  for (const el of document.querySelectorAll('.etime[data-ts]')) el.textContent = relTime(+el.dataset.ts);
}, 30_000);
if (poller) {
  poller.addEventListener('newxml', ({ detail: { entry } }) => {
    startProgress(); advanceProgress('load');
    curEvtId = entry.id; processXml(entry.text); renderEvtList(); bumpReq(t('log-new-event') + entry.name);
    endProgress();
  });
  poller.addEventListener('listupdate', renderEvtList);
  poller.addEventListener('status', ({ detail: { state } }) => setLiveDot(state));
  poller.addEventListener('error', ({ detail }) => { console.warn('[LivePoller]', detail.message); addLog('Poller: '+detail.message,'warn'); });
  poller.init().then(() => { renderEvtList(); addLog(t('log-poller-init'),'ok'); }).catch(()=>{});
} else {
  document.getElementById('btn-local').click();
  addLog(t('log-poller-unavail'),'warn');
}
document.getElementById('ibtn-play').addEventListener('click', () => {
  if (!poller) return; poller.start();
  document.getElementById('ibtn-play').hidden = true; document.getElementById('ibtn-stop').hidden = false;
  addLog(t('log-poll-resumed'));
});
document.getElementById('ibtn-stop').addEventListener('click', () => {
  if (!poller) return; poller.stop();
  document.getElementById('ibtn-stop').hidden = true; document.getElementById('ibtn-play').hidden = false;
  setLiveDot('stopped'); addLog(t('log-poll-paused'));
});

// ── Unmapped cells log download ───────────────────────────────────────────────
document.getElementById('btn-log-dl').addEventListener('click', () => {
  if (_missLog.length === 0) { alert('No unmapped cells recorded yet (load an event first).'); return; }
  const header = `# Unmapped cells — strings not found in CaloGeometry.cgv\n# Generated: ${new Date().toISOString()}\n# Format: [DET] id=<raw_id> | <attempted_path>\n#\n`;
  const blob = new Blob([header + _missLog.join('\n') + '\n'], { type: 'text/plain' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'unmapped_cells.txt' });
  a.click(); URL.revokeObjectURL(a.href);
});

// ── Log collapse ──────────────────────────────────────────────────────────────
document.getElementById('btn-log-min').addEventListener('click', () => {
  const sec  = document.getElementById('log-sec');
  const icon = document.getElementById('log-min-icon');
  const willCollapse = !sec.classList.contains('log-collapsed');
  if (willCollapse) {
    // Preserve any user-resized height so we can restore it on expand,
    // then clear the inline styles so the .log-collapsed CSS rule can win.
    sec.dataset.savedMaxH = sec.style.maxHeight || '';
    sec.dataset.savedMinH = sec.style.minHeight || '';
    sec.style.maxHeight = '';
    sec.style.minHeight = '';
    sec.classList.add('log-collapsed');
  } else {
    sec.classList.remove('log-collapsed');
    if (sec.dataset.savedMaxH) sec.style.maxHeight = sec.dataset.savedMaxH;
    if (sec.dataset.savedMinH) sec.style.minHeight = sec.dataset.savedMinH;
  }
  icon.className = willCollapse ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  document.getElementById('btn-log-min').dataset.tip = willCollapse ? 'Expand session log' : 'Minimize session log';
});

// ── Local mode ────────────────────────────────────────────────────────────────
let localFiles = [];
document.getElementById('file-folder-in').addEventListener('change', async e => {
  const files = [...(e.target.files??[])].filter(f => f.name.toLowerCase().endsWith('.xml'));
  e.target.value = '';
  if (!files.length) { addLog(t('log-no-xml'),'warn'); return; }
  localFiles = files.sort((a,b) => a.name.localeCompare(b.name));
  renderLocalList();
  addLog(t('log-folder-loaded').replace('{n}', localFiles.length), 'ok');
});

// ── Carousel ──────────────────────────────────────────────────────────────────
let carouselActive = false;
let carouselTimer  = null;
let carouselIdx    = 0;

// Carousel delay step buttons
let carouselDelaySec = 5;
document.querySelectorAll('.cdstep').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cdstep').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    carouselDelaySec = parseInt(btn.dataset.s);
  });
});
document.getElementById('btn-carousel-play').addEventListener('click', () => {
  if (!localFiles.length) return;
  carouselActive = true;
  document.getElementById('btn-carousel-play').hidden = true;
  document.getElementById('btn-carousel-stop').hidden = false;
  addLog('Carousel started — ' + localFiles.length + ' files', 'info');
  runCarouselStep();
});
document.getElementById('btn-carousel-stop').addEventListener('click', stopCarousel);

function stopCarousel() {
  carouselActive = false;
  clearTimeout(carouselTimer);
  document.getElementById('btn-carousel-stop').hidden = true;
  document.getElementById('btn-carousel-play').hidden = false;
  addLog('Carousel stopped');
}
async function runCarouselStep() {
  if (!carouselActive || !localFiles.length) return;
  carouselIdx = carouselIdx % localFiles.length;
  document.querySelectorAll('#local-list .lrow').forEach((r, i) =>
    r.classList.toggle('cur', i === carouselIdx));
  document.getElementById('carousel-status').textContent =
    `${carouselIdx + 1} / ${localFiles.length}`;
  const file = localFiles[carouselIdx];
  addLog('Carousel: ' + file.name);
  try { processXml(await file.text()); } catch(e) { addLog('Carousel error: ' + e.message, 'err'); }
  carouselIdx++;
  carouselTimer = setTimeout(runCarouselStep, carouselDelaySec * 1000);
}
function renderLocalList() {
  const listEl = document.getElementById('local-list');
  const carBar = document.getElementById('carousel-bar');
  listEl.hidden = !localFiles.length; listEl.innerHTML = '';
  if (carBar) { carBar.hidden = localFiles.length < 2; }
  carouselIdx = 0; stopCarousel();
  localFiles.forEach(file => {
    const row = document.createElement('div'); row.className = 'lrow';
    row.innerHTML = `<span class="lrow-name">${esc(file.name)}</span><span class="lrow-size">${fmtSize(file.size)}</span>`;
    row.addEventListener('click', async () => {
      document.querySelectorAll('#local-list .lrow.cur').forEach(r => r.classList.remove('cur'));
      row.classList.add('cur'); addLog(t('log-loading') + file.name); setStatus('Reading file…');
      startProgress(); advanceProgress('acquire');
      try {
        const text = await file.text();
        advanceProgress('load');
        processXml(text);
        endProgress();
      } catch (err) {
        endProgress();
        setStatus(`<span class="err">Read error: ${esc(err.message)}</span>`);
        addLog(t('log-read-error') + err.message,'err');
      }
    });
    listEl.appendChild(row);
  });
}
document.getElementById('file-in').addEventListener('change', async e => {
  const f = e.target.files?.[0];
  if (f) { addLog(t('log-loading') + f.name); setStatus('Parsing…'); processXml(await f.text()); }
  e.target.value = '';
});

// ── Sample events mode ────────────────────────────────────────────────────────
let _sampleLoaded = false;
async function loadSampleIndex() {
  if (_sampleLoaded) return;
  const msgEl  = document.getElementById('sample-list-msg');
  const listEl = document.getElementById('sample-list');
  msgEl.textContent = t('sample-loading');
  msgEl.hidden = false;
  listEl.innerHTML = '';
  try {
    const res = await fetch('./default_xml/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const names = await res.json();
    msgEl.hidden = true;
    if (!names.length) { msgEl.textContent = t('sample-empty'); msgEl.hidden = false; return; }
    names.forEach(name => {
      const btn = document.createElement('button');
      btn.className = 'sample-item';
      btn.innerHTML = `<svg class="ic sample-item-icon" style="width:11px;height:11px"><use href="#i-star"/></svg><span class="sample-item-name">${esc(name)}</span>`;
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.sample-item.cur').forEach(b => b.classList.remove('cur'));
        btn.classList.add('cur');
        addLog(t('log-loading') + name); setStatus('Loading sample…');
        startProgress(); advanceProgress('request');
        try {
          const xmlRes = await fetch(`./default_xml/${encodeURIComponent(name)}`);
          advanceProgress('download');
          if (!xmlRes.ok) throw new Error(`HTTP ${xmlRes.status}`);
          const xmlText = await xmlRes.text();
          advanceProgress('load');
          processXml(xmlText);
          endProgress();
        } catch (err) {
          endProgress();
          setStatus(`<span class="err">Error: ${esc(err.message)}</span>`);
          addLog(t('log-read-error') + err.message, 'err');
          btn.classList.remove('cur');
        }
      });
      listEl.appendChild(btn);
    });
    _sampleLoaded = true;
  } catch (err) {
    msgEl.textContent = t('sample-error');
    msgEl.hidden = false;
    addLog('Sample index error: ' + err.message, 'err');
  }
}

// ── Screenshot ────────────────────────────────────────────────────────────────
const shotOverlay  = document.getElementById('shot-overlay');
const shotSaveBtn  = document.getElementById('btn-shot-save');
const shotProgress = document.getElementById('shot-progress');
const shotProgTxt  = document.getElementById('shot-progress-txt');
let   shotW = 0, shotH = 0;

// Resolution button selection
document.querySelectorAll('.shot-res').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shot-res').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    shotW = parseInt(btn.dataset.w, 10);
    shotH = parseInt(btn.dataset.h, 10);
    shotSaveBtn.disabled = false;
  });
});

function openShotDialog() { shotOverlay.classList.add('open'); }
function closeShotDialog() {
  shotOverlay.classList.remove('open');
  document.querySelectorAll('.shot-res').forEach(b => b.classList.remove('active'));
  shotSaveBtn.disabled = true;
  shotProgress.classList.remove('running');
  shotProgTxt.textContent = '';
  shotW = 0; shotH = 0;
}

document.getElementById('btn-shot').addEventListener('click', openShotDialog);
document.getElementById('btn-shot-cancel').addEventListener('click', closeShotDialog);
shotOverlay.addEventListener('click', e => { if (e.target === shotOverlay) closeShotDialog(); });

shotSaveBtn.addEventListener('click', async () => {
  if (!shotW || !shotH) return;
  shotSaveBtn.disabled = true;
  shotProgTxt.textContent = t('shot-rendering').replace('{w}', shotW).replace('{h}', shotH);
  shotProgress.classList.add('running');

  // Let the DOM update (spinner + text visible) before the blocking render
  await new Promise(r => setTimeout(r, 80));

  try {
    await renderAndDownload(shotW, shotH);
    shotProgTxt.textContent = t('shot-done');
    await new Promise(r => setTimeout(r, 900));
    closeShotDialog();
  } catch (err) {
    shotProgTxt.textContent = t('shot-error').replace('{msg}', err.message);
    shotSaveBtn.disabled = false;
  }
});

async function renderAndDownload(targetW, targetH) {
  // ── 1. Save current renderer state ──────────────────────────────────────
  const origW  = renderer.domElement.width;
  const origH  = renderer.domElement.height;
  const origPR = renderer.getPixelRatio();
  const origAspect = camera.aspect;

  // ── 2. Snapshot tooltip content before any resize ────────────────────────
  const tipVisible  = !tooltip.hidden;
  let tipData = null;
  if (tipVisible) {
    tipData = {
      cellName: document.getElementById('tip-cell').textContent,
      energy:   document.getElementById('tip-e').textContent,
      // Tooltip position as fraction of the current viewport
      xFrac: (parseFloat(tooltip.style.left) - canvas.getBoundingClientRect().left) / origW * origPR,
      yFrac: (parseFloat(tooltip.style.top)  - canvas.getBoundingClientRect().top)  / origH * origPR,
    };
  }

  // ── 3. Resize renderer to target resolution ──────────────────────────────
  renderer.setPixelRatio(1);
  renderer.setSize(targetW, targetH, false); // false = don't update CSS size
  camera.aspect = targetW / targetH;
  camera.updateProjectionMatrix();

  // ── 4. Render one high-quality frame ─────────────────────────────────────
  renderer.render(scene, camera);

  // ── 5. Grab raw pixels from the WebGL canvas ─────────────────────────────
  const gl    = renderer.getContext();
  const pixels = new Uint8Array(targetW * targetH * 4);
  gl.readPixels(0, 0, targetW, targetH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // ── 6. Flip Y (WebGL origin is bottom-left, canvas is top-left) ──────────
  const offscreen = document.createElement('canvas');
  offscreen.width  = targetW;
  offscreen.height = targetH;
  const ctx = offscreen.getContext('2d');
  const imgData = ctx.createImageData(targetW, targetH);
  for (let y = 0; y < targetH; y++) {
    const srcRow = (targetH - 1 - y) * targetW * 4;
    imgData.data.set(pixels.subarray(srcRow, srcRow + targetW * 4), y * targetW * 4);
  }
  ctx.putImageData(imgData, 0, 0);

  // ── 7. Draw tooltip overlay if it was visible ────────────────────────────
  if (tipData) {
    const scale  = targetW / origW * origPR;   // pixel mapping factor
    const tx     = tipData.xFrac * targetW;
    const ty     = tipData.yFrac * targetH;
    const pad    = 14 * scale;
    const radius = 7  * scale;
    const fs     = 14 * scale;
    const lh     = 20 * scale;

    ctx.save();
    ctx.font       = `600 ${fs}px Inter, system-ui, sans-serif`;
    const nameW    = ctx.measureText(tipData.cellName).width;
    ctx.font       = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
    const eKeyW    = ctx.measureText('ENERGY').width;
    ctx.font       = `500 ${fs}px "JetBrains Mono", monospace`;
    const eValW    = ctx.measureText(tipData.energy).width;
    const boxW     = Math.max(nameW, eKeyW + eValW + pad * 2.5) + pad * 2;
    const boxH     = lh * 2 + pad * 2 + 8 * scale; // name + divider + energy row

    // Clamp so tooltip doesn't go off-canvas
    const bx = Math.min(tx, targetW - boxW - 4 * scale);
    const by = Math.min(ty, targetH - boxH - 4 * scale);

    // Background
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, radius);
    ctx.fillStyle = 'rgba(2,11,28,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(22,72,168,0.55)';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();

    // Cell name
    ctx.font      = `600 ${fs}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#d6eaff';
    ctx.fillText(tipData.cellName, bx + pad, by + pad + fs);

    // Divider
    ctx.strokeStyle = 'rgba(22,72,168,0.35)';
    ctx.lineWidth   = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(bx + pad, by + pad + lh + 4 * scale);
    ctx.lineTo(bx + boxW - pad, by + pad + lh + 4 * scale);
    ctx.stroke();

    // Energy key + value
    const ey = by + pad + lh + 4 * scale + lh * 0.9;
    ctx.font      = `400 ${fs * 0.84}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = '#2c5270';
    ctx.fillText('ENERGY', bx + pad, ey);
    ctx.font      = `500 ${fs}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#d6eaff';
    ctx.textAlign = 'right';
    ctx.fillText(tipData.energy, bx + boxW - pad, ey);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  // ── 8. Restore original renderer state ──────────────────────────────────
  renderer.setPixelRatio(origPR);
  renderer.setSize(origW / origPR, origH / origPR, false);
  camera.aspect = origAspect;
  camera.updateProjectionMatrix();
  dirty = true;

  // ── 9. Download ─────────────────────────────────────────────────────────
  const ts   = new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
  const link = document.createElement('a');
  link.download = `CGVWEB_${targetW}x${targetH}_${ts}.png`;
  link.href = offscreen.toDataURL('image/png');
  link.click();
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function fmtMev(v) {
  if (!isFinite(v)) return 'ALL';
  const a = Math.abs(v);
  if (a>=1000) return `${(v/1000).toPrecision(3)} GeV`;
  if (a>=1)    return `${v.toFixed(1)} MeV`;
  return `${v.toFixed(3)} MeV`;
}
function fmtSize(b) {
  if (b<1024) return `${b} B`;
  if (b<1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function relTime(ts) {
  const s = (Date.now()-ts)/1000;
  if (s<10)   return t('just-now');
  if (s<60)   return `${Math.floor(s)}${t('s-ago')}`;
  if (s<3600) return `${Math.floor(s/60)}${t('m-ago')}`;
  return `${Math.floor(s/3600)}${t('h-ago')}`;
}

// ── Log section vertical resize ───────────────────────────────────────────────
(function () {
  const logSec    = document.getElementById('log-sec');
  const logResize = document.getElementById('log-resize');
  let lrDrag = false, lrStartY = 0, lrStartH = 0;
  logResize.addEventListener('pointerdown', e => {
    lrDrag = true; lrStartY = e.clientY;
    lrStartH = logSec.getBoundingClientRect().height;
    logResize.setPointerCapture(e.pointerId);
    logResize.classList.add('dragging');
    e.preventDefault();
  });
  document.addEventListener('pointermove', e => {
    if (!lrDrag) return;
    const delta = lrStartY - e.clientY; // drag up → taller
    const newH  = Math.max(50, Math.min(320, lrStartH + delta));
    logSec.style.maxHeight = newH + 'px';
    logSec.style.minHeight = newH + 'px';
  });
  document.addEventListener('pointerup', () => {
    if (!lrDrag) return; lrDrag = false;
    logResize.classList.remove('dragging');
  });
})();

// ── Download progress bar ─────────────────────────────────────────────────────
const DL_STAGES = ['request', 'recogn', 'download', 'acquire', 'load'];
const DL_PCTS   = { request: 10, recogn: 28, download: 58, acquire: 78, load: 95 };
let _dlTimer = null;
function startProgress() {
  const pEl = document.getElementById('dl-progress');
  pEl.hidden = false;
  DL_STAGES.forEach(s => {
    const el = document.getElementById('dlst-' + s);
    el.classList.remove('active','done');
  });
  document.getElementById('dl-bar-fill').style.width = '0%';
  advanceProgress('request');
}
function advanceProgress(stage) {
  if (_dlTimer) clearTimeout(_dlTimer);
  const idx = DL_STAGES.indexOf(stage);
  DL_STAGES.forEach((s, i) => {
    const el = document.getElementById('dlst-' + s);
    el.classList.toggle('done',   i < idx);
    el.classList.toggle('active', i === idx);
  });
  document.getElementById('dl-bar-fill').style.width = (DL_PCTS[stage] || 0) + '%';
}
function endProgress() {
  document.getElementById('dl-bar-fill').style.width = '100%';
  DL_STAGES.forEach(s => {
    const el = document.getElementById('dlst-' + s);
    el.classList.remove('active'); el.classList.add('done');
  });
  _dlTimer = setTimeout(() => {
    document.getElementById('dl-progress').hidden = true;
    document.getElementById('dl-bar-fill').style.width = '0%';
  }, 900);
}

// ── Settings panel ────────────────────────────────────────────────────────────
const settingsPanel = document.getElementById('settings-panel');
let settingsPanelOpen = false;
function openSettingsPanel() {
  settingsPanelOpen = true;
  settingsPanel.classList.add('open');
  document.getElementById('btn-settings').classList.add('on');
  const br = document.getElementById('btn-settings').getBoundingClientRect();
  requestAnimationFrame(() => {
    const pw = settingsPanel.offsetWidth  || 290;
    const ph = settingsPanel.offsetHeight || 320;
    let left = br.left + br.width / 2 - pw / 2;
    let top  = br.top - ph - 10;
    left = Math.max(6, Math.min(left, window.innerWidth - pw - 6));
    top  = Math.max(6, top);
    settingsPanel.style.left = left + 'px';
    settingsPanel.style.top  = top  + 'px';
  });
}
function closeSettingsPanel() {
  settingsPanelOpen = false;
  settingsPanel.classList.remove('open');
  document.getElementById('btn-settings').classList.remove('on');
}
document.getElementById('btn-settings').addEventListener('click', e => {
  e.stopPropagation();
  settingsPanelOpen ? closeSettingsPanel() : openSettingsPanel();
});
document.addEventListener('click', () => { if (settingsPanelOpen) closeSettingsPanel(); });
settingsPanel.addEventListener('click', e => e.stopPropagation());

// Settings toggles — hints
let hintsEnabled = true;
document.getElementById('stog-hints').addEventListener('click', function() {
  hintsEnabled = !hintsEnabled;
  this.classList.toggle('on', hintsEnabled);
  this.setAttribute('aria-checked', hintsEnabled);
  document.getElementById('btn-tip').style.display = hintsEnabled ? '' : 'none';
});

// Settings toggles — auto-open sidebar on hover
document.getElementById('stog-autopen').addEventListener('click', function() {
  autoOpenEnabled = this.classList.toggle('on');
  this.setAttribute('aria-checked', autoOpenEnabled);
  panelEdge.style.pointerEvents    = autoOpenEnabled ? '' : 'none';
  rpanelEdge.style.pointerEvents   = autoOpenEnabled ? '' : 'none';
});

// ── About button (panel head) ─────────────────────────────────────────────────
document.getElementById('btn-about').addEventListener('click', () => {
  aboutOverlay.classList.add('open');
});

// ── Mobile toolbar toggle (landscape-only) ────────────────────────────────────
(function () {
  const tb  = document.getElementById('toolbar');
  const btn = document.getElementById('btn-toolbar-toggle');
  const closeBtn = document.getElementById('btn-toolbar-close');
  // Mobile UI is enabled only for landscape small screens. Portrait triggers
  // the "rotate your device" overlay in CSS, so no JS handling needed there.
  const isLandscapeMobile = () =>
    window.innerHeight <= 520 && window.innerWidth > window.innerHeight;
  let tbVisible = !isLandscapeMobile();

  function apply() {
    tb.classList.toggle('tb-visible', tbVisible);
    // Hide the toggle pill while the toolbar is open (close button takes over)
    btn.classList.toggle('hidden', tbVisible && isLandscapeMobile());
  }
  // Apply initial state without animation
  tb.style.transition = 'none';
  apply();
  setTimeout(() => tb.style.transition = '', 50);

  btn.addEventListener('click', () => { tbVisible = true; apply(); });
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (isLandscapeMobile()) { tbVisible = false; apply(); }
  });

  // On resize, reset to desktop state if needed
  window.addEventListener('resize', () => {
    if (!isLandscapeMobile()) {
      tbVisible = true;
      apply();
    }
  });
})();

// ── Keyboard shortcuts ────────────────────────────────────────────────────────
// Viewer:   G ghost · B beam · R reset · I info · C cinema · P screenshot
// Panels:   M menu sidebar · E energy · S settings
// Layers:   T TILE · A LAr · H HEC (toggle each detector visibility)
// Escape:   close topmost overlay / menu
document.addEventListener('keydown', e => {
  // Ignore when focus is inside a text input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  // Ignore modifier combos (browser shortcuts)
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key.toUpperCase()) {
    case 'G':
      toggleAllGhosts();
      break;
    case 'B':
      toggleBeam();
      break;
    case 'R':
      resetCamera();
      break;
    case 'I':
      document.getElementById('btn-info').click();
      break;
    case 'C':
      cinemaMode ? exitCinema() : enterCinema();
      break;
    case 'M':
      document.getElementById('btn-panel').click();
      break;
    case 'E':
      setPinnedR(!rpanelPinned);
      break;
    case 'P':
      document.getElementById('btn-shot').click();
      break;
    case 'S':
      settingsPanelOpen ? closeSettingsPanel() : openSettingsPanel();
      break;
    // Detector layer toggles (item 8)
    case 'T':
      document.getElementById('ltog-tile').click();
      break;
    case 'L':
    case 'A':
      document.getElementById('ltog-lar').click();
      break;
    case 'H':
      document.getElementById('ltog-hec').click();
      break;
    case 'ESCAPE':
      if (cinemaMode)          { exitCinema(); return; }
      if (settingsPanelOpen)   { closeSettingsPanel(); return; }
      if (layersPanelOpen)     { closeLayersPanel(); return; }
      if (rpanelPinned)        { setPinnedR(false); return; }
      if (document.getElementById('shot-overlay').classList.contains('open'))
        { document.getElementById('btn-shot-cancel').click(); return; }
      if (panelPinned)         { setPinned(false); return; }
      aboutOverlay.classList.remove('open');
      break;
  }
});
