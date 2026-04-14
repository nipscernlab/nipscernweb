import * as THREE         from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import wasmInit, { parse_atlas_ids_bulk } from '../parser/pkg/atlas_id_parser.js';

// Subsystem codes returned by parse_atlas_ids_bulk (slot [0] of each 6-i32 record)
const SUBSYS_TILE     = 1;
const SUBSYS_LAR_EM   = 2;
const SUBSYS_LAR_HEC  = 3;

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
const PAL_N   = 256;
const DEF_THR = 200;

// ── State ─────────────────────────────────────────────────────────────────────
const meshByName = new Map();   // string → Mesh  (non-hot-path: origMat restore, debug)
const meshByKey  = new Map();   // int    → Mesh  (hot-path: event loop lookup)
const origMat    = new Map();
let   active     = new Map();   // Mesh → tooltip data  (keyed by object reference)
let   rayTargets = [];

// ── Integer key encoding — avoids string construction in the per-cell hot path ─
// Bits [1:0] = detector type tag: TILE=0b00, LAr EM=0b01, HEC=0b10 (no cross-type collision).
// TILE:   x(5b<<2) | side(1b<<7) | k(4b<<8) | module(6b<<12)       — 18 bits total
// LAr EM: (abs_be-1)(2b<<2) | samp(2b<<4) | R(3b<<6) | z_pos(1b<<9) | eta(9b<<10) | phi(8b<<19) | cell2(1b<<27)
// HEC:    group(2b<<2) | region(1b<<4) | z_pos(1b<<5) | cum_eta(5b<<6) | phi(6b<<11)
const _tileKey  = (x, s, k, mod) => (x<<2)|(s<<7)|(k<<8)|(mod<<12);
const _larEmKey = (ab, sa, R, z, eta, phi, c2) => 1|((ab-1)<<2)|(sa<<4)|(R<<6)|(z<<9)|(eta<<10)|(phi<<19)|(c2<<27);
const _hecKey   = (g, r, z, cum, phi) => 2|(g<<2)|(r<<4)|(z<<5)|(cum<<6)|(phi<<11);

// Parse a GLB mesh name string into its integer key (called once per mesh at load time).
function meshNameToKey(name) {
  const S = '\u2192';
  const a = name.indexOf(S); if (a < 0) return null;
  const b = name.indexOf(S, a+1); if (b < 0) return null;
  const c = name.indexOf(S, b+1); if (c < 0) return null;
  const l1 = name.slice(a+1, b), l2 = name.slice(b+1, c), l3 = name.slice(c+1);
  let m;
  // TILE / MBTS — Tile{x}{y}_0 → Tile{x}{y}{k}_{k} → cell_{mod}
  if ((m = /^Tile(\d+)([pn])_0$/.exec(l1))) {
    const x = +m[1], s = m[2]==='p' ? 1 : 0;
    const m2 = /^Tile\d+[pn](\d+)_\d+$/.exec(l2); if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);            if (!m3) return null;
    return _tileKey(x, s, +m2[1], +m3[1]);
  }
  // LAr EM — EM{X}_{samp}_{R}_{Z}_{W} → EM{X}_{samp}_{R}_{Z}_{eta}_{eta} → cell[2]_{phi}
  if ((m = /^EM(Barrel|EndCap)_(\d+)_(\d+)_([pn])_\d+$/.exec(l1))) {
    const ab = m[1]==='Barrel' ? 1 : +m[3], sa = +m[2], R = +m[3], z = m[4]==='p' ? 1 : 0;
    const m2 = /^EM(?:Barrel|EndCap)_\d+_\d+_[pn]_(\d+)_\d+$/.exec(l2); if (!m2) return null;
    const m3 = /^cell(2?)_(\d+)$/.exec(l3);                               if (!m3) return null;
    return _larEmKey(ab, sa, R, z, +m2[1], +m3[2], m3[1]==='2' ? 1 : 0);
  }
  // HEC — HEC_{name}_{region}_{Z}_0 → HEC_{name}_{region}_{Z}_{cum}_{cum} → cell_{phi}
  if ((m = /^HEC_(\w+)_(\d+)_([pn])_0$/.exec(l1))) {
    const g = HEC_NAMES.indexOf(m[1]); if (g < 0) return null;
    const m2 = /^HEC_\w+_\d+_[pn]_(\d+)_\d+$/.exec(l2); if (!m2) return null;
    const m3 = /^cell_(\d+)$/.exec(l3);                   if (!m3) return null;
    return _hecKey(g, +m[2], m[3]==='p' ? 1 : 0, +m2[1], +m3[1]);
  }
  return null;
}
let tileMaxMev = 1, tileMinMev = 0;
let larMaxMev  = 1, larMinMev  = 0;
let hecMaxMev  = 1, hecMinMev  = 0;
let thrTileMev = 50;    // 0.05 GeV default
let thrLArMev  = 0;    // 0 GeV default
let thrHecMev  = 600;  // 0.6 GeV default
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
let trackGroup    = null;
let clusterGroup  = null;
let lastClusterData       = null;  // { collections: [{key, clusters: [{eta,phi,etGev,cells:{TILE,LAR_EM,HEC,OTHER}}]}] }
let activeClusterCellIds  = null;  // null = no cluster filter; Set<string> = only these cell IDs are visible
let activeMbtsLabels      = null;  // null = no cluster filter; Set<string> = MBTS labels activated by cluster eta/phi
let clusterFilterEnabled  = true;
let _readyFired  = false;

// ── Loading screen helpers ─────────────────────────────────────────────────────
const _loadBar = document.getElementById('loading-bar');
const _loadMsg = document.getElementById('loading-msg');

// RAF loop: eases _barCurrent toward _barTarget, plus an asymptotic creep so
// the bar is never truly frozen during the GLB parse phase.
// Creep ceiling: 79% — success callback jumps to 100%.
let _barTarget  = 0;
let _barCurrent = 0;
let _barRafId   = null;
function _barTick() {
  // Asymptotic creep toward 79% (visible during parse phase, never freezes)
  if (_barTarget < 79) {
    _barTarget += (79 - _barTarget) * 0.003;
  }
  const gap = _barTarget - _barCurrent;
  _barCurrent += gap > 0.05 ? gap * 0.1 : gap;
  if (_loadBar) _loadBar.style.width = _barCurrent.toFixed(2) + '%';
  _barRafId = requestAnimationFrame(_barTick);
}
_barRafId = requestAnimationFrame(_barTick);

function setLoadProgress(pct, msg) {
  _barTarget = Math.max(_barTarget, Math.min(100, pct));
  if (_loadMsg && msg) _loadMsg.textContent = msg;
}

function dismissLoadingScreen() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  cancelAnimationFrame(_barRafId); _barRafId = null;
  if (_loadBar) _loadBar.style.width = '100%';
  overlay.classList.add('done');
  setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 750);
}

// ── Session log ───────────────────────────────────────────────────────────────
const logListEl = document.getElementById('log-list');
const reqBadge  = document.getElementById('req-badge');
function addLog(msg, type = '') {
  if (!logListEl) return;
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
  if (reqBadge) reqBadge.textContent = `${reqCount} req`;
  if (label) addLog(label);
}

// ── Palette TILE: #ffff00 (min) → #800000 (max), linear ──────────────────────
function palColorTile(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    1.000 + t * (0.502 - 1.000),       // R: 1.0 → 0.502
    1.000 + t * (0.000 - 1.000),       // G: 1.0 → 0.0
    0.0                                 // B: always 0
  );
}
const PAL_TILE = Array.from({ length: PAL_N }, (_, i) => {
  const c = palColorTile(i / (PAL_N - 1));
  c.offsetHSL(0, 0.35, 0);  // boost saturation, keep hue & lightness
  return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
});
const TILE_SCALE = 2000;
function palMatTile(eMev) {
  const tv = Math.max(0, Math.min(1, eMev / TILE_SCALE));
  return PAL_TILE[Math.round(tv * (PAL_N - 1))];
}

// ── Palette HEC: #66e0f6 (min) → #0c0368 (max), linear ─────────────────────
function palColorHec(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.4000 + t * (0.0471 - 0.4000),   // R: 0.40 → 0.05
    0.8784 + t * (0.0118 - 0.8784),   // G: 0.88 → 0.01
    0.9647 + t * (0.4078 - 0.9647)    // B: 0.96 → 0.41
  );
}
const PAL_HEC = Array.from({ length: PAL_N }, (_, i) => {
  const c = palColorHec(i / (PAL_N - 1));
  c.offsetHSL(0, 0.35, 0);
  return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
});
const HEC_SCALE = 5000;
function palMatHec(eMev) {
  const tv = Math.max(0, Math.min(1, eMev / HEC_SCALE));
  return PAL_HEC[Math.round(tv * (PAL_N - 1))];
}

// ── Palette LAr: #17cf42 (min) → #270042 (max), linear ──────────────────────
function palColorLAr(t) {
  t = Math.max(0, Math.min(1, t));
  return new THREE.Color(
    0.0902 + t * (0.1529 - 0.0902),   // R: 0.09 → 0.15
    0.8118 + t * (0.0000 - 0.8118),   // G: 0.81 → 0
    0.2588                              // B: constant
  );
}
const PAL_LAR = Array.from({ length: PAL_N }, (_, i) => {
  const c = palColorLAr(i / (PAL_N - 1));
  c.offsetHSL(0, 0.35, 0);
  return new THREE.MeshBasicMaterial({ color: c, side: THREE.FrontSide });
});
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
let ghostSolidOpacity = 0.06;  // 94% transparent

const ghostSolidMat = new THREE.MeshBasicMaterial({
  color: ghostSolidColor, transparent: true, opacity: ghostSolidOpacity,
  depthWrite: false, side: THREE.DoubleSide,
});
// Phi lines: fixed white + high transparency (90%), independent of the alpha
// slider which only affects the solid envelope. This keeps them as subtle
// segmentation guides regardless of envelope opacity.
const GHOST_PHI_FIXED_OPACITY = 0.06;
const ghostPhiMat = new THREE.LineBasicMaterial({
  color: 0xFFFFFF, transparent: true, opacity: GHOST_PHI_FIXED_OPACITY, depthWrite: false,
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
  // Phi lines stay locked at white + high transparency — don't inherit from slider.
  ghostPhiMat.opacity = GHOST_PHI_FIXED_OPACITY;
  ghostPhiMat.color.set(0xFFFFFF);
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', precision: 'mediump', preserveDrawingBuffer: true, stencil: false, depth: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.sortObjects = false;

// ── Scene / Camera / Controls ─────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020d1c);
scene.matrixAutoUpdate = false;  // we manage transforms manually
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

// No lights needed — all cell materials are MeshBasicMaterial (unlit)

// ── FPS counter ──────────────────────────────────────────────────────────────
const fpsEl = document.createElement('div');
Object.assign(fpsEl.style, {
  position: 'fixed', bottom: '8px', right: '10px', zIndex: '9999',
  fontFamily: 'monospace', fontSize: '13px', color: '#66ccff',
  opacity: '0.45', pointerEvents: 'none', userSelect: 'none',
});
document.body.appendChild(fpsEl);
let _fpsFrames = 0, _fpsLast = performance.now();

// ── Render loop ───────────────────────────────────────────────────────────────
(function loop() {
  requestAnimationFrame(loop);
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 500) {
    fpsEl.textContent = ((_fpsFrames / (now - _fpsLast)) * 1000).toFixed(0) + ' FPS';
    _fpsFrames = 0; _fpsLast = now;
  }
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
const statusTxtEl = document.getElementById('status-txt');
function setStatus(h) { statusTxtEl.innerHTML = h; }
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
// Fetches CaloGeometry.glb.gz, stream-decompresses via DecompressionStream (native
// browser API, no extra library), then parses with GLTFLoader.parse().
// Progress tracks the compressed download bytes → 0–40% of the loading bar.
setLoadProgress(0, 'Downloading geometry…');
(async () => {
  let buffer;
  try {
    const res = await fetch('./geometry_data/CaloGeometry.glb.gz');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total  = parseInt(res.headers.get('Content-Length') || '0', 10);
    let   loaded = 0;
    // TransformStream counts compressed bytes for the progress bar,
    // then DecompressionStream inflates the gzip payload on the fly.
    const counter = new TransformStream({ transform(chunk, ctrl) {
      loaded += chunk.byteLength;
      if (total) {
        const pct = loaded / total;
        setLoadProgress(pct * 40, `Downloading geometry… ${Math.round(pct * 100)}%`);
        setStatus(`Downloading geometry: ${Math.round(pct * 100)}%`);
      }
      ctrl.enqueue(chunk);
    }});
    buffer = await new Response(
      res.body.pipeThrough(counter).pipeThrough(new DecompressionStream('gzip'))
    ).arrayBuffer();
  } catch (e) {
    setStatus('<span class="warn">CaloGeometry.glb.gz not found.</span>');
    addLog(t('log-glb-notfound'), 'warn');
    setLoadProgress(100, 'Geometry skipped');
    sceneOk = true; checkReady();
    return;
  }
  new GLTFLoader().parse(
    buffer, './',
    ({ scene: g }) => {
      // Add the GLB root as a single scene child instead of N individual scene.add(mesh) calls.
      scene.add(g);
      g.traverse(o => {
        if (!o.isMesh) return;
        o.matrixAutoUpdate = false;
        o.frustumCulled = false;  // all cells inside camera bounds always
        o.visible = false;
        meshByName.set(o.name, o);
        const mkey = meshNameToKey(o.name);
        if (mkey !== null) meshByKey.set(mkey, o);
        origMat.set(o.name, o.material);
      });
      sceneOk = true; dirty = true;
      setLoadProgress(100, 'Geometry loaded');
      addLog(t('log-glb-loaded'), 'ok');
      checkReady();
    },
    e => {
      setStatus(`<span class="warn">GLB parse error: ${esc(e.message)}</span>`);
      addLog('GLB parse error: ' + e.message, 'err');
    }
  );
})();

// ── WASM ──────────────────────────────────────────────────────────────────────
wasmInit()
  .then(() => {
    wasmOk = true;
    addLog(t('log-wasm-ready'), 'ok');
    checkReady();
  })
  .catch(e  => {
    setStatus(`<span class="err">WASM: ${esc(e.message)}</span>`);
    addLog(t('log-wasm-error') + e.message, 'err');
  });

// ── TileCal cell display label ────────────────────────────────────────────────
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

// ── HEC group name/innerBins — used for physLarHecEta reconstruction ──────────
const HEC_NAMES  = ['1', '23', '45', '67'];
const HEC_INNER  = [10, 10, 9, 8];

// ── Physical η / φ coordinate helpers ────────────────────────────────────────
// Mirror the formulas from parser/src/lib.rs so the tooltip shows real values.

function _larEmGlobalEtaOffset(absbe, sampling, region) {
  if (absbe===1 && sampling===1 && region===1) return 448;
  if (absbe===1 && sampling===2 && region===1) return 56;
  if (absbe===2 && sampling===1 && region===1) return 1;
  if (absbe===2 && sampling===1 && region===2) return 4;
  if (absbe===2 && sampling===1 && region===3) return 100;
  if (absbe===2 && sampling===1 && region===4) return 148;
  if (absbe===2 && sampling===1 && region===5) return 212;
  if (absbe===2 && sampling===2 && region===1) return 1;
  if (absbe===3 && sampling===1 && region===0) return 216;
  if (absbe===3 && sampling===2 && region===0) return 44;
  return 0;
}
const _LAR_EM_ETA_TABLE = {
  '1,0,0':[0.0,0.025],     '1,1,0':[0.003125,0.003125], '1,1,1':[1.4,0.025],
  '1,2,0':[0.0,0.025],     '1,2,1':[1.4,0.075],         '1,3,0':[0.0,0.05],
  '2,0,0':[1.5,0.025],     '2,1,0':[1.375,0.05],        '2,1,1':[1.425,0.025],
  '2,1,2':[1.5,0.003125],  '2,1,3':[1.8,0.004167],      '2,1,4':[2.0,0.00625],
  '2,1,5':[2.4,0.025],     '2,2,0':[1.375,0.05],        '2,2,1':[1.425,0.025],
  '2,3,0':[1.5,0.05],      '3,1,0':[2.5,0.1],           '3,2,0':[2.5,0.1],
};
function physLarEmEta(be, sampling, region, globalEta) {
  const absbe  = Math.abs(be);
  const offset = _larEmGlobalEtaOffset(absbe, sampling, region);
  const etaIdx = globalEta - offset;
  const [eta0, deta] = _LAR_EM_ETA_TABLE[`${absbe},${sampling},${region}`] ?? [0.0, 0.1];
  const absEta = eta0 + etaIdx * deta + deta / 2;
  return be < 0 ? -absEta : absEta;
}
function physLarEmPhi(be, sampling, region, phiIdx) {
  const absbe = Math.abs(be);
  let nPhi = 64;
  if (absbe===1 && region===1)              nPhi = 256;
  else if (absbe===1 && (sampling===2 || sampling===3)) nPhi = 256;
  else if (absbe===2 && (sampling===2 || sampling===3)) nPhi = 256;
  return _wrapPhi((phiIdx + 0.5) * 2 * Math.PI / nPhi);
}

const _LAR_HEC_ETA_TABLE = {
  '0,0':[1.5,0.1], '1,0':[1.5,0.1], '2,0':[1.6,0.1], '3,0':[1.7,0.1],
  '0,1':[2.5,0.2], '1,1':[2.5,0.2], '2,1':[2.5,0.2], '3,1':[2.5,0.2],
};
function physLarHecEta(be, sampling, region, etaIdx) {
  const [eta0, deta] = _LAR_HEC_ETA_TABLE[`${sampling},${region}`] ?? [1.5, 0.1];
  const absEta = eta0 + etaIdx * deta + deta / 2;
  return be < 0 ? -absEta : absEta;
}
function physLarHecPhi(region, phiIdx) {
  const nPhi = region === 0 ? 64 : 32;
  return _wrapPhi((phiIdx + 0.5) * 2 * Math.PI / nPhi);
}

function physTileEta(section, side, tower, sampling) {
  let absEta;
  if (section === 3) {
    if      (tower === 8)  absEta = 0.8;
    else if (tower === 9)  absEta = 1.05;
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
function _wrapPhi(phi) { return phi > Math.PI ? phi - 2 * Math.PI : phi; }
function physTilePhi(module) { return _wrapPhi((module + 0.5) * 2 * Math.PI / 64); }

// ── XML parsers ───────────────────────────────────────────────────────────────
// ── Shared XML cell extractor (operates on a pre-parsed Document) ─────────────
function extractCells(doc, tagName) {
  const els = doc.getElementsByTagName(tagName);
  const cells = [];
  for (const el of els) {
    let n = 0;
    for (const ch of el.children) {
      const id = ch.getAttribute('id') ?? ch.getAttribute('cellID');
      const ev = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (id && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ id: id.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const idEl = el.querySelector('id, cellID');
    const eEl  = el.querySelector('energy, e');
    if (idEl && eEl) {
      const ids = idEl.textContent.trim().split(/\s+/);
      const ens = eEl.textContent.trim().split(/\s+/).map(Number);
      const m   = Math.min(ids.length, ens.length);
      for (let i = 0; i < m; i++) if (ids[i] && isFinite(ens[i])) cells.push({ id: ids[i], energy: ens[i] });
    }
  }
  return cells;
}

// ── Single-pass XML parse — returns one Document for all detectors ────────────
function parseXmlDoc(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const pe  = doc.querySelector('parsererror');
  if (pe) throw new Error('XML parse error: ' + pe.textContent.slice(0, 120));
  return doc;
}

function parseTile(doc) {
  const cells = extractCells(doc, 'TILE');
  return cells; // empty array is fine — LAr may still exist
}

function parseLAr(doc) {
  return extractCells(doc, 'LAr');
}

function parseHec(doc) {
  return extractCells(doc, 'HEC');
}

function parseMBTS(doc) {
  const cells = [];
  const els = doc.getElementsByTagName('MBTS');
  for (const el of els) {
    let n = 0;
    for (const ch of el.children) {
      const label = ch.getAttribute('label');
      const ev    = ch.getAttribute('energy') ?? ch.getAttribute('e');
      if (label && ev) { const e = parseFloat(ev); if (isFinite(e)) { cells.push({ label: label.trim(), energy: e }); n++; } }
    }
    if (n) continue;
    const lblEl = el.querySelector('label');
    const eEl   = el.querySelector('energy, e');
    if (lblEl && eEl) {
      const labels = lblEl.textContent.trim().split(/\s+/);
      const ens    = eEl.textContent.trim().split(/\s+/).map(Number);
      const m      = Math.min(labels.length, ens.length);
      for (let i = 0; i < m; i++) if (labels[i] && isFinite(ens[i])) cells.push({ label: labels[i], energy: ens[i] });
    }
  }
  return cells;
}

// ── Track polylines ───────────────────────────────────────────────────────────
// JiveXML stores polyline coordinates in cm; the Three.js scene uses mm → ×10.
// numPolyline[i] = number of points for track i.
// polylineX/Y/Z are the flattened point arrays (one segment per track).
function parseTracks(doc) {
  const tracks = [];
  for (const el of doc.getElementsByTagName('Track')) {
    const numPolyEl = el.querySelector('numPolyline');
    const pxEl      = el.querySelector('polylineX');
    const pyEl      = el.querySelector('polylineY');
    const pzEl      = el.querySelector('polylineZ');
    if (!numPolyEl || !pxEl || !pyEl || !pzEl) continue;
    const numPoly = numPolyEl.textContent.trim().split(/\s+/).map(Number);
    const xs      = pxEl.textContent.trim().split(/\s+/).map(Number);
    const ys      = pyEl.textContent.trim().split(/\s+/).map(Number);
    const zs      = pzEl.textContent.trim().split(/\s+/).map(Number);
    const ptEl    = el.querySelector('pt');
    const ptArr   = ptEl ? ptEl.textContent.trim().split(/\s+/).map(Number) : [];

    // Hit IDs (subdet=2): numHits[i] hits belong to track i, flattened in <hits>
    const numHitsEl  = el.querySelector('numHits');
    const hitsEl     = el.querySelector('hits');
    const numHitsArr = numHitsEl ? numHitsEl.textContent.trim().split(/\s+/).map(Number) : [];
    const allHitStrs = hitsEl    ? hitsEl.textContent.trim().split(/\s+/)                : [];

    const storeGateKey = el.getAttribute('storeGateKey') ?? '';
    let offset = 0, hitOffset = 0;
    for (let i = 0; i < numPoly.length; i++) {
      const n  = numPoly[i];
      const nh = numHitsArr[i] ?? 0;
      const hitIds = allHitStrs.slice(hitOffset, hitOffset + nh);
      hitOffset += nh;
      if (n >= 2) {
        const pts = [];
        for (let j = 0; j < n; j++) {
          const k = offset + j;
          pts.push(new THREE.Vector3(-xs[k] * 10, -ys[k] * 10, zs[k] * 10));
        }
        const ptGev = i < ptArr.length ? Math.abs(ptArr[i]) : 0;
        tracks.push({ pts, ptGev, hitIds, storeGateKey });
      }
      offset += n;
    }
  }
  return tracks;
}



// ── Cell-ID subdetector decoder ───────────────────────────────────────────────
// Uses BigInt to safely handle 64-bit IDs.
// Bit layout (MSB-first, per ATLAS IdDict / lib.rs):
//   bits 63-61 (3 bits): subdet index → maps to [2,4,5,7,10,11,12,13]
//     4 = LArCalorimeter, 5 = TileCalorimeter
//   bits 60-58 (3 bits, only when subdet=4): part index → maps to [-3,-2,-1,1,2,3,4,5]
//     |part|=1 → LAr EM,  |part|=2 → LAr HEC
const _CELL_SUBDET_MAP = [2, 4, 5, 7, 10, 11, 12, 13];
const _CELL_PART_MAP   = [-3, -2, -1, 1, 2, 3, 4, 5];

function decodeCellSubdet(idStr) {
  const id     = BigInt(idStr);
  const sdIdx  = Number((id >> 61n) & 7n);
  const subdet = _CELL_SUBDET_MAP[sdIdx];
  if (subdet === 5) return 'TILE';
  if (subdet === 2) return 'TRACK';
  if (subdet === 4) {
    const ptIdx = Number((id >> 58n) & 7n);
    const part  = Math.abs(_CELL_PART_MAP[ptIdx] ?? 0);
    if (part === 1) return 'LAR_EM';
    if (part === 2) return 'HEC';
  }
  return 'OTHER';
}

// ── Cluster (eta/phi) parser ──────────────────────────────────────────────────
// Returns flat [{eta, phi, etGev, cells, storeGateKey}] where cells is:
//   { TILE: string[], LAR_EM: string[], HEC: string[], OTHER: string[] }
function parseClusters(doc) {
  const flat        = [];
  const collections = [];

  for (const el of doc.getElementsByTagName('Cluster')) {
    const key        = el.getAttribute('storeGateKey') ?? '';
    const etaEl      = el.querySelector('eta');
    const phiEl      = el.querySelector('phi');
    const etEl       = el.querySelector('et');
    const numCellsEl = el.querySelector('numCells');
    const cellsEl    = el.querySelector('cells');
    if (!etaEl || !phiEl) continue;

    const etas        = etaEl.textContent.trim().split(/\s+/).map(Number);
    const phis        = phiEl.textContent.trim().split(/\s+/).map(Number);
    const ets         = etEl       ? etEl.textContent.trim().split(/\s+/).map(Number) : [];
    const numCellsArr = numCellsEl ? numCellsEl.textContent.trim().split(/\s+/).map(Number) : [];
    const allCellStrs = cellsEl    ? cellsEl.textContent.trim().split(/\s+/)            : [];

    const m = Math.min(etas.length, phis.length);
    const collClusters = [];
    let offset = 0;
    for (let i = 0; i < m; i++) {
      const nc      = numCellsArr[i] ?? 0;
      const rawIds  = allCellStrs.slice(offset, offset + nc);
      offset += nc;
      if (!isFinite(etas[i]) || !isFinite(phis[i])) continue;

      // Group cell IDs by subdetector
      const cells = { TILE: [], LAR_EM: [], HEC: [], TRACK: [], OTHER: [] };
      for (const idStr of rawIds) {
        if (!idStr) continue;
        cells[decodeCellSubdet(idStr)].push(idStr);
      }

      const entry = { eta: etas[i], phi: phis[i], etGev: isFinite(ets[i]) ? ets[i] : 0, cells };
      collClusters.push(entry);
      flat.push({ ...entry, storeGateKey: key });
    }
    if (collClusters.length) collections.push({ key, clusters: collClusters });
  }

  lastClusterData = { collections };
  return flat;
}

// ── Track rendering ───────────────────────────────────────────────────────────
let thrTrackGev   = 2;
let trackPtMinGev = 0;
let trackPtMaxGev = 5;

// ── Cluster Et threshold ──────────────────────────────────────────────────────
let thrClusterEtGev   = 0;
let clusterEtMinGev   = 0;
let clusterEtMaxGev   = 1;

const TRACK_MAT = new THREE.LineBasicMaterial({ color: 0xffea00, linewidth: 2 });

function clearTracks() {
  if (!trackGroup) return;
  trackGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(trackGroup);
  trackGroup = null;
}

function applyTrackThreshold() {
  if (!trackGroup) return;
  for (const child of trackGroup.children)
    child.visible = child.userData.ptGev >= thrTrackGev;
  dirty = true;
}

function drawTracks(tracks) {
  clearTracks();
  if (!tracks.length) return;
  trackGroup = new THREE.Group();
  trackGroup.renderOrder = 5;
  trackGroup.visible = (typeof tracksVisible === 'undefined') ? true : tracksVisible;
  for (const { pts, ptGev, hitIds, storeGateKey } of tracks) {
    const geo  = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, TRACK_MAT);
    line.userData.ptGev        = ptGev;
    line.userData.hitIds       = hitIds;
    line.userData.storeGateKey = storeGateKey;
    line.matrixAutoUpdate = false;
    trackGroup.add(line);
  }
  trackGroup.matrixAutoUpdate = false;
  scene.add(trackGroup);
  applyTrackThreshold();
}

// ── Cluster line rendering ────────────────────────────────────────────────────
// Lines are drawn from the origin in the η/φ direction, 5 m = 5000 mm long.
// Coordinate convention matches tracks: Three.js X = −ATLAS x, Y = −ATLAS y.
const CLUSTER_MAT = new THREE.LineDashedMaterial({
  color: 0xff4400, transparent: true, opacity: 0.55,
  dashSize: 40, gapSize: 60, depthWrite: false,
});
// Inner cylinder (start): r = 1.4 m, h = 6.4 m
const CLUSTER_CYL_IN_R      = 1400;
const CLUSTER_CYL_IN_HALF_H = 3200;
// Outer cylinder (end):   r = 4.25 m, h = 12 m
const CLUSTER_CYL_OUT_R      = 3820;
const CLUSTER_CYL_OUT_HALF_H = 6000;

// Returns t at which the unit-direction ray (dx,dy,dz) from the origin hits
// the surface of a cylinder with given radius and half-height.
function _cylIntersect(dx, dy, dz, r, halfH) {
  const rT = Math.sqrt(dx * dx + dy * dy);
  if (rT > 1e-9) {
    const tBarrel = r / rT;
    if (Math.abs(dz * tBarrel) <= halfH) return tBarrel;
  }
  return halfH / Math.abs(dz);
}

function clearClusters() {
  if (!clusterGroup) return;
  clusterGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  scene.remove(clusterGroup);
  clusterGroup = null;
}

function rebuildActiveClusterCellIds() {
  if (!clusterFilterEnabled || !lastClusterData) { activeClusterCellIds = null; activeMbtsLabels = null; return; }
  const ids  = new Set();
  const mbts = new Set();
  for (const { clusters } of lastClusterData.collections) {
    for (const { eta, phi: rawPhi, etGev, cells } of clusters) {
      if (etGev < thrClusterEtGev) continue;
      for (const k of ['TILE', 'LAR_EM', 'HEC', 'TRACK', 'OTHER'])
        for (const id of cells[k]) ids.add(id);
      // MBTS activation: map cluster (eta, phi) → type_X_ch_Y_mod_Z
      const absEta = Math.abs(eta);
      let ch;
      if      (absEta >= 2.78 && absEta <= 3.86) ch = 1;
      else if (absEta >= 2.08 && absEta <  2.78) ch = 0;
      else continue; // outside MBTS eta range
      const type    = eta >= 0 ? 1 : -1;
      const phiPos  = rawPhi < 0 ? rawPhi + 2 * Math.PI : rawPhi;
      const mod     = Math.floor(phiPos / (2 * Math.PI / 8)) % 8;
      mbts.add(`type_${type}_ch_${ch}_mod_${mod}`);
    }
  }
  activeClusterCellIds = ids;
  activeMbtsLabels     = mbts;
}

function applyClusterThreshold() {
  if (clusterGroup)
    for (const child of clusterGroup.children)
      child.visible = clusterFilterEnabled && child.userData.etGev >= thrClusterEtGev;
  rebuildActiveClusterCellIds();
  applyThreshold();
  applyTrackThreshold();
}

function drawClusters(clusters) {
  clearClusters();
  if (!clusters.length) return;
  clusterGroup = new THREE.Group();
  clusterGroup.renderOrder = 6;
  clusterGroup.visible = (typeof clustersVisible === 'undefined') ? true : clustersVisible;
  for (const { eta, phi, etGev, storeGateKey } of clusters) {
    const theta = 2 * Math.atan(Math.exp(-eta));
    const sinT  = Math.sin(theta);
    const dx = -sinT * Math.cos(phi);
    const dy = -sinT * Math.sin(phi);
    const dz =  Math.cos(theta);
    const t0 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_IN_R,  CLUSTER_CYL_IN_HALF_H);
    const t1 = _cylIntersect(dx, dy, dz, CLUSTER_CYL_OUT_R, CLUSTER_CYL_OUT_HALF_H);
    const start = new THREE.Vector3(dx * t0, dy * t0, dz * t0);
    const end   = new THREE.Vector3(dx * t1, dy * t1, dz * t1);
    const geo  = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, CLUSTER_MAT);
    line.computeLineDistances();
    line.userData.etGev        = etGev;
    line.userData.storeGateKey = storeGateKey ?? '';
    line.matrixAutoUpdate = false;
    clusterGroup.add(line);
  }
  clusterGroup.matrixAutoUpdate = false;
  scene.add(clusterGroup);
  applyClusterThreshold();
}

// ── Scene reset ───────────────────────────────────────────────────────────────
function resetScene() {
  for (const [name, mesh] of meshByName) {
    mesh.visible = false; mesh.material = origMat.get(name) ?? mesh.material; mesh.renderOrder = 0;
  }
  // Re-apply ghost state: resetScene hides all meshes (including ghost envelopes),
  // which would desync the visible state from `showGhostTile` and make the ghost
  // look transparent/recolored on next toggle because only phi lines are visible.
  applyGhostMesh(showGhostTile);
  active.clear(); rayTargets = [];
  clearOutline(); clearAllOutlines();
  clearTracks();
  clearClusters();
  lastClusterData      = null;
  activeClusterCellIds = null;
  activeMbtsLabels     = null;
  tooltip.hidden = true; dirty = true;
}
function applyThreshold() {
  rayTargets = [];
  for (const [mesh, { energyMev, det, cellId, mbtsLabel }] of active) {
    const thr    = det === 'LAR' ? thrLArMev  : det === 'HEC' ? thrHecMev : thrTileMev;
    const detOn  = det === 'LAR' ? showLAr    : det === 'HEC' ? showHec   : showTile;
    let inCluster;
    if (activeClusterCellIds === null) {
      inCluster = true;                                           // no cluster data → no filter
    } else if (mbtsLabel != null) {
      inCluster = activeMbtsLabels !== null && activeMbtsLabels.has(mbtsLabel); // MBTS: cluster eta/phi match
    } else if (cellId != null) {
      inCluster = activeClusterCellIds.has(cellId);              // normal cell: ID match
    } else {
      inCluster = true;                                           // no ID and not MBTS → always pass
    }
    const vis = detOn && (!isFinite(thr) || energyMev >= thr) && inCluster;
    mesh.visible = vis; if (vis) rayTargets.push(mesh);
  }
  rebuildAllOutlines();
  dirty = true;
}

// ── Process XML ───────────────────────────────────────────────────────────────
function processXml(xmlText) {
  if (!wasmOk) return;
  const t0 = performance.now();

  // Parse XML once — all detectors share the same Document
  let doc, tileCells, larCells, hecCells, mbtsCells;
  try { doc = parseXmlDoc(xmlText); }
  catch (e) { setStatus(`<span class="err">${esc(e.message)}</span>`); addLog(e.message, 'err'); return; }
  try { tileCells = parseTile(doc); } catch { tileCells = []; }
  try { larCells  = parseLAr(doc);  } catch { larCells  = []; }
  try { hecCells  = parseHec(doc);  } catch { hecCells  = []; }
  try { mbtsCells = parseMBTS(doc); } catch { mbtsCells = []; }

  const total = tileCells.length + larCells.length + hecCells.length + mbtsCells.length;
  if (!total) { setStatus('<span class="warn">No TILE, LAr, HEC or MBTS cells found</span>'); addLog('No cells in XML', 'warn'); return; }

  setStatus(`Decoding ${total} cells…`);
  resetScene();

  // ── Particle tracks ─────────────────────────────────────────────────────────
  try {
    const raw = parseTracks(doc);
    if (raw.length) {
      trackPtMinGev = 0;
      trackPtMaxGev = 5;
      thrTrackGev   = 2;
      trackPtSlider.update(0, 5);
    }
    drawTracks(raw);
  } catch (e) { console.warn('Track parse error', e); }

  // ── Cluster η/φ lines ────────────────────────────────────────────────────────
  try {
    const rawClusters = parseClusters(doc);
    if (rawClusters.length) {
      let etMin = Infinity, etMax = -Infinity;
      for (const { etGev } of rawClusters) {
        if (etGev < etMin) etMin = etGev;
        if (etGev > etMax) etMax = etGev;
      }
      clusterEtSlider.update(
        etMin === Infinity ? 0 : Math.max(0, etMin),
        etMax === -Infinity ? 1 : etMax,
      );
    }
    drawClusters(rawClusters);
    rebuildActiveClusterCellIds();
  } catch (e) { console.warn('Cluster parse error', e); }


  // Per-detector energy ranges — single loop per detector, avoids spread stack overflow
  function minMax(cells) {
    let mn = Infinity, mx = -Infinity;
    for (const { energy } of cells) { const v = energy * 1000; if (isFinite(v) && v > 0) { if (v < mn) mn = v; if (v > mx) mx = v; } }
    return mn === Infinity ? [0, 1] : [mn, mx];
  }
  // MBTS shares the Tile palette — merge its range with Tile's
  const allTileCells = tileCells.concat(mbtsCells);
  [tileMinMev, tileMaxMev] = minMax(allTileCells);
  [larMinMev,  larMaxMev]  = minMax(larCells);
  [hecMinMev,  hecMaxMev]  = minMax(hecCells);

  let nTile = 0, nLAr = 0, nHec = 0, nMbts = 0, nMiss = 0, nSkip = 0;
  let nHecMiss = 0, nMbtsMiss = 0;

  // ── Bulk decode: one WASM call per detector replaces N individual FFI calls ──
  // Build ID strings without intermediate array allocation
  function idsToStr(cells) {
    let s = cells[0].id;
    for (let i = 1; i < cells.length; i++) s += ' ' + cells[i].id;
    return s;
  }
  const tilePacked = tileCells.length ? parse_atlas_ids_bulk(idsToStr(tileCells)) : null;
  const larPacked  = larCells.length  ? parse_atlas_ids_bulk(idsToStr(larCells))  : null;
  const hecPacked  = hecCells.length  ? parse_atlas_ids_bulk(idsToStr(hecCells))  : null;

  // ── TileCal cells ─────────────────────────────────────────────────────────
  for (let i = 0; i < tileCells.length; i++) {
    const base = i * 8;
    if (tilePacked[base] !== SUBSYS_TILE) { nSkip++; continue; }
    const x       = tilePacked[base + 1];
    const k       = tilePacked[base + 2];
    const side    = tilePacked[base + 3];
    const module  = tilePacked[base + 4];
    const section = tilePacked[base + 5];
    const tower   = tilePacked[base + 6];
    const sampling= tilePacked[base + 7];
    const { id, energy } = tileCells[i];
    const eMev = energy * 1000;
    const s_bit = side < 0 ? 0 : 1;
    const mesh  = meshByKey.get(_tileKey(x, s_bit, k, module));
    if (!mesh) { console.warn(`[TILE] id=${id} | Tile${x}${s_bit?'p':'n'} k=${k} mod=${module}`); nMiss++; continue; }
    mesh.material = palMatTile(eMev); mesh.visible = true; mesh.renderOrder = 2;
    const tEta = physTileEta(section, side, tower, sampling);
    const tPhi = physTilePhi(module);
    active.set(mesh, { energyGev: energy, energyMev: eMev, cellName: cellLabel(x, k), coords: `η = ${tEta.toFixed(3)}   φ = ${tPhi.toFixed(3)} rad`, det: 'TILE', cellId: id });
    nTile++;
  }

  // ── LAr EM cells ──────────────────────────────────────────────────────────
  for (let i = 0; i < larCells.length; i++) {
    const base    = i * 8;
    if (larPacked[base] !== SUBSYS_LAR_EM) { nSkip++; continue; }
    const abs_be  = larPacked[base + 1];
    const sampling= larPacked[base + 2];
    const region  = larPacked[base + 3];
    const z_pos   = larPacked[base + 4];
    const R       = larPacked[base + 5];
    const eta     = larPacked[base + 6];
    const phi     = larPacked[base + 7];
    const { id, energy } = larCells[i];
    const eMev = energy * 1000;
    let mesh = meshByKey.get(_larEmKey(abs_be, sampling, R, z_pos, eta, phi, 0));
    if (!mesh) mesh = meshByKey.get(_larEmKey(abs_be, sampling, R, z_pos, eta, phi, 1));
    if (!mesh) {
      console.warn(`[LAr EM] id=${id} | abs_be=${abs_be} samp=${sampling} R=${R} z=${z_pos} η=${eta} φ=${phi}`);
      nMiss++; continue;
    }
    mesh.material = palMatLAr(eMev); mesh.visible = true; mesh.renderOrder = 2;
    const rName = abs_be === 1 ? `EMB${sampling}` : abs_be === 2 ? `EMEC${sampling}` : `EMEC${sampling} (inner)`;
    const bec   = abs_be * (z_pos ? 1 : -1);
    const lEta  = physLarEmEta(bec, sampling, region, eta);
    const lPhi  = physLarEmPhi(bec, sampling, region, phi);
    active.set(mesh, { energyGev: energy, energyMev: eMev, cellName: rName, coords: `η = ${lEta.toFixed(3)}   φ = ${lPhi.toFixed(3)} rad`, det: 'LAR', cellId: id });
    nLAr++;
  }

  // ── LAr HEC cells ─────────────────────────────────────────────────────────
  for (let i = 0; i < hecCells.length; i++) {
    const base     = i * 8;
    if (hecPacked[base] !== SUBSYS_LAR_HEC) { nSkip++; continue; }
    const group    = hecPacked[base + 1];
    const region   = hecPacked[base + 2];
    const z_pos    = hecPacked[base + 3];
    const cum_eta  = hecPacked[base + 4];
    const phi      = hecPacked[base + 5];
    const { id, energy } = hecCells[i];
    const eMev = energy * 1000;
    const mesh = meshByKey.get(_hecKey(group, region, z_pos, cum_eta, phi));
    if (!mesh) {
      console.warn(`[HEC] id=${id} | group=${group} region=${region} z=${z_pos} cumη=${cum_eta} φ=${phi}`);
      nHecMiss++; continue;
    }
    mesh.material = palMatHec(eMev); mesh.visible = true; mesh.renderOrder = 2;
    const be      = z_pos ? 2 : -2;
    const eta_idx = region === 0 ? cum_eta : cum_eta - HEC_INNER[group];
    const hLabel  = `HEC${group + 1}`;
    const hEta    = physLarHecEta(be, group, region, eta_idx);
    const hPhi    = physLarHecPhi(region, phi);
    active.set(mesh, { energyGev: energy, energyMev: eMev, cellName: hLabel, coords: `η = ${hEta.toFixed(3)}   φ = ${hPhi.toFixed(3)} rad`, det: 'HEC', cellId: id });
    nHec++;
  }

  // ── MBTS cells (direct label→key, no WASM needed) ────────────────────────
  for (let i = 0; i < mbtsCells.length; i++) {
    const { label, energy } = mbtsCells[i];
    const eMev = energy * 1000;
    const _m = /^type_(-?1)_ch_([01])_mod_([0-7])$/.exec(label);
    if (!_m) { console.warn(`[MBTS] label=${label} | bad format`); nMbtsMiss++; continue; }
    const tileNum = _m[2]==='0' ? 14 : 15, s_bit = _m[1]==='1' ? 1 : 0, mod = +_m[3];
    const mesh = meshByKey.get(_tileKey(tileNum, s_bit, 0, mod));
    if (!mesh) { console.warn(`[MBTS] label=${label} | no mesh`); nMbtsMiss++; continue; }
    mesh.material = palMatTile(eMev); mesh.visible = true; mesh.renderOrder = 2;
    const mbtsCoords = `η = ${((s_bit?1:-1)*(_m[2]==='0'?2.76:3.84)).toFixed(3)}   φ = ${_wrapPhi(2*Math.PI/16+mod*2*Math.PI/8).toFixed(3)} rad`;
    active.set(mesh, { energyGev: energy, energyMev: eMev, cellName: 'MBTS', coords: mbtsCoords, det: 'TILE', mbtsLabel: label });
    nMbts++;
  }

  initDetPanel(nTile > 0, nLAr > 0, nHec > 0, trackGroup && trackGroup.children.length > 0, clusterGroup && clusterGroup.children.length > 0);
  applyThreshold();
  const dt = ((performance.now() - t0) / 1000).toFixed(2);

  const nHit    = nTile + nMbts + nLAr + nHec;
  const allMiss = nMiss + nHecMiss + nMbtsMiss;
  const missStr = allMiss ? ` · <span class="warn">${allMiss} unmapped</span>` : '';
  setStatus(`<span class="ok">${nHit} cells</span>${missStr}`);
  if (nHecMiss)  addLog(`HEC: ${nHec} mapped · ${nHecMiss} unmapped`, 'warn');
  if (nMbtsMiss) addLog(`MBTS: ${nMbts} mapped · ${nMbtsMiss} unmapped`, 'warn');
  addLog(`${nHit} cells${allMiss ? ` · ${allMiss} unmapped` : ''} (${dt}s)`, 'ok');
}

// ── Right panel (rpanel) toggle — mirrors left panel behavior ────────────────
const rpanelWrap = document.getElementById('rpanel-wrap');
const btnRpanel  = document.getElementById('btn-rpanel');
let rpanelPinned = true;
let rpanelHovered = false;

function syncRPanelUI() {
  const open = rpanelPinned || rpanelHovered;
  rpanelWrap.classList.toggle('collapsed', !open);
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
rpanelWrap.addEventListener('mouseleave', () => {
  if (!rpanelPinned && rpanelHovered) { rpanelHovered = false; syncRPanelUI(); }
});
// Canvas click closes the right panel if it was hovered (not pinned)
canvas.addEventListener('click', () => {
  if (!rpanelPinned && rpanelHovered) { rpanelHovered = false; syncRPanelUI(); }
});
// Toolbar button — toggle pinned state
btnRpanel.addEventListener('click', e => {
  e.stopPropagation();
  setPinnedR(!rpanelPinned);
});
// Start collapsed
setPinnedR(false);

// ── Tab switching ─────────────────────────────────────────────────────────────
const TAB_IDS = ['tile', 'lar', 'hec', 'track'];
function switchTab(det) {
  const tabs = [...TAB_IDS];
  // Include 'cluster' only when its pane has been moved into #rpanel (mobile mode).
  const pc = document.getElementById('pane-cluster');
  if (pc && pc.parentElement && pc.parentElement.id === 'rpanel') tabs.push('cluster');
  tabs.forEach(d => {
    const pane = document.getElementById('pane-' + d);
    const tab  = document.getElementById('tab-'  + d);
    if (pane) pane.style.display = d === det ? 'flex' : 'none';
    if (tab)  tab.classList.toggle('on', d === det);
  });
  // Keep ghost pane always hidden
  const gp = document.getElementById('pane-ghost');
  if (gp) gp.style.display = 'none';
}
TAB_IDS.forEach(d => document.getElementById('tab-' + d).addEventListener('click', () => switchTab(d)));
document.getElementById('tab-cluster').addEventListener('click', () => switchTab('cluster'));
// Initialize: TILE pane visible, others hidden
switchTab('tile');

// ── Mobile layout: merge cluster panel into right panel as a tab ─────────────
// On mobile landscape, the dedicated cluster panel (#rpanel2) is hidden via CSS.
// Its pane is moved into #rpanel so the existing tab system shows it.
const mobileMQ = window.matchMedia('(orientation: landscape) and (max-height: 520px)');
const paneCluster = document.getElementById('pane-cluster');
const rpanelEl    = document.getElementById('rpanel');
const rpanel2El   = document.getElementById('rpanel2');
const paneClusterHome = paneCluster.parentElement; // original home (inside #rpanel2)
function applyMobileLayout(isMobile) {
  if (isMobile) {
    if (paneCluster.parentElement !== rpanelEl) rpanelEl.appendChild(paneCluster);
  } else {
    if (paneCluster.parentElement !== paneClusterHome) paneClusterHome.appendChild(paneCluster);
    paneCluster.style.display = 'flex';
  }
  // Re-apply tab selection. If coming back to desktop while cluster was active,
  // fall back to the TILE tab (cluster is not a tab on desktop).
  let cur = document.querySelector('#det-tab-bar .det-tab.on');
  let curId = cur ? cur.id.replace('tab-', '') : 'tile';
  if (!isMobile && curId === 'cluster') curId = 'tile';
  switchTab(curId);
}
applyMobileLayout(mobileMQ.matches);
mobileMQ.addEventListener('change', e => applyMobileLayout(e.matches));

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
    drag = true; rpanelWrap.classList.add('dragging'); track.setPointerCapture(e.pointerId);
    const r = ratioFromPtr(e, track); setThr(r <= 0 ? -Infinity : maxMev * r);
    updateUI(getThr()); applyThreshold();
  });
  track.addEventListener('pointermove', e => {
    if (!drag) return;
    const r = ratioFromPtr(e, track); setThr(r <= 0 ? -Infinity : maxMev * r);
    updateUI(getThr()); applyThreshold();
  });
  ['pointerup', 'pointercancel'].forEach(ev =>
    track.addEventListener(ev, () => { drag = false; rpanelWrap.classList.remove('dragging'); })
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

// ── Track pT slider (dynamic range — updates each event) ─────────────────────
function makeTrackPtSlider(trackId, thumbId, inputId, maxLblId, minLblId) {
  const trackEl  = document.getElementById(trackId);
  const thumbEl  = document.getElementById(thumbId);
  const inputEl  = document.getElementById(inputId);
  const maxLblEl = document.getElementById(maxLblId);
  const minLblEl = document.getElementById(minLblId);
  let drag = false;

  function fmtGev(v) { return v.toFixed(2) + ' GeV'; }

  function updateUI() {
    const span = trackPtMaxGev - trackPtMinGev;
    const r    = span > 0 ? Math.max(0, Math.min(1, (thrTrackGev - trackPtMinGev) / span)) : 0;
    thumbEl.style.top = ((1 - r) * 100) + '%';
    if (document.activeElement !== inputEl)
      inputEl.value = thrTrackGev > trackPtMinGev + 1e-9 ? fmtGev(thrTrackGev) : '';
  }

  function setFromRatio(r) {
    const span = trackPtMaxGev - trackPtMinGev;
    thrTrackGev = r <= 0 ? trackPtMinGev : trackPtMinGev + span * r;
    updateUI();
    applyTrackThreshold();
  }

  trackEl.addEventListener('pointerdown', e => {
    drag = true; rpanelWrap.classList.add('dragging'); trackEl.setPointerCapture(e.pointerId);
    setFromRatio(ratioFromPtr(e, trackEl));
  });
  trackEl.addEventListener('pointermove', e => { if (drag) setFromRatio(ratioFromPtr(e, trackEl)); });
  ['pointerup', 'pointercancel'].forEach(ev =>
    trackEl.addEventListener(ev, () => { drag = false; rpanelWrap.classList.remove('dragging'); })
  );
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') inputEl.blur(); });
  inputEl.addEventListener('blur', () => {
    const s = inputEl.value.trim().toLowerCase();
    if (!s || s === 'all') {
      thrTrackGev = trackPtMinGev;
    } else {
      const g = s.match(/^([\d.]+)\s*gev$/i);
      const v = g ? parseFloat(g[1]) : parseFloat(s);
      if (isFinite(v)) thrTrackGev = Math.max(trackPtMinGev, Math.min(trackPtMaxGev, v));
    }
    updateUI();
    applyTrackThreshold();
  });

  function update(minGev, maxGev) {
    trackPtMinGev = minGev;
    trackPtMaxGev = maxGev;
    thrTrackGev   = 2; // fixed initial threshold
    if (maxLblEl) maxLblEl.textContent = fmtGev(maxGev);
    if (minLblEl) minLblEl.textContent = fmtGev(minGev);
    updateUI();
  }

  return { updateUI, update };
}

const trackPtSlider = makeTrackPtSlider(
  'track-strak', 'track-sthumb', 'track-thr-input',
  'track-sval-max', 'track-sval-min'
);

// ── Cluster Et slider (dynamic range — updates each event) ───────────────────
function makeClusterEtSlider(trackId, thumbId, inputId, maxLblId, minLblId) {
  const trackEl  = document.getElementById(trackId);
  const thumbEl  = document.getElementById(thumbId);
  const inputEl  = document.getElementById(inputId);
  const maxLblEl = document.getElementById(maxLblId);
  const minLblEl = document.getElementById(minLblId);
  let drag = false;

  function fmtGev(v) { return v.toFixed(2) + ' GeV'; }

  function updateUI() {
    const span = clusterEtMaxGev - clusterEtMinGev;
    const r    = span > 0 ? Math.max(0, Math.min(1, (thrClusterEtGev - clusterEtMinGev) / span)) : 0;
    thumbEl.style.top = ((1 - r) * 100) + '%';
    if (document.activeElement !== inputEl)
      inputEl.value = thrClusterEtGev > clusterEtMinGev + 1e-9 ? fmtGev(thrClusterEtGev) : '';
  }

  function setFromRatio(r) {
    if (!clusterFilterEnabled) return;
    const span = clusterEtMaxGev - clusterEtMinGev;
    thrClusterEtGev = r <= 0 ? clusterEtMinGev : clusterEtMinGev + span * r;
    updateUI();
    applyClusterThreshold();
  }

  trackEl.addEventListener('pointerdown', e => {
    drag = true; rpanelWrap.classList.add('dragging'); trackEl.setPointerCapture(e.pointerId);
    setFromRatio(ratioFromPtr(e, trackEl));
  });
  trackEl.addEventListener('pointermove', e => { if (drag) setFromRatio(ratioFromPtr(e, trackEl)); });
  ['pointerup', 'pointercancel'].forEach(ev =>
    trackEl.addEventListener(ev, () => { drag = false; rpanelWrap.classList.remove('dragging'); })
  );
  inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') inputEl.blur(); });
  inputEl.addEventListener('blur', () => {
    if (!clusterFilterEnabled) {
      updateUI();
      return;
    }
    const s = inputEl.value.trim().toLowerCase();
    if (!s || s === 'all') {
      thrClusterEtGev = clusterEtMinGev;
    } else {
      const g = s.match(/^([\d.]+)\s*gev$/i);
      const v = g ? parseFloat(g[1]) : parseFloat(s);
      if (isFinite(v)) thrClusterEtGev = Math.max(clusterEtMinGev, Math.min(clusterEtMaxGev, v));
    }
    updateUI();
    applyClusterThreshold();
  });

  function update(minGev, maxGev) {
    clusterEtMinGev   = minGev;
    clusterEtMaxGev   = maxGev;
    thrClusterEtGev   = Math.max(3, minGev); // default 3 GeV
    if (maxLblEl) maxLblEl.textContent = fmtGev(maxGev);
    if (minLblEl) minLblEl.textContent = fmtGev(minGev);
    updateUI();
  }

  return { updateUI, update };
}

const clusterEtSlider = makeClusterEtSlider(
  'cluster-strak', 'cluster-sthumb', 'cluster-thr-input',
  'cluster-sval-max', 'cluster-sval-min'
);

function syncClusterFilterToggle() {
  const btn  = document.getElementById('cluster-filter-toggle');
  const pane = document.getElementById('pane-cluster');
  const input = document.getElementById('cluster-thr-input');
  if (!btn || !pane) return;
  btn.classList.toggle('on', clusterFilterEnabled);
  btn.setAttribute('aria-checked', clusterFilterEnabled ? 'true' : 'false');
  btn.textContent = clusterFilterEnabled ? 'On' : 'Off';
  pane.classList.toggle('cluster-filter-disabled', !clusterFilterEnabled);
  if (input) input.disabled = !clusterFilterEnabled;
}

// Initialize thumb positions at default threshold
tileSlider.updateUI(thrTileMev);
larSlider.updateUI(thrLArMev);
hecSlider.updateUI(thrHecMev);

function initDetPanel(hasTile, hasLAr, hasHec, hasTracks) {
  tileSlider.updateUI(thrTileMev);
  larSlider.updateUI(thrLArMev);
  hecSlider.updateUI(thrHecMev);
  clusterEtSlider.updateUI();
  syncClusterFilterToggle();
  openRPanel();
  if (hasTile) switchTab('tile'); else if (hasLAr) switchTab('lar'); else if (hasHec) switchTab('hec');
  else if (hasTracks) switchTab('track');
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
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 30));
  outlineMesh = new THREE.LineSegments(eGeoCache.get(uid), outlineMat);
  outlineMesh.matrixAutoUpdate = false;
  outlineMesh.matrix.copy(mesh.matrixWorld);
  outlineMesh.matrixWorld.copy(mesh.matrixWorld);
  outlineMesh.renderOrder = 999; outlineMesh.userData.src = mesh.name;
  scene.add(outlineMesh); dirty = true;
}

// ── All-cells outline (optimised: cached world-space edges per mesh) ─────────
const outlineAllMat = new THREE.LineBasicMaterial({ color: 0x000000 });
const _edgeWorldCache = new Map();  // mesh.name → Float32Array (world-space positions)
let _outlineTimer = 0;

function _getWorldEdges(mesh) {
  const cached = _edgeWorldCache.get(mesh.name);
  if (cached) return cached;
  mesh.updateWorldMatrix(true, false);
  const uid = mesh.geometry.uuid;
  if (!eGeoCache.has(uid)) eGeoCache.set(uid, new THREE.EdgesGeometry(mesh.geometry, 30));
  const src = eGeoCache.get(uid).getAttribute('position').array;
  const m = mesh.matrixWorld.elements;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    const x = src[i], y = src[i + 1], z = src[i + 2];
    out[i]     = m[0] * x + m[4] * y + m[8]  * z + m[12];
    out[i + 1] = m[1] * x + m[5] * y + m[9]  * z + m[13];
    out[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  }
  _edgeWorldCache.set(mesh.name, out);
  return out;
}

function clearAllOutlines() {
  clearTimeout(_outlineTimer);
  if (!allOutlinesMesh) return;
  scene.remove(allOutlinesMesh);
  allOutlinesMesh.geometry.dispose();
  allOutlinesMesh = null;
  dirty = true;
}

function rebuildAllOutlines() {
  clearAllOutlines();
  if (!rayTargets.length) return;
  _buildOutlinesNow();
}

function _buildOutlinesNow() {
  if (!rayTargets.length) return;
  // Count total floats needed
  let total = 0;
  const edgeArrays = new Array(rayTargets.length);
  for (let i = 0; i < rayTargets.length; i++) {
    const arr = _getWorldEdges(rayTargets[i]);
    edgeArrays[i] = arr;
    total += arr.length;
  }
  // Single allocation, memcpy each cached array
  const buf = new Float32Array(total);
  let offset = 0;
  for (let i = 0; i < edgeArrays.length; i++) {
    buf.set(edgeArrays[i], offset);
    offset += edgeArrays[i].length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  allOutlinesMesh = new THREE.LineSegments(geo, outlineAllMat);
  allOutlinesMesh.matrixAutoUpdate = false;
  allOutlinesMesh.frustumCulled = false;
  allOutlinesMesh.renderOrder = 3;
  scene.add(allOutlinesMesh);
  dirty = true;
}

// ── Hover tooltip — raycasting fix ───────────────────────────────────────────
const raycast  = new THREE.Raycaster();
raycast.firstHitOnly = true;  // stop after first intersection (much faster)
raycast.params.Line = { threshold: 25 };  // 25 mm hit zone for track lines
const mxy      = new THREE.Vector2();
const tooltip  = document.getElementById('tip');
let   lastRay  = 0;
let   mousePos = { x: 0, y: 0 };
document.addEventListener('mousemove', e => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
function doRaycast(clientX, clientY) {
  const hasTrackLines   = trackGroup   && trackGroup.visible   && trackGroup.children.length   > 0;
  const hasClusterLines = clusterGroup && clusterGroup.visible && clusterGroup.children.length > 0;
  if (!showInfo || cinemaMode || (!active.size && !hasTrackLines && !hasClusterLines)) { tooltip.hidden = true; clearOutline(); return; }
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
  const tipEKeyEl = document.querySelector('#tip .tkey');
  // ── Cell hit ──────────────────────────────────────────────────────────────
  if (active.size) {
    const hits = raycast.intersectObjects(rayTargets, false);
    if (hits.length) {
      const data = active.get(hits[0].object);
      if (data) {
        showOutline(hits[0].object);
        document.getElementById('tip-cell').textContent   = data.cellName;
        document.getElementById('tip-coords').textContent = data.coords ?? '';
        document.getElementById('tip-e').textContent      = `${data.energyGev.toFixed(4)} GeV`;
        if (tipEKeyEl) tipEKeyEl.textContent = t('tip-energy-key');
        tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
        tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
        tooltip.hidden = false; dirty = true; return;
      }
    }
  }
  // ── Track hit ─────────────────────────────────────────────────────────────
  if (hasTrackLines) {
    const visibleTracks = trackGroup.children.filter(c => c.visible);
    const trackHits = raycast.intersectObjects(visibleTracks, false);
    if (trackHits.length) {
      const line         = trackHits[0].object;
      const ptGev        = line.userData.ptGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      clearOutline();
      document.getElementById('tip-cell').textContent   = 'Track';
      document.getElementById('tip-coords').textContent = storeGateKey;
      document.getElementById('tip-e').textContent      = `${ptGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.textContent = 'pT';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; dirty = true; return;
    }
  }
  // ── Cluster hit ───────────────────────────────────────────────────────────
  if (hasClusterLines) {
    const visibleClusters = clusterGroup.children.filter(c => c.visible);
    const clusterHits = raycast.intersectObjects(visibleClusters, false);
    if (clusterHits.length) {
      const line         = clusterHits[0].object;
      console.log('[cluster hit] userData:', JSON.stringify(line.userData));
      const etGev        = line.userData.etGev        ?? 0;
      const storeGateKey = line.userData.storeGateKey ?? '';
      clearOutline();
      document.getElementById('tip-cell').textContent   = 'Cluster';
      document.getElementById('tip-coords').textContent = storeGateKey;
      document.getElementById('tip-e').textContent      = `${etGev.toFixed(3)} GeV`;
      if (tipEKeyEl) tipEKeyEl.innerHTML = 'E<sub>T</sub>';
      tooltip.style.left = Math.min(clientX+18, rect.right-210)+'px';
      tooltip.style.top  = Math.min(clientY+18, rect.bottom-90)+'px';
      tooltip.hidden = false; dirty = true; return;
    }
  }
  clearOutline(); tooltip.hidden = true;
}
document.addEventListener('mousemove', e => {
  const now = Date.now(); if (now-lastRay < 50) return; lastRay = now;
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
document.getElementById('cluster-filter-toggle').addEventListener('click', () => {
  clusterFilterEnabled = !clusterFilterEnabled;
  syncClusterFilterToggle();
  applyClusterThreshold();
});

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

// ── Particle tracks (collision tracer) toggle ───────────────────────────────
let tracksVisible = true;
function syncTracksBtn() {
  document.getElementById('btn-tracks').classList.toggle('on', tracksVisible);
}
function toggleTracks() {
  tracksVisible = !tracksVisible;
  if (trackGroup) trackGroup.visible = tracksVisible;
  syncTracksBtn();
  dirty = true;
}
document.getElementById('btn-tracks').addEventListener('click', toggleTracks);

// ── Cluster η/φ lines toggle ────────────────────────────────────────────────
let clustersVisible = true;
function syncClustersBtn() {
  document.getElementById('btn-cluster').classList.toggle('on', clustersVisible);
}
function toggleClusters() {
  clustersVisible = !clustersVisible;
  if (clusterGroup) clusterGroup.visible = clustersVisible;
  syncClustersBtn();
  dirty = true;
}
document.getElementById('btn-cluster').addEventListener('click', toggleClusters);
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
  let marked = false;
  list.slice(0, 10).forEach((entry, idx) => {
    const row = document.createElement('div');
    const isCur = !marked && entry.id === curEvtId;
    if (isCur) marked = true;
    row.className = 'erow' + (isCur ? ' cur' : '');
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


// ── Log collapse ──────────────────────────────────────────────────────────────
document.getElementById('btn-log-min')?.addEventListener('click', () => {
  const sec  = document.getElementById('log-sec');
  const icon = document.getElementById('log-min-icon');
  if (!sec) return;
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
  if (icon) icon.className = willCollapse ? 'ti ti-chevron-up' : 'ti ti-chevron-down';
  const btn = document.getElementById('btn-log-min');
  if (btn) btn.dataset.tip = willCollapse ? 'Expand session log' : 'Minimize session log';
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
      startProgress('local'); advanceProgress('acquire');
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
  if (f) {
    addLog(t('log-loading') + f.name); setStatus('Parsing…');
    startProgress('local'); advanceProgress('acquire');
    try { processXml(await f.text()); advanceProgress('load'); endProgress(); }
    catch (err) { endProgress(); setStatus(`<span class="err">${esc(err.message)}</span>`); }
  }
  e.target.value = '';
});

// ── Drag & drop XML onto Local tab ────────────────────────────────────────────
(function initLocalDnD() {
  const sec = document.getElementById('local-sec');
  if (!sec) return;
  ['dragenter','dragover'].forEach(ev => sec.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation();
    sec.classList.add('dragover');
    e.dataTransfer.dropEffect = 'copy';
  }));
  ['dragleave','dragend'].forEach(ev => sec.addEventListener(ev, e => {
    if (e.target === sec) sec.classList.remove('dragover');
  }));
  sec.addEventListener('drop', async e => {
    e.preventDefault(); e.stopPropagation();
    sec.classList.remove('dragover');
    const items = e.dataTransfer?.files ? [...e.dataTransfer.files] : [];
    const xmls = items.filter(f => f.name.toLowerCase().endsWith('.xml'));
    if (!xmls.length) { addLog('No .xml files in drop','warn'); return; }
    if (xmls.length === 1) {
      const f = xmls[0];
      addLog(t('log-loading') + f.name); setStatus('Reading file…');
      startProgress('local'); advanceProgress('acquire');
      try { processXml(await f.text()); advanceProgress('load'); endProgress(); }
      catch (err) { endProgress(); setStatus(`<span class="err">${esc(err.message)}</span>`); }
    } else {
      localFiles = xmls.sort((a,b) => a.name.localeCompare(b.name));
      renderLocalList();
      addLog(`Dropped ${localFiles.length} XML files`, 'ok');
    }
    // Switch to local tab
    document.getElementById('btn-local')?.click();
  });
})();

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
  if (!logSec || !logResize) return;
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
function startProgress(kind = 'live') {
  const pEl = document.getElementById('dl-progress');
  if (!pEl) return;
  pEl.classList.toggle('local', kind === 'local');
  pEl.classList.toggle('live',  kind !== 'local');
  pEl.hidden = false;
  DL_STAGES.forEach(s => {
    const el = document.getElementById('dlst-' + s);
    if (el) el.classList.remove('active','done');
  });
  const bar = document.getElementById('dl-bar-fill');
  if (bar) bar.style.width = '0%';
  advanceProgress('request');
}
function advanceProgress(stage) {
  if (_dlTimer) clearTimeout(_dlTimer);
  const pEl = document.getElementById('dl-progress');
  if (!pEl) return;
  const idx = DL_STAGES.indexOf(stage);
  DL_STAGES.forEach((s, i) => {
    const el = document.getElementById('dlst-' + s);
    if (!el) return;
    el.classList.toggle('done',   i < idx);
    el.classList.toggle('active', i === idx);
  });
  const bar = document.getElementById('dl-bar-fill');
  if (bar) bar.style.width = (DL_PCTS[stage] || 0) + '%';
}
function endProgress() {
  const bar = document.getElementById('dl-bar-fill');
  if (!bar) return;
  bar.style.width = '100%';
  DL_STAGES.forEach(s => {
    const el = document.getElementById('dlst-' + s);
    if (el) { el.classList.remove('active'); el.classList.add('done'); }
  });
  _dlTimer = setTimeout(() => {
    const p = document.getElementById('dl-progress');
    if (p) p.hidden = true;
    bar.style.width = '0%';
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
// The toggle pill acts as both opener and closer:
//  • toolbar hidden → pill sits at the bottom, click slides toolbar up.
//  • toolbar open  → pill slides above the toolbar (.tb-open), click hides it.
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
    // The toggle pill slides above the toolbar when open (only on mobile).
    btn.classList.toggle('tb-open', tbVisible && isLandscapeMobile());
  }
  // Apply initial state without animation
  tb.style.transition = 'none';
  apply();
  setTimeout(() => tb.style.transition = '', 50);

  btn.addEventListener('click', () => {
    if (isLandscapeMobile()) { tbVisible = !tbVisible; apply(); }
    else                     { tbVisible = true;       apply(); }
  });
  // Legacy in-toolbar close button (hidden by CSS on mobile, but keep a handler
  // in case it's exposed elsewhere or on non-mobile widths).
  if (closeBtn) closeBtn.addEventListener('click', e => {
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
    case 'J':
      document.getElementById('btn-tracks').click();
      break;
    case 'K':
      document.getElementById('btn-cluster').click();
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
