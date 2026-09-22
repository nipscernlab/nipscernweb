/**
 * Noodle: quem pode quando.
 * ------------------------------------------------------------------
 * A página /noodle é o marcador de horários do laboratório, no molde do
 * Doodle. Dois tipos de enquete:
 *
 *   em grupo      todo mundo marca sim, se precisar ou não em cada opção, e
 *                 a melhor aparece;
 *   individual    cada horário é de uma pessoa só, como uma agenda de
 *                 atendimento: quem chega primeiro reserva.
 *
 * O que fica onde
 *
 *   O site é estático e não guarda nada. As enquetes vivem no Cloud Firestore
 *   de um projeto Firebase do laboratório, no plano gratuito, e este módulo
 *   fala com ele direto do navegador. Quem manda no que cada pessoa pode ler e
 *   escrever são as regras do Firestore, em docs/noodle.rules; nada aqui é
 *   segurança, é só interface. Um cliente modificado consegue exatamente o que
 *   as regras deixam, e nada além.
 *
 *   Quem organiza entra com a conta do Google. Quem responde não faz login: o
 *   Firebase cria uma sessão anônima, com um uid, e a resposta da pessoa é o
 *   documento com esse uid. É isso que a deixa editar a própria resposta
 *   depois e ninguém mais. Numa reserva, o documento tem o id do horário, e
 *   por isso dois não conseguem reservar o mesmo: o segundo é recusado.
 *
 *   A configuração pública do projeto (apiKey, projectId) fica no bloco
 *   window.NOODLE_FIREBASE em noodle.html. Não é segredo, por desenho do
 *   Firebase: a proteção é a regra, não a chave.
 *
 * Os seletores são nossos
 *
 *   Hora, duração e prazo não usam os seletores nativos do navegador: cada um
 *   é um painel desenhado aqui (.nd-pop), renderizado dentro do próprio
 *   formulário ao lado do campo que o abriu, para sobreviver a um redesenho e
 *   ter a mesma cara em todo navegador. O estado do painel aberto é S.pop, e
 *   uma mudança dentro dele troca só o miolo (patchPop), sem redesenhar a
 *   página: é o que impede o painel de piscar.
 *
 * Fuso horário
 *
 *   O laboratório está em Juiz de Fora e em Genebra, com quatro ou cinco horas
 *   de diferença conforme o horário de verão europeu. Uma faixa de horário é
 *   gravada como instante (ISO em UTC), junto com o fuso de quem criou, e é
 *   exibida no fuso de quem está olhando. Uma opção de dia inteiro é só uma
 *   data, e uma data não se converte.
 *
 *   O SDK do Firebase vem do CDN do Google, por import() dinâmico, só quando a
 *   página está configurada.
 */
import { t, getLang } from './i18n.js?v=401f3a63bd';
import { scrollToTop } from './smooth-scroll.js?v=401f3a63bd';

const FB_VERSION = '12.19.0';
const fbUrl = (m) => `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-${m}.js`;

const DATE_LOCALES = { en: 'en-GB', pt: 'pt-BR', fr: 'fr-FR', no: 'nb-NO' };
const LS_NAME = 'nipscern:noodle:name';
const LS_FORM = 'nipscern:noodle:form';        // o formulário de criar, guardado a cada mudança
const LS_VOTE = 'nipscern:noodle:vote:';       // + id da enquete: a resposta ainda não salva
const LS_TZ = 'nipscern:noodle:tz';            // o fuso que a pessoa escolheu ver

/* Os fusos das duas salas e dos lugares por onde o laboratório passa vêm
   primeiro; o resto da lista do navegador aparece quando se busca. */
const COMMON_TZ = ['America/Sao_Paulo', 'Europe/Zurich', 'Europe/Paris', 'Europe/London', 'Europe/Lisbon', 'Europe/Oslo',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'UTC'];
const GOOGLE_G = 'assets/icons/google-g.svg';

/* Os mesmos limites que as regras impõem. Repetidos aqui para a pessoa ver o
   erro antes de mandar, e não depois como "permission denied". */
const MAX = { title: 120, description: 2000, location: 200, name: 60, comment: 1000, options: 60 };
const DURATIONS = [15, 30, 45, 60, 90, 120];
const CUSTOM_DURATIONS = [10, 20, 25, 40, 50, 75, 180, 240];
const DL_HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const DL_MINUTES = ['00', '15', '30', '45'];

const VIEWER_TZ = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (_) { return 'UTC'; }
})();

const CFG = (typeof window !== 'undefined' && window.NOODLE_FIREBASE) || null;
const CONFIGURED = !!(CFG && CFG.apiKey && CFG.projectId && !/REPLACE/i.test(String(CFG.apiKey) + String(CFG.projectId)));

const root = document.getElementById('noodle-app');

/* A primeira pintura espera as palavras. main.js carrega o i18n e dispara
   langchange quando elas chegam; até lá render() não faz nada, senão a tela
   mostraria as chaves cruas por um instante. Três segundos é a rede: se o
   i18n falhar, a página aparece em inglês em vez de não aparecer. */
let READY = false;

// ============================================================
// Estado
// ============================================================
const today = new Date();
const thisMonth = () => ({ y: today.getFullYear(), m: today.getMonth() });

function freshForm() {
  return {
    kind: 'group',
    title: '', description: '', location: '',
    mode: 'days',
    duration: 60,                 // minutos, ou 'custom'
    customMin: 25,                // a duração de "outra"
    selected: new Set(),          // 'YYYY-MM-DD'
    slots: new Map(),             // 'YYYY-MM-DD' -> [{ start: 'HH:MM' }]
    allowMaybe: true,
    tz: storedTz() || VIEWER_TZ,          // o fuso em que os horários são digitados
    dl: { date: null, time: '18:00' },   // prazo para responder
    cal: thisMonth(),
    dlCal: thisMonth(),
    error: null,
    busy: false,
  };
}

const S = {
  route: { page: 'home', id: null },
  fb: null,
  fbPromise: null,
  authReady: false,
  user: null,
  form: null, // preenchido no arranque: o rascunho guardado, ou um formulário novo
  tz: null,   // o fuso em que a enquete é lida; preenchido no arranque
  editing: null,                  // comentário em edição: { id, text, busy }
  pop: null,                      // painel aberto: { kind: 'time'|'duration'|'deadline', id, day?, i? }
  popAnim: false,                 // true só no redesenho em que o painel acaba de abrir
  poll: null,
  pollMissing: false,
  responses: [],
  bookings: [],
  comments: [],
  unsub: [],
  draft: { name: '', votes: {} },
  draftDirty: false,
  saving: false,
  booking: null,                  // id da opção sendo reservada
  comment: { text: '', busy: false },
  copied: false,
  mine: null,
  mineBusy: false,
};

// ============================================================
// Utilidades
// ============================================================
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* Texto escapado com os endereços http(s) virando links. O link da chamada
   costuma ir na descrição ou no lugar, e um link que não abre é só ruído. */
function linkify(text) {
  const parts = String(text ?? '').split(/(https?:\/\/[^\s<>"']+)/g);
  return parts.map((p, i) => {
    if (i % 2 === 0) return esc(p);
    const trail = p.match(/[.,;:!?)]+$/);
    const url = trail ? p.slice(0, -trail[0].length) : p;
    const shown = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(shown)}</a>${trail ? esc(trail[0]) : ''}`;
  }).join('');
}

/* t() do site, mais {n}, {m}, {tz}, {name}, {when}, {title}, {url}. */
function tt(key, vars) {
  let s = t('noodle.' + key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

const locale = () => DATE_LOCALES[getLang()] || 'en-GB';
const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const todayKey = dateKey(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

/* Data local a partir de 'YYYY-MM-DD' + 'HH:MM', no fuso do navegador. */
const localDateTime = (k, hm) => {
  const [y, m, d] = k.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
};
const hmToMin = (hm) => { const [h, m] = String(hm).split(':').map(Number); return h * 60 + m; };
const minToHm = (n) => { const c = Math.max(0, Math.min(n, 23 * 60 + 59)); return `${pad(Math.floor(c / 60))}:${pad(c % 60)}`; };
const validHm = (hm) => /^\d{2}:\d{2}$/.test(String(hm));
const clampMin = (n) => Math.max(5, Math.min(720, Math.round(Number(n) / 5) * 5 || 5));

/* "25 min", "1 h", "1 h 30". */
function fmtDur(m) {
  if (m < 60) return `${m} ${tt('min')}`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${pad(r)}` : `${h} h`;
}

/* pt-BR e fr escrevem mês e dia da semana em minúscula; no início de um rótulo
   sobe só a primeira letra, e nada mais (um capitalize no CSS subia o "de"). */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/* Com tz, no fuso pedido; sem, no do navegador (datas de dia inteiro e do
   prazo, que não se convertem). */
const inTz = (o, tz) => (tz ? { ...o, timeZone: tz } : o);
const fmtDay = (d, tz) => cap(d.toLocaleDateString(locale(), inTz({ weekday: 'short', day: 'numeric', month: 'short' }, tz)));
const fmtDayLong = (d, tz) => cap(d.toLocaleDateString(locale(), inTz({ weekday: 'long', day: 'numeric', month: 'long' }, tz)));
const fmtWeekday = (d, tz) => cap(d.toLocaleDateString(locale(), inTz({ weekday: 'short' }, tz)).replace(/\.$/, ''));
const fmtDayMonth = (d, tz) => d.toLocaleDateString(locale(), inTz({ day: 'numeric', month: 'short' }, tz)).replace(/\.$/, '');
const fmtTime = (d, tz) => d.toLocaleTimeString(locale(), inTz({ hour: '2-digit', minute: '2-digit' }, tz));
const fmtDateTime = (d) => cap(d.toLocaleString(locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
const fmtMonth = (y, m) => cap(new Date(y, m, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' }));

function validTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length <= 64; } catch (_) { return false; }
}
function storedTz() { try { const v = localStorage.getItem(LS_TZ); return v && validTz(v) ? v : null; } catch (_) { return null; } }
function storeTz(tz) { try { localStorage.setItem(LS_TZ, tz); } catch (_) {} }
let TZ_ALL = null;
function allTimeZones() {
  if (TZ_ALL) return TZ_ALL;
  try { TZ_ALL = Intl.supportedValuesOf('timeZone'); } catch (_) { TZ_ALL = COMMON_TZ.slice(); }
  return TZ_ALL;
}

/* Quanto um fuso adianta ou atrasa do UTC num dado instante, em ms. */
function tzOffsetMs(utcMs, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000;
}
/* 'YYYY-MM-DD' + 'HH:MM' lidos no fuso dado, como instante. Duas voltas bastam
   para acertar o dia em que o horário de verão muda. */
function zonedToUtc(k, hm, tz) {
  const [y, m, d] = k.split('-').map(Number);
  const [hh, mm] = hm.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 3; i++) { const next = wall - tzOffsetMs(guess, tz); if (next === guess) break; guess = next; }
  return new Date(guess);
}
const dateKeyIn = (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/* "America/Sao_Paulo" vira "America/Sao Paulo (GMT-3)": o nome sozinho não diz
   a quem está em Genebra quantas horas separam as duas salas. */
function tzLabel(tz) {
  const name = String(tz || '').replace(/_/g, ' ');
  try {
    const part = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
    return part ? `${name} (${part.value})` : name;
  } catch (_) { return name; }
}

const tsToDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'string' || typeof v === 'number') return new Date(v);
  return null;
};

/* Uma opção como ela se mostra a quem está olhando: dia no fuso local, hora no
   fuso local, e uma chave de ordenação. Dia inteiro não converte. */
function optionView(o) {
  if (!o.start) {
    const d = fromKey(o.date);
    return { id: o.id, allDay: true, date: o.date, dayKey: o.date, weekday: fmtWeekday(d), dayMonth: fmtDayMonth(d), dayLabel: fmtDay(d), dayLong: fmtDayLong(d), time: null, sort: o.date + 'T00:00' };
  }
  const s = new Date(o.start);
  const e = o.end ? new Date(o.end) : null;
  const tz = S.tz;
  return {
    id: o.id, allDay: false, start: s, end: e,
    dayKey: dateKeyIn(s, tz), weekday: fmtWeekday(s, tz), dayMonth: fmtDayMonth(s, tz), dayLabel: fmtDay(s, tz), dayLong: fmtDayLong(s, tz),
    time: fmtTime(s, tz) + (e ? '–' + fmtTime(e, tz) : ''),
    startLabel: fmtTime(s, tz),
    sort: o.start,
  };
}

function optionViews(poll) {
  return (poll.options || []).map(optionView).sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
}

/* Colunas agrupadas por dia, para o cabeçalho de duas linhas. */
function groupByDay(views) {
  const groups = [];
  for (const v of views) {
    const g = groups[groups.length - 1];
    if (g && g.dayKey === v.dayKey) g.items.push(v);
    else groups.push({ dayKey: v.dayKey, weekday: v.weekday, dayMonth: v.dayMonth, dayLabel: v.dayLabel, dayLong: v.dayLong, items: [v] });
  }
  return groups;
}

function optionLabel(v) {
  return v.time ? `${v.dayLong}, ${v.time}` : `${v.dayLong}, ${tt('all_day').toLowerCase()}`;
}

function voteOf(resp, id) {
  const v = resp && resp.votes ? resp.votes[id] : null;
  return v === 'yes' || v === 'maybe' ? v : 'no';
}

function counts(poll, responses) {
  const out = {};
  for (const o of poll.options || []) {
    let yes = 0, maybe = 0;
    for (const r of responses) { const v = voteOf(r, o.id); if (v === 'yes') yes++; else if (v === 'maybe') maybe++; }
    out[o.id] = { yes, maybe };
  }
  return out;
}

/* A coluna que vence. Se há um horário em que TODO MUNDO disse sim, é o
   primeiro deles no calendário, e leva a coroa; se não há, é o de mais "sim"
   (e depois mais "se precisar"), com uma estrela, e pode haver empate. As
   opções vêm ordenadas por optionViews, então o primeiro que casa é o mais
   cedo. */
function bestIds(views, c, n) {
  if (n > 0) {
    const all = views.find((v) => c[v.id] && c[v.id].yes === n);
    if (all) return { ids: new Set([all.id]), everyone: true };
  }
  let best = null, ids = [];
  for (const v of views) {
    const s = c[v.id]; if (!s || (s.yes === 0 && s.maybe === 0)) continue;
    const key = s.yes * 1000 + s.maybe;
    if (best === null || key > best) { best = key; ids = [v.id]; }
    else if (key === best) ids.push(v.id);
  }
  return { ids: new Set(ids), everyone: false };
}

function pollOpen(poll) {
  if (!poll || poll.status !== 'open') return false;
  const dl = tsToDate(poll.deadline);
  return !dl || dl.getTime() > Date.now();
}

const isBooking = (poll) => !!poll && poll.kind === 'booking';

function displayName(user) {
  if (!user) return '';
  if (user.displayName) return user.displayName;
  const g = (user.providerData || []).find((p) => p.providerId === 'google.com');
  if (g && g.displayName) return g.displayName;
  const email = user.email || (g && g.email) || '';
  return email.split('@')[0] || '';
}

const initials = (name) => String(name || '').trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';

/* A foto da conta do Google, quando a pessoa entrou com ela; quem respondeu
   anônimo fica com as iniciais. A foto vai gravada junto com a resposta, e as
   regras só aceitam endereços do googleusercontent. */
const myPhoto = () => (S.user && !S.user.isAnonymous && S.user.photoURL ? String(S.user.photoURL).slice(0, 400) : null);

function avatar(name, photo, size) {
  const cls = 'nd-avatar' + (size === 'sm' ? ' nd-avatar--sm' : '');
  const ini = `<span class="${cls}" ${photo ? 'hidden' : ''}>${esc(initials(name))}</span>`;
  if (!photo) return ini;
  /* referrerpolicy: as fotos do Google recusam pedidos com referer de fora. */
  return `<img class="${cls} nd-avatar--img" src="${esc(photo)}" alt="" referrerpolicy="no-referrer" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">${ini}`;
}

const isOwner = () => !!(S.user && S.poll && S.user.uid === S.poll.ownerUid);
const isGoogleUser = () => !!(S.user && !S.user.isAnonymous);

function storedName() { try { return localStorage.getItem(LS_NAME) || ''; } catch (_) { return ''; } }
function storeName(n) { try { localStorage.setItem(LS_NAME, n); } catch (_) {} }

/* O formulário de criar fica guardado no navegador a cada mudança, e volta
   inteiro depois de um reload ou de fechar a aba. Some quando a enquete é
   criada ou quando a pessoa limpa tudo. Dias que já passaram não voltam. */
function saveForm() {
  const f = S.form;
  if (!formHasContent()) { clearForm(); return; }
  try {
    localStorage.setItem(LS_FORM, JSON.stringify({
      v: 1, kind: f.kind, title: f.title, description: f.description, location: f.location,
      mode: f.mode, duration: f.duration, customMin: f.customMin,
      selected: [...f.selected], slots: [...f.slots], allowMaybe: f.allowMaybe, tz: f.tz, dl: f.dl, cal: f.cal, at: Date.now(),
    }));
  } catch (_) {}
}
function loadForm() {
  try {
    const o = JSON.parse(localStorage.getItem(LS_FORM) || 'null');
    if (!o || o.v !== 1) return null;
    const f = freshForm();
    const isKey = (k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k)) && k >= todayKey;
    f.kind = o.kind === 'booking' ? 'booking' : 'group';
    f.title = String(o.title || '').slice(0, MAX.title);
    f.description = String(o.description || '').slice(0, MAX.description);
    f.location = String(o.location || '').slice(0, MAX.location);
    f.mode = o.mode === 'slots' ? 'slots' : 'days';
    f.duration = o.duration === 'custom' ? 'custom' : (DURATIONS.includes(Number(o.duration)) ? Number(o.duration) : 60);
    f.customMin = clampMin(o.customMin || 25);
    f.selected = new Set((Array.isArray(o.selected) ? o.selected : []).filter(isKey));
    f.slots = new Map((Array.isArray(o.slots) ? o.slots : []).filter(([k]) => isKey(k))
      .map(([k, list]) => [k, (Array.isArray(list) ? list : []).filter((s) => s && validHm(s.start)).map((s) => ({ start: s.start }))]));
    f.allowMaybe = o.allowMaybe !== false;
    if (validTz(o.tz)) f.tz = o.tz;
    f.dl = o.dl && isKey(o.dl.date) ? { date: o.dl.date, time: validHm(o.dl.time) ? o.dl.time : '18:00' } : { date: null, time: '18:00' };
    if (o.cal && Number.isInteger(o.cal.y) && Number.isInteger(o.cal.m)) f.cal = { y: o.cal.y, m: o.cal.m };
    return f;
  } catch (_) { return null; }
}
function clearForm() { try { localStorage.removeItem(LS_FORM); } catch (_) {} }
const formHasContent = () => { const f = S.form; return !!(f.title || f.description || f.location || f.selected.size || f.dl.date); };

/* A resposta que a pessoa está montando numa enquete também fica guardada,
   até ela salvar. */
function saveVoteDraft() {
  if (!S.poll) return;
  try { localStorage.setItem(LS_VOTE + S.poll.id, JSON.stringify({ name: S.draft.name, votes: S.draft.votes })); } catch (_) {}
}
function loadVoteDraft(id) {
  try {
    const o = JSON.parse(localStorage.getItem(LS_VOTE + id) || 'null');
    if (!o || typeof o !== 'object') return null;
    return { name: String(o.name || '').slice(0, MAX.name), votes: o.votes && typeof o.votes === 'object' ? o.votes : {} };
  } catch (_) { return null; }
}
function clearVoteDraft(id) { try { localStorage.removeItem(LS_VOTE + id); } catch (_) {} }

function pollUrl(id) {
  const u = new URL(location.href);
  u.search = '?p=' + encodeURIComponent(id);
  u.hash = '';
  return u.href;
}

// ---- agenda: Google Agenda por URL, e um .ics para o resto -------------
const icsStamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsDate = (k) => k.replace(/-/g, '');
const nextDayKey = (k) => dateKey(addDays(fromKey(k), 1));
const icsText = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const endOf = (v) => v.end || new Date(v.start.getTime() + 3600000);

function gcalUrl(poll, v) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: poll.title });
  p.set('dates', v.allDay ? `${icsDate(v.date)}/${icsDate(nextDayKey(v.date))}` : `${icsStamp(v.start)}/${icsStamp(endOf(v))}`);
  if (poll.description) p.set('details', poll.description);
  if (poll.location) p.set('location', poll.location);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

function icsHref(poll, v) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NIPS-CERN//Noodle//EN', 'BEGIN:VEVENT',
    `UID:${poll.id}-${v.id}@nipscern.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    v.allDay ? `DTSTART;VALUE=DATE:${icsDate(v.date)}` : `DTSTART:${icsStamp(v.start)}`,
    v.allDay ? `DTEND;VALUE=DATE:${icsDate(nextDayKey(v.date))}` : `DTEND:${icsStamp(endOf(v))}`,
    `SUMMARY:${icsText(poll.title)}`,
  ];
  if (poll.description) lines.push(`DESCRIPTION:${icsText(poll.description)}`);
  if (poll.location) lines.push(`LOCATION:${icsText(poll.location)}`);
  lines.push(`URL:${pollUrl(poll.id)}`, 'END:VEVENT', 'END:VCALENDAR');
  return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(lines.join('\r\n'));
}

function calendarLinks(poll, v) {
  const file = (poll.title || 'noodle').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 40) || 'noodle';
  return `<span class="nd-cal-links">
      <a class="nd-chip" href="${esc(gcalUrl(poll, v))}" target="_blank" rel="noopener noreferrer">${icon('ph-calendar-plus')} ${esc(tt('add_gcal'))}</a>
      <a class="nd-chip" href="${icsHref(poll, v)}" download="${esc(file)}.ics">${icon('ph-download-simple')} ${esc(tt('add_ics'))}</a>
    </span>`;
}

// ============================================================
// Avisos
// ============================================================
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('nd-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'nd-toast';
    el.className = 'nd-toast glass';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 4800);
}

/* Uma pergunta na própria página, no lugar do confirm() do navegador, que
   trava a aba inteira até se responder e, no celular, a tela toda. Devolve uma
   promessa com true ou false; Cancelar, Esc e o fundo escuro são "não". Vive
   fora do #noodle-app, como o recado, para um redesenho não a derrubar. */
function ask({ text, ok, danger = false }) {
  return new Promise((resolve) => {
    document.getElementById('nd-dialog-wrap')?.remove();
    const was = document.activeElement;
    const wrap = document.createElement('div');
    wrap.id = 'nd-dialog-wrap';
    wrap.className = 'nd-dim';
    wrap.innerHTML = `<div class="nd-dialog glass" role="alertdialog" aria-modal="true" aria-describedby="nd-dialog-text">
      <p id="nd-dialog-text" class="nd-dialog-text">${esc(text)}</p>
      <div class="nd-dialog-actions">
        <button type="button" class="btn glass-btn nd-btn nd-btn--outline btn-sm" data-dialog="no">${esc(tt('cancel'))}</button>
        <button type="button" class="btn glass-btn nd-btn ${danger ? 'nd-btn--danger' : 'nd-btn--primary'} btn-sm" data-dialog="yes">${esc(ok)}</button>
      </div>
    </div>`;
    const close = (answer) => {
      document.removeEventListener('keydown', onDialogKey, true);
      wrap.classList.remove('is-on');
      wrap.addEventListener('transitionend', () => wrap.remove(), { once: true });
      setTimeout(() => wrap.remove(), 300);
      if (was && was.isConnected && typeof was.focus === 'function') was.focus({ preventScroll: true });
      resolve(answer);
    };
    /* O foco fica preso nos dois botões enquanto a pergunta está aberta. */
    const onDialogKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
      if (e.key !== 'Tab') return;
      const btns = [...wrap.querySelectorAll('button')];
      const i = btns.indexOf(document.activeElement);
      e.preventDefault();
      btns[(i + (e.shiftKey ? -1 : 1) + btns.length) % btns.length].focus();
    };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dialog]');
      if (b) close(b.getAttribute('data-dialog') === 'yes');
      else if (e.target === wrap) close(false);
    });
    document.addEventListener('keydown', onDialogKey, true);
    document.body.appendChild(wrap);
    /* Apagar começa com o foco em Cancelar; limpar, no botão que faz. */
    requestAnimationFrame(() => { wrap.classList.add('is-on'); wrap.querySelector(danger ? '[data-dialog="no"]' : '[data-dialog="yes"]').focus(); });
  });
}

function errMsg(e, ctx) {
  const code = (e && e.code) || '';
  console.error('[noodle]', e);
  if (code === 'permission-denied') {
    if (S.poll && !pollOpen(S.poll)) return tt('err_closed');
    if (ctx === 'book') return tt('booking_taken');
    if (ctx === 'write') return tt('err_denied');
    return tt('err_permission');
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/popup-blocked') return tt('err_popup');
  if (code === 'not-found') return tt('err_notfound');
  /* O código vai junto. Um "algo deu errado" sem ele custou uma rodada de
     depuração às cegas no primeiro login; com ele, quem lê o aviso sabe se foi
     domínio não autorizado, popup bloqueado ou regra recusando. */
  return code ? tt('err_generic') + ' (' + code + ')' : tt('err_generic');
}

// ============================================================
// Firebase
// ============================================================
async function fb() {
  if (S.fb) return S.fb;
  if (!S.fbPromise) {
    S.fbPromise = (async () => {
      const [A, Au, Fs] = await Promise.all([import(fbUrl('app')), import(fbUrl('auth')), import(fbUrl('firestore'))]);
      const app = A.initializeApp(CFG);
      const auth = Au.getAuth(app);
      const db = Fs.getFirestore(app);
      S.fb = { auth, db, Au, Fs };
      Au.onAuthStateChanged(auth, (u) => {
        S.user = u;
        S.authReady = true;
        onAuthChanged();
      });
      return S.fb;
    })();
  }
  return S.fbPromise;
}

function onAuthChanged() {
  if (S.route.page === 'home') {
    if (isGoogleUser()) loadMine(); else S.mine = null;
  }
  S.draftDirty = false;
  syncDraft();
  render();
}

/* Login do Google. Se a pessoa já tem uma sessão anônima (respondeu a alguma
   enquete), a conta é VINCULADA em vez de trocada, para as respostas que ela
   já deu continuarem sendo dela. Quando o Google já é conhecido por outro uid,
   o vínculo falha e entra-se com a credencial que o erro devolve. */
async function signInGoogle() {
  const { auth, Au } = await fb();
  const provider = new Au.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cur = auth.currentUser;
  if (cur && cur.isAnonymous) {
    try {
      await Au.linkWithPopup(cur, provider);
      await cur.reload();
      S.user = auth.currentUser;
      S.mine = null;
      onAuthChanged();
      return;
    } catch (e) {
      if (e.code !== 'auth/credential-already-in-use') throw e;
      const cred = Au.GoogleAuthProvider.credentialFromError(e);
      if (!cred) throw e;
      await Au.signInWithCredential(auth, cred);
      return;
    }
  }
  await Au.signInWithPopup(auth, provider);
}

async function signOutUser() {
  const { auth, Au } = await fb();
  await Au.signOut(auth);
  S.mine = null;
}

/* Quem responde precisa de um uid, e só disso. */
async function ensureUser() {
  const { auth, Au } = await fb();
  if (auth.currentUser) return auth.currentUser;
  const cred = await Au.signInAnonymously(auth);
  return cred.user;
}

// ============================================================
// Enquete: leitura ao vivo
// ============================================================
function unwatch() {
  for (const u of S.unsub) { try { u(); } catch (_) {} }
  S.unsub = [];
}

const byCreated = (a, b) => (tsToDate(a.createdAt)?.getTime() || Infinity) - (tsToDate(b.createdAt)?.getTime() || Infinity);

async function watchPoll(id) {
  unwatch();
  S.poll = null; S.pollMissing = false; S.responses = []; S.bookings = []; S.comments = [];
  const { db, Fs } = await fb();
  if (S.route.id !== id) return;

  S.unsub.push(Fs.onSnapshot(Fs.doc(db, 'polls', id), (snap) => {
    if (!snap.exists()) { S.poll = null; S.pollMissing = true; }
    else { S.poll = { id: snap.id, ...snap.data() }; S.pollMissing = false; }
    syncDraft();
    render();
  }, (e) => { S.pollMissing = true; render(); toast(errMsg(e)); }));

  S.unsub.push(Fs.onSnapshot(Fs.collection(db, 'polls', id, 'responses'), (qs) => {
    S.responses = qs.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byCreated);
    syncDraft();
    render();
  }, (e) => toast(errMsg(e))));

  S.unsub.push(Fs.onSnapshot(Fs.collection(db, 'polls', id, 'bookings'), (qs) => {
    S.bookings = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (e) => toast(errMsg(e))));

  S.unsub.push(Fs.onSnapshot(Fs.query(Fs.collection(db, 'polls', id, 'comments'), Fs.orderBy('createdAt', 'asc')), (qs) => {
    S.comments = qs.docs.map((d) => ({ id: d.id, ...d.data() }));
    render();
  }, (e) => toast(errMsg(e))));
}

/* A linha "você": o que já está gravado, se houver, ou o nome lembrado. Só
   enquanto a pessoa não mexeu; um rascunho não é sobrescrito por um snapshot.
   Quem organizou nasce marcando que pode em tudo. */
function syncDraft() {
  if (S.draftDirty) return;
  const mine = S.user ? S.responses.find((r) => r.id === S.user.uid) : null;
  if (mine) { S.draft = { name: mine.name || '', votes: { ...(mine.votes || {}) } }; return; }
  if (S.poll) { const d = loadVoteDraft(S.poll.id); if (d && (d.name || Object.keys(d.votes).length)) { S.draft = d; S.draftDirty = true; return; } }
  if (!S.draft.name) S.draft.name = storedName() || (isGoogleUser() ? displayName(S.user) : '');
  if (isOwner() && S.poll && !Object.keys(S.draft.votes).length) S.draft.votes = Object.fromEntries((S.poll.options || []).map((o) => [o.id, 'yes']));
}

// ============================================================
// Enquete: escritas
// ============================================================
function cleanVotes(votes, poll) {
  const out = {};
  for (const o of poll.options || []) {
    const v = votes[o.id];
    if (v === 'yes' || v === 'maybe' || v === 'no') out[o.id] = v;
  }
  return out;
}

function requireName() {
  const name = S.draft.name.trim().slice(0, MAX.name);
  if (!name) {
    const el = document.getElementById('nd-my-name');
    if (el) { el.focus(); el.classList.add('is-missing'); setTimeout(() => el.classList.remove('is-missing'), 1200); }
    toast(tt('name_first'));
    return null;
  }
  return name;
}

async function saveVote() {
  if (!S.poll || S.saving) return;
  const name = requireName(); if (!name) return;
  if (!pollOpen(S.poll)) { toast(tt('err_closed')); return; }
  S.saving = true; render();
  try {
    const { db, Fs } = await fb();
    const user = await ensureUser();
    const ref = Fs.doc(db, 'polls', S.poll.id, 'responses', user.uid);
    const votes = cleanVotes(S.draft.votes, S.poll);
    const exists = S.responses.some((r) => r.id === user.uid);
    const photo = myPhoto();
    if (exists) await Fs.updateDoc(ref, { name, votes, photo, updatedAt: Fs.serverTimestamp() });
    else await Fs.setDoc(ref, { name, votes, photo, uid: user.uid, createdAt: Fs.serverTimestamp(), updatedAt: Fs.serverTimestamp() });
    storeName(name);
    clearVoteDraft(S.poll.id);
    S.draftDirty = false;
    toast(tt('saved'));
  } catch (e) {
    toast(errMsg(e, 'write'));
  } finally {
    S.saving = false; render();
  }
}

async function deleteResponse(uid, confirmKey) {
  if (!S.poll) return;
  if (!(await ask({ text: tt(confirmKey), ok: tt('delete'), danger: true }))) return;
  if (!S.poll) return;
  try {
    const { db, Fs } = await fb();
    await Fs.deleteDoc(Fs.doc(db, 'polls', S.poll.id, 'responses', uid));
    if (S.user && uid === S.user.uid) { clearVoteDraft(S.poll.id); S.draft = { name: S.draft.name, votes: {} }; S.draftDirty = false; }
  } catch (e) { toast(errMsg(e)); }
}

/* Reserva: o documento tem o id do horário, então o segundo a chegar escreve
   por cima de um documento que já existe, e isso a regra não deixa. */
async function book(optionId) {
  if (!S.poll || S.booking) return;
  const name = requireName(); if (!name) return;
  if (!pollOpen(S.poll)) { toast(tt('err_closed')); return; }
  if (S.user && S.bookings.some((b) => b.uid === S.user.uid)) { toast(tt('one_booking')); return; }
  S.booking = optionId; render();
  try {
    const { db, Fs } = await fb();
    const user = await ensureUser();
    if (S.bookings.some((b) => b.uid === user.uid)) { toast(tt('one_booking')); return; }
    await Fs.setDoc(Fs.doc(db, 'polls', S.poll.id, 'bookings', optionId), { name, photo: myPhoto(), uid: user.uid, createdAt: Fs.serverTimestamp() });
    storeName(name);
    toast(tt('booked'));
  } catch (e) { toast(errMsg(e, 'book')); }
  finally { S.booking = null; render(); }
}

async function cancelBooking(optionId, confirmKey, okKey) {
  if (!S.poll) return;
  if (!(await ask({ text: tt(confirmKey), ok: tt(okKey), danger: true }))) return;
  if (!S.poll) return;
  try {
    const { db, Fs } = await fb();
    await Fs.deleteDoc(Fs.doc(db, 'polls', S.poll.id, 'bookings', optionId));
  } catch (e) { toast(errMsg(e)); }
}

async function addComment() {
  if (!S.poll || S.comment.busy) return;
  const text = S.comment.text.trim().slice(0, MAX.comment);
  if (!text) return;
  const name = requireName(); if (!name) return;
  S.comment.busy = true; render();
  try {
    const { db, Fs } = await fb();
    const user = await ensureUser();
    await Fs.addDoc(Fs.collection(db, 'polls', S.poll.id, 'comments'), { name, photo: myPhoto(), text, uid: user.uid, createdAt: Fs.serverTimestamp() });
    storeName(name);
    S.comment.text = '';
  } catch (e) { toast(errMsg(e, 'write')); }
  finally { S.comment.busy = false; render(); }
}

/* Só quem escreveu edita, e o comentário passa a dizer que foi editado. */
async function saveCommentEdit() {
  if (!S.poll || !S.editing || S.editing.busy) return;
  const text = S.editing.text.trim().slice(0, MAX.comment);
  if (!text) return;
  S.editing.busy = true; render();
  try {
    const { db, Fs } = await fb();
    await Fs.updateDoc(Fs.doc(db, 'polls', S.poll.id, 'comments', S.editing.id), { text, editedAt: Fs.serverTimestamp() });
    S.editing = null;
  } catch (e) { toast(errMsg(e, 'write')); if (S.editing) S.editing.busy = false; }
  render();
}

async function deleteComment(id) {
  if (!S.poll) return;
  if (!(await ask({ text: tt('confirm_delete_comment'), ok: tt('delete'), danger: true }))) return;
  if (!S.poll) return;
  try {
    const { db, Fs } = await fb();
    await Fs.deleteDoc(Fs.doc(db, 'polls', S.poll.id, 'comments', id));
  } catch (e) { toast(errMsg(e)); }
}

async function setStatus(status) {
  if (!S.poll) return;
  try {
    const { db, Fs } = await fb();
    await Fs.updateDoc(Fs.doc(db, 'polls', S.poll.id), { status, updatedAt: Fs.serverTimestamp() });
    S.mine = null;
  } catch (e) { toast(errMsg(e)); }
}

async function setFinal(optionId) {
  if (!S.poll) return;
  try {
    const { db, Fs } = await fb();
    await Fs.updateDoc(Fs.doc(db, 'polls', S.poll.id), { finalOptionId: optionId, updatedAt: Fs.serverTimestamp() });
    S.mine = null;
  } catch (e) { toast(errMsg(e)); }
}

/* O Firestore não apaga subcoleções junto com o documento. Respostas, reservas
   e comentários saem no mesmo lote, e a enquete por último: as regras conferem
   quem é o dono lendo a enquete como ela está ANTES do lote. */
async function deletePoll() {
  if (!S.poll) return;
  if (!(await ask({ text: tt('confirm_delete_poll'), ok: tt('delete_poll'), danger: true }))) return;
  if (!S.poll) return;
  const id = S.poll.id;
  try {
    const { db, Fs } = await fb();
    const subs = await Promise.all(['responses', 'bookings', 'comments'].map((c) => Fs.getDocs(Fs.collection(db, 'polls', id, c))));
    const batch = Fs.writeBatch(db);
    for (const qs of subs) qs.forEach((d) => batch.delete(d.ref));
    batch.delete(Fs.doc(db, 'polls', id));
    unwatch();
    await batch.commit();
    S.mine = null;
    navigate('');
  } catch (e) { toast(errMsg(e)); watchPoll(id); }
}

// ============================================================
// Minhas enquetes
// ============================================================
async function loadMine() {
  if (!CONFIGURED || !isGoogleUser() || S.mineBusy) return;
  S.mineBusy = true;
  try {
    const { db, Fs } = await fb();
    const uid = S.user.uid;
    const qs = await Fs.getDocs(Fs.query(Fs.collection(db, 'polls'), Fs.where('ownerUid', '==', uid)));
    const list = qs.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (tsToDate(b.createdAt)?.getTime() || 0) - (tsToDate(a.createdAt)?.getTime() || 0))
      .slice(0, 50);
    /* Uma consulta de contagem custa uma leitura por mil documentos, e uma
       enquete do laboratório tem vinte respostas. */
    await Promise.all(list.map(async (p) => {
      try { p.answers = (await Fs.getCountFromServer(Fs.collection(db, 'polls', p.id, isBooking(p) ? 'bookings' : 'responses'))).data().count; }
      catch (_) { p.answers = null; }
    }));
    if (S.user && S.user.uid === uid) S.mine = list;
  } catch (e) {
    console.warn('[noodle] could not list polls:', e);
    S.mine = [];
  } finally {
    S.mineBusy = false;
    render();
  }
}

// ============================================================
// Criar: faixas, duração, prazo
// ============================================================
const durationOf = () => (S.form.duration === 'custom' ? S.form.customMin : Number(S.form.duration));
const slotEnd = (sl) => (validHm(sl.start) ? minToHm(hmToMin(sl.start) + durationOf()) : '');

function nextSlot(list) {
  const last = list[list.length - 1];
  if (!last || !validHm(last.start)) return { start: '14:00' };
  return { start: minToHm(Math.min(hmToMin(slotEnd(last)), 23 * 60)) };
}

function slotsFor(k) {
  if (!S.form.slots.has(k)) S.form.slots.set(k, [nextSlot([])]);
  return S.form.slots.get(k);
}

function selectedKeys() { return [...S.form.selected].sort(); }

const deadlineValue = () => (S.form.dl.date ? `${S.form.dl.date}T${S.form.dl.time}` : '');

function buildOptions() {
  const keys = selectedKeys();
  const out = [];
  if (S.form.mode === 'days') {
    for (const k of keys) out.push({ id: '', date: k, start: null, end: null });
  } else {
    for (const k of keys) {
      for (const sl of slotsFor(k)) {
        const end = slotEnd(sl);
        if (!validHm(sl.start) || !validHm(end)) return { error: 'bad_slot' };
        const s = zonedToUtc(k, sl.start, S.form.tz), e = zonedToUtc(k, end, S.form.tz);
        if (!(e > s)) return { error: 'bad_slot' };
        out.push({ id: '', date: k, start: s.toISOString(), end: e.toISOString() });
      }
    }
  }
  out.sort((a, b) => ((a.start || a.date) < (b.start || b.date) ? -1 : 1));
  out.forEach((o, i) => { o.id = 'o' + (i + 1); });
  return { options: out };
}

async function createPoll() {
  const f = S.form;
  f.error = null;
  S.pop = null;
  const title = f.title.trim().slice(0, MAX.title);
  if (!title) { f.error = tt('no_title'); render(); document.getElementById('nd-f-title')?.focus(); return; }
  if (f.selected.size === 0) { f.error = tt('no_days'); render(); return; }
  const built = buildOptions();
  if (built.error) { f.error = tt(built.error); render(); return; }
  if (built.options.length > MAX.options) { f.error = tt('too_many', { n: MAX.options }); render(); return; }
  const dlv = deadlineValue();
  if (dlv && new Date(dlv).getTime() <= Date.now()) { f.error = tt('deadline_past'); render(); return; }
  if (!CONFIGURED) { toast(tt('not_configured_short')); return; }

  f.busy = true; render();
  try {
    const { db, Fs, auth } = await fb();
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      await signInGoogle();
      if (!auth.currentUser || auth.currentUser.isAnonymous) { f.busy = false; render(); return; }
    }
    const user = auth.currentUser;
    const ref = Fs.doc(Fs.collection(db, 'polls'));
    await Fs.setDoc(ref, {
      kind: f.kind === 'booking' ? 'booking' : 'group',
      title,
      description: f.description.trim().slice(0, MAX.description),
      location: f.location.trim().slice(0, MAX.location),
      ownerUid: user.uid,
      ownerName: (displayName(user) || '').slice(0, 80),
      ownerPhoto: myPhoto(),
      options: built.options,
      allowMaybe: f.kind === 'booking' ? false : !!f.allowMaybe,
      deadline: dlv ? Fs.Timestamp.fromDate(new Date(dlv)) : null,
      tz: f.tz,
      status: 'open',
      finalOptionId: null,
      createdAt: Fs.serverTimestamp(),
      updatedAt: Fs.serverTimestamp(),
    });
    /* Quem propôs os horários pode em todos eles, até dizer o contrário: a
       própria resposta já entra marcada com sim em tudo. Falhar aqui não
       impede a enquete de existir. */
    const me = (displayName(user) || '').trim().slice(0, MAX.name);
    if (f.kind !== 'booking' && me) {
      try {
        await Fs.setDoc(Fs.doc(db, 'polls', ref.id, 'responses', user.uid), {
          name: me, photo: myPhoto(), uid: user.uid,
          votes: Object.fromEntries(built.options.map((o) => [o.id, 'yes'])),
          createdAt: Fs.serverTimestamp(), updatedAt: Fs.serverTimestamp(),
        });
      } catch (e) { console.warn('[noodle] own answer not saved:', e); }
    }
    S.form = freshForm();
    clearForm();
    S.mine = null;
    navigate('?p=' + encodeURIComponent(ref.id));
  } catch (e) {
    f.error = errMsg(e);
  } finally {
    f.busy = false; render();
  }
}

// ============================================================
// Roteamento
// ============================================================
function parseRoute() {
  const p = new URLSearchParams(location.search).get('p');
  if (p && /^[A-Za-z0-9_-]{1,64}$/.test(p)) return { page: 'poll', id: p };
  return { page: 'home', id: null };
}

function navigate(search) {
  const u = new URL(location.href);
  u.search = search;
  u.hash = '';
  history.pushState({}, '', u.href);
  route();
  scrollToTop();
}

function route() {
  S.route = parseRoute();
  S.pop = null;
  S.editing = null;
  S.draft = { name: storedName(), votes: {} };
  S.draftDirty = false;
  S.comment = { text: '', busy: false };
  S.copied = false;
  unwatch();
  S.poll = null; S.pollMissing = false; S.responses = []; S.bookings = []; S.comments = [];

  if (S.route.page === 'poll') {
    if (!CONFIGURED) { render(); return; }
    render();
    watchPoll(S.route.id).catch((e) => { S.pollMissing = true; render(); toast(errMsg(e)); });
    return;
  }
  render();
  if (isGoogleUser() && S.mine === null) loadMine();
}

// ============================================================
// Render
// ============================================================
function render() {
  if (!root || !READY) return;
  const active = document.activeElement;
  const keep = active && root.contains(active) && active.id ? { id: active.id, s: active.selectionStart, e: active.selectionEnd } : null;

  root.innerHTML = S.route.page === 'poll' ? renderPoll() : renderHome();

  root.querySelectorAll('textarea.nd-textarea').forEach(autosize);
  if (S.popAnim) { root.querySelector('.nd-pop')?.classList.add('is-new'); S.popAnim = false; }
  placePops();

  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) {
      el.focus({ preventScroll: true });
      try { if (keep.s != null && typeof el.setSelectionRange === 'function' && /^(text|search|url|tel|password)$|textarea/i.test(el.type || el.tagName)) el.setSelectionRange(keep.s, keep.e); } catch (_) {}
    }
  }
}

/* Um campo de texto cresce com o que se escreve; o canto de arrastar sai. */
function autosize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 2 + 'px';
}

/* Um painel que nasceria fora da janela pela direita alinha-se pela direita, e
   um que não cabe embaixo do campo abre para cima. Medido depois de pintar. */
function placePops() {
  const pop = root.querySelector('.nd-pop');
  if (!pop || !S.pop) return;
  /* Decidido uma vez, ao abrir, e guardado no estado: recalcular a cada
     mudança de conteúdo fazia o painel pular de lado quando a altura mudava. */
  if (!S.pop.placed) {
    pop.classList.remove('nd-pop--right', 'nd-pop--up');
    const r = pop.getBoundingClientRect();
    const a = pop.parentElement.getBoundingClientRect();
    const below = window.innerHeight - a.bottom, above = a.top;
    S.pop.right = S.pop.kind === 'deadline' || r.right > document.documentElement.clientWidth - 12;
    S.pop.up = r.height + 16 > below && above > below;
    S.pop.placed = true;
  }
  pop.classList.toggle('nd-pop--right', !!S.pop.right);
  pop.classList.toggle('nd-pop--up', !!S.pop.up);
}

/* O painel aberto muda de conteúdo sem redesenhar a página: o elemento fica, o
   miolo troca, e não há nada para piscar. O campo que o abriu e o que depende
   dele (o fim da faixa, a ficha da duração) são atualizados à mão. */
function patchPop() {
  const pop = root.querySelector('.nd-pop');
  if (!pop || !S.pop) { render(); return; }
  const f = S.form;
  if (S.pop.kind === 'time') {
    const sl = slotsFor(S.pop.day)[S.pop.i];
    if (!sl) { render(); return; }
    pop.innerHTML = timePopInner(sl.start, `data-day="${S.pop.day}" data-i="${S.pop.i}"`);
    const b = document.getElementById(S.pop.id);
    if (b) { b.querySelector('span').textContent = sl.start; const end = b.closest('.nd-slot-row')?.querySelector('.nd-slot-end'); if (end) end.textContent = slotEnd(sl); }
  } else if (S.pop.kind === 'duration') {
    syncDuration();
  } else if (S.pop.kind === 'deadline') {
    pop.innerHTML = deadlinePopInner();
    const b = document.getElementById('nd-dl');
    if (b) { b.querySelector('span').textContent = f.dl.date ? fmtDateTime(localDateTime(f.dl.date, f.dl.time)) : tt('no_deadline'); b.classList.toggle('is-empty', !f.dl.date); }
  }
  placePops();
}

/* A duração "outra" tem um campo de digitação dentro do painel: trocar o miolo
   inteiro engoliria o que a pessoa está digitando. Só o que mudou é tocado. */
function syncDuration() {
  const f = S.form;
  const v = fmtDur(f.customMin);
  const pop = root.querySelector('.nd-pop--dur');
  if (pop) {
    const head = pop.querySelector('.nd-pop-value'); if (head) head.textContent = v;
    const inp = pop.querySelector('#nd-dur-input'); if (inp && document.activeElement !== inp) inp.value = f.customMin;
    pop.querySelectorAll('[data-action="dur-set"]').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.getAttribute('data-dur')) === f.customMin)));
  }
  const chip = document.getElementById('nd-dur-custom'); if (chip) chip.querySelector('span').textContent = v;
  root.querySelectorAll('.nd-slot-row .nd-timebtn').forEach((b) => {
    const sl = slotsFor(b.getAttribute('data-day'))[Number(b.getAttribute('data-i'))];
    const end = b.closest('.nd-slot-row').querySelector('.nd-slot-end');
    if (sl && end) end.textContent = slotEnd(sl);
  });
}

/* O nome vai inteiro, com o ph-, porque tools/build-icon-subsets.js varre este
   arquivo atrás de "ph-<nome>" literal para montar a folha desta página. Um
   nome montado em tempo de execução não entra na folha e vira um quadrado. */
const icon = (cls) => `<i class="ph ${cls}" aria-hidden="true"></i>`;
const googleG = () => `<img class="nd-g" src="${GOOGLE_G}" alt="" width="18" height="18">`;

// ---- Home ----------------------------------------------------
function renderHome() {
  const notice = CONFIGURED ? '' : `<div class="nd-notice">${icon('ph-warning-circle')}<p>${esc(tt('not_configured_short'))}</p></div>`;
  if (!isGoogleUser()) return `<div class="nd-single">${notice}${renderCreateForm()}</div>`;
  return `
    <div class="nd-grid nd-grid--home">
      <div>${notice}${renderCreateForm()}</div>
      <aside class="nd-side">
        ${renderAccount()}
        ${renderMine()}
      </aside>
    </div>`;
}

function renderAccount() {
  return `
    <div class="nd-pane glass nd-account">
      ${avatar(displayName(S.user), myPhoto())}
      <div class="nd-account-who">
        <b>${esc(displayName(S.user))}</b>
        <span>${esc(S.user.email || '')}</span>
      </div>
      <button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="signout">${esc(tt('sign_out'))}</button>
    </div>`;
}

function renderMine() {
  let body;
  if (S.mine === null) body = `<p class="nd-quiet">${esc(tt('loading'))}</p>`;
  else if (S.mine.length === 0) body = `<p class="nd-quiet">${esc(tt('mine_empty'))}</p>`;
  else body = `<ul class="nd-mine-list">${S.mine.map((p) => `
      <li>
        <a href="?p=${encodeURIComponent(p.id)}" data-nav="?p=${encodeURIComponent(p.id)}">
          <span class="nd-mine-title">${esc(p.title)}</span>
          <span class="nd-mine-meta">
            <span class="nd-status nd-status--${statusKind(p)}"><i class="nd-dot"></i>${esc(statusText(p))}</span>
            <span class="nd-mono">${esc(tt('mine_options', { n: (p.options || []).length }))}</span>
            ${p.answers == null ? '' : `<span class="nd-mono">${esc(tt(isBooking(p) ? 'mine_bookings' : 'mine_answers', { n: p.answers }))}</span>`}
          </span>
        </a>
      </li>`).join('')}</ul>`;
  return `
    <div class="nd-pane glass">
      <h3 class="nd-pane-title">${esc(tt('mine_title'))}</h3>
      ${body}
    </div>`;
}

const statusKind = (p) => (p.finalOptionId ? 'final' : pollOpen(p) ? 'open' : 'closed');
const statusText = (p) => tt(p.finalOptionId ? 'status_final' : pollOpen(p) ? 'status_open' : 'status_closed');

function renderCreateForm() {
  const f = S.form;
  const n = f.selected.size;
  const booking = f.kind === 'booking';
  const signed = isGoogleUser();
  const submitLabel = f.busy ? tt('creating') : (CONFIGURED && !signed ? tt('create_signin') : tt('create'));
  const dlDate = f.dl.date ? localDateTime(f.dl.date, f.dl.time) : null;
  return `
    <form class="nd-pane glass nd-create" id="nd-create" novalidate>
      <div class="nd-form-head">
        <h2 class="nd-pane-title">${esc(tt('create_title'))}</h2>
        ${CONFIGURED && !signed ? `<button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="signin" ${S.authReady ? '' : 'disabled'}>${googleG()} ${esc(tt('sign_in'))}</button>` : ''}
      </div>

      <div class="nd-block">
        <input class="nd-title-input" id="nd-f-title" type="text" maxlength="${MAX.title}" autocomplete="off" placeholder="${esc(booking ? tt('f_title_ph_booking') : tt('f_title_ph'))}" value="${esc(f.title)}" data-bind="title" aria-label="${esc(tt('f_title'))}" required>
        <div class="nd-field-row">
          <div class="nd-field">
            <label class="nd-label" for="nd-f-desc">${esc(tt('f_desc'))}</label>
            <textarea class="nd-input nd-textarea" id="nd-f-desc" rows="1" maxlength="${MAX.description}" placeholder="${esc(tt('f_desc_ph'))}" data-bind="description">${esc(f.description)}</textarea>
          </div>
          <div class="nd-field">
            <label class="nd-label" for="nd-f-loc">${esc(tt('f_location'))}</label>
            <input class="nd-input" id="nd-f-loc" type="text" maxlength="${MAX.location}" autocomplete="off" placeholder="${esc(tt('f_location_ph'))}" value="${esc(f.location)}" data-bind="location">
          </div>
        </div>
      </div>

      <div class="nd-block nd-block--inline">
        <span class="nd-label" id="nd-kind-label">${esc(tt('f_kind'))}</span>
        <div class="nd-seg" role="group" aria-labelledby="nd-kind-label">
          <button type="button" data-action="kind" data-kind="group" aria-pressed="${!booking}">${esc(tt('kind_group'))}</button>
          <button type="button" data-action="kind" data-kind="booking" aria-pressed="${booking}">${esc(tt('kind_booking'))}</button>
        </div>
        <p class="nd-quiet nd-block-desc">${esc(booking ? tt('kind_booking_d') : tt('kind_group_d'))}</p>
      </div>

      <div class="nd-block">
        <span class="nd-label">${esc(tt('f_dates'))}</span>
        <div class="nd-dates">
          ${renderCalendar({ cal: f.cal, selected: f.selected, dayAction: 'day', monthAction: 'month' })}
          <div class="nd-dates-side">
            <span class="nd-label" id="nd-mode-label">${esc(tt('f_mode'))}</span>
            <div class="nd-seg nd-seg--stack" role="group" aria-labelledby="nd-mode-label">
              <button type="button" data-action="mode" data-mode="days" aria-pressed="${f.mode === 'days'}">${esc(tt('mode_days'))}</button>
              <button type="button" data-action="mode" data-mode="slots" aria-pressed="${f.mode === 'slots'}">${esc(tt('mode_slots'))}</button>
            </div>
            ${f.mode === 'slots' ? `
            <span class="nd-label" id="nd-dur-label">${esc(tt('f_duration'))}</span>
            <div class="nd-dur" role="group" aria-labelledby="nd-dur-label">
              ${DURATIONS.map((d) => `<button type="button" data-action="duration" data-dur="${d}" aria-pressed="${f.duration === d}">${esc(fmtDur(d))}</button>`).join('')}
              <span class="nd-popwrap">
                <button type="button" id="nd-dur-custom" data-action="pop" data-pop="duration" aria-pressed="${f.duration === 'custom'}" aria-expanded="${S.pop?.kind === 'duration'}"><span>${esc(f.duration === 'custom' ? fmtDur(f.customMin) : tt('dur_custom'))}</span>${icon('ph-caret-down')}</button>
                ${S.pop?.kind === 'duration' ? renderDurationPop() : ''}
              </span>
            </div>` : ''}
            ${f.mode === 'slots' ? `
            <span class="nd-label" id="nd-tz-label">${esc(tt('tz_label'))}</span>
            ${tzField('nd-tz-form', f.tz, 'form')}` : ''}
            <p class="nd-count nd-mono" aria-live="polite">${n ? esc(n === 1 ? tt('n_selected_one') : tt('n_selected', { n })) : ''}</p>
          </div>
        </div>
        ${f.mode === 'slots' ? (n ? renderSlots() : `<p class="nd-quiet nd-slots-empty">${esc(tt('pick_days_first'))}</p>`) : ''}
      </div>

      <div class="nd-block nd-block--options">
        ${booking ? '' : `
        <div class="nd-switch-row">
          <button type="button" class="nd-switch" role="switch" aria-checked="${!!f.allowMaybe}" data-action="toggle-maybe" id="nd-maybe"><span class="nd-switch-knob"></span></button>
          <label for="nd-maybe">${esc(tt('allow_maybe'))}</label>
        </div>`}
        <div class="nd-dl-row nd-popwrap">
          <span class="nd-label" id="nd-dl-label">${esc(tt('deadline'))}</span>
          <button type="button" class="nd-timebtn ${dlDate ? '' : 'is-empty'}" id="nd-dl" data-action="pop" data-pop="deadline" aria-labelledby="nd-dl-label" aria-expanded="${S.pop?.kind === 'deadline'}">
            <span>${esc(dlDate ? fmtDateTime(dlDate) : tt('no_deadline'))}</span>${icon('ph-caret-down')}
          </button>
          ${dlDate ? `<button type="button" class="nd-icon-btn" data-action="dl-clear" aria-label="${esc(tt('clear'))}" title="${esc(tt('clear'))}">${icon('ph-x')}</button>` : ''}
          ${S.pop?.kind === 'deadline' ? renderDeadlinePop() : ''}
        </div>
      </div>

      ${f.error ? `<p class="nd-error" role="alert">${esc(f.error)}</p>` : ''}

      <div class="nd-form-foot">
        <button type="submit" class="btn glass-btn nd-btn ${CONFIGURED && !signed ? 'nd-btn--google' : 'nd-btn--primary'} btn-lg" ${f.busy || !CONFIGURED ? 'disabled' : ''}>
          ${f.busy ? icon('ph-spinner') : CONFIGURED && !signed ? googleG() : ''}${esc(submitLabel)}
        </button>
        <button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="clear-form" ${formHasContent() ? '' : 'hidden'}>${esc(tt('clear_all'))}</button>
      </div>
    </form>`;
}

/* Um mês. Serve ao calendário dos dias e ao do prazo; o que muda é a ação de
   cada botão e o que está marcado (um conjunto de dias, ou um dia só). */
function renderCalendar({ cal, selected, dayAction, monthAction, compact }) {
  const { y, m } = cal;
  const first = new Date(y, m, 1);
  /* Semana começando na segunda, como no Brasil e na Suíça. */
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const isSel = (k) => (selected instanceof Set ? selected.has(k) : selected === k);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="nd-cal-pad" aria-hidden="true"></span>');
  for (let d = 1; d <= days; d++) {
    const k = dateKey(new Date(y, m, d));
    const past = k < todayKey;
    const sel = isSel(k);
    const cls = ['nd-cal-day', sel ? 'is-selected' : '', k === todayKey ? 'is-today' : '', past ? 'is-past' : ''].filter(Boolean).join(' ');
    cells.push(`<button type="button" class="${cls}" data-action="${dayAction}" data-day="${k}" aria-pressed="${sel}" ${past ? 'disabled' : ''} aria-label="${esc(fmtDayLong(new Date(y, m, d)))}">${d}</button>`);
  }
  const monday = new Date(2024, 0, 1); // uma segunda-feira qualquer
  const wd = [];
  for (let i = 0; i < 7; i++) { const d = addDays(monday, i); wd.push(`<span class="nd-cal-wd">${esc(d.toLocaleDateString(locale(), { weekday: compact ? 'narrow' : 'short' }).replace(/\.$/, ''))}</span>`); }
  const now = thisMonth();
  const atNow = y === now.y && m === now.m;
  return `
    <div class="nd-cal ${compact ? 'nd-cal--compact' : ''}">
      <div class="nd-cal-head">
        <span class="nd-cal-month">${esc(fmtMonth(y, m))}</span>
        <span class="nd-cal-navs">
          <button type="button" class="nd-cal-nav" data-action="${monthAction}" data-dir="-1" aria-label="${esc(tt('prev_month'))}" ${atNow ? 'disabled' : ''}>${icon('ph-caret-left')}</button>
          <button type="button" class="nd-cal-nav" data-action="${monthAction}" data-dir="1" aria-label="${esc(tt('next_month'))}">${icon('ph-caret-right')}</button>
        </span>
      </div>
      <div class="nd-cal-grid">${wd.join('')}${cells.join('')}</div>
    </div>`;
}

/* O campo de fuso: o mesmo botão-campo, e um painel com busca. target diz se
   muda o fuso do formulário ou o da leitura. */
function tzField(id, tz, target) {
  const open = S.pop && S.pop.kind === 'tz' && S.pop.id === id;
  return `<span class="nd-popwrap">
      <button type="button" class="nd-timebtn" id="${id}" data-action="pop" data-pop="tz" data-target="${target}" aria-expanded="${!!open}" aria-label="${esc(tt('tz_label'))}"><span>${esc(tzLabel(tz))}</span>${icon('ph-caret-down')}</button>
      ${open ? renderTzPop(tz, target) : ''}
    </span>`;
}
function renderTzPop(tz, target) { return popShell('tz', tt('tz_label'), tzPopInner(tz, target, '')); }
function tzPopInner(tz, target, q) {
  const query = q.trim().toLowerCase().replace(/ /g, '_');
  const item = (z) => `<button type="button" class="nd-tz-item" data-action="tz-set" data-tz="${esc(z)}" data-target="${target}" aria-pressed="${z === tz}"><span>${esc(z.replace(/_/g, ' '))}</span><span class="nd-mono">${esc(tzLabel(z).replace(/^.*\((.*)\)$/, '$1'))}</span></button>`;
  const first = [VIEWER_TZ, ...COMMON_TZ.filter((z) => z !== VIEWER_TZ)];
  const list = query
    ? allTimeZones().filter((z) => z.toLowerCase().includes(query)).slice(0, 40)
    : first;
  return `
      <div class="nd-pop-head"><span class="nd-pop-value">${esc(tzLabel(tz))}</span><button type="button" class="nd-icon-btn" data-action="pop-close" aria-label="${esc(tt('done'))}">${icon('ph-x')}</button></div>
      <input class="nd-input" id="nd-tz-q" type="search" autocomplete="off" placeholder="${esc(tt('tz_search'))}" value="${esc(q)}" data-bind-tzq="${target}" data-tz-current="${esc(tz)}">
      <div class="nd-tz-list">${list.length ? list.map(item).join('') : `<p class="nd-quiet">${esc(tt('tz_none'))}</p>`}</div>`;
}

/* O campo de hora: um botão com o valor, e o painel embaixo quando aberto. */
function timeField(id, value, data) {
  const open = S.pop && S.pop.kind === 'time' && S.pop.id === id;
  return `<span class="nd-popwrap">
      <button type="button" class="nd-timebtn nd-mono" id="${id}" data-action="pop" data-pop="time" ${data} aria-expanded="${!!open}" aria-label="${esc(tt('hour'))}"><span>${esc(value)}</span>${icon('ph-caret-down')}</button>
      ${open ? renderTimePop(value, data) : ''}
    </span>`;
}

const popShell = (kind, label, inner) => `<div class="nd-pop nd-pop--${kind} glass${S.pop?.placed ? (S.pop.right ? ' nd-pop--right' : '') + (S.pop.up ? ' nd-pop--up' : '') : ''}" role="dialog" aria-label="${esc(label)}">${inner}</div>`;

function renderTimePop(value, data) { return popShell('time', tt('hour'), timePopInner(value, data)); }
function timePopInner(value, data) {
  const [h, mm] = value.split(':');
  return `
      <div class="nd-pop-head"><span class="nd-pop-value nd-mono">${esc(value)}</span><button type="button" class="nd-icon-btn" data-action="pop-close" aria-label="${esc(tt('done'))}">${icon('ph-x')}</button></div>
      <div class="nd-pop-cols">
        <div><span class="nd-pop-h">${esc(tt('hour'))}</span>
          <div class="nd-pop-grid nd-pop-grid--h">${Array.from({ length: 24 }, (_, i) => `<button type="button" class="nd-pop-cell nd-mono" data-action="time-h" data-h="${i}" ${data} aria-pressed="${Number(h) === i}">${pad(i)}</button>`).join('')}</div>
        </div>
        <div><span class="nd-pop-h">${esc(tt('minute'))}</span>
          <div class="nd-pop-grid nd-pop-grid--m">${Array.from({ length: 12 }, (_, i) => pad(i * 5)).map((v) => `<button type="button" class="nd-pop-cell nd-mono" data-action="time-m" data-m="${v}" ${data} aria-pressed="${mm === v}">${v}</button>`).join('')}</div>
        </div>
      </div>`;
}

function renderDurationPop() {
  const f = S.form;
  return popShell('dur', tt('f_duration'), `
      <div class="nd-pop-head"><span class="nd-pop-value nd-mono">${esc(fmtDur(f.customMin))}</span><button type="button" class="nd-icon-btn" data-action="pop-close" aria-label="${esc(tt('done'))}">${icon('ph-x')}</button></div>
      <div class="nd-stepper">
        <button type="button" class="nd-cal-nav" data-action="dur-step" data-d="-5" aria-label="-5">${icon('ph-minus')}</button>
        <input class="nd-input nd-mono nd-stepper-input" id="nd-dur-input" type="number" inputmode="numeric" min="5" max="720" step="5" value="${f.customMin}" data-bind-custom aria-label="${esc(tt('custom_minutes'))}">
        <span class="nd-stepper-unit">${esc(tt('min'))}</span>
        <button type="button" class="nd-cal-nav" data-action="dur-step" data-d="5" aria-label="+5">${icon('ph-plus')}</button>
      </div>
      <div class="nd-pop-chips">${CUSTOM_DURATIONS.map((d) => `<button type="button" class="nd-pop-cell nd-mono" data-action="dur-set" data-dur="${d}" aria-pressed="${f.customMin === d}">${esc(fmtDur(d))}</button>`).join('')}</div>
      <div class="nd-pop-foot"><button type="button" class="btn glass-btn nd-btn nd-btn--primary btn-sm" data-action="pop-close">${esc(tt('done'))}</button></div>`);
}

function renderDeadlinePop() { return popShell('dl', tt('deadline'), deadlinePopInner()); }
function deadlinePopInner() {
  const f = S.form;
  const [h, mm] = f.dl.time.split(':');
  const firstDay = selectedKeys()[0];
  const eve = firstDay && firstDay > todayKey ? dateKey(addDays(fromKey(firstDay), -1)) : null;
  const quick = [
    { k: dateKey(addDays(today, 1)), label: tt('dl_tomorrow') },
    { k: dateKey(addDays(today, 3)), label: tt('dl_3days') },
    { k: dateKey(addDays(today, 7)), label: tt('dl_week') },
    ...(eve && eve >= todayKey ? [{ k: eve, label: tt('dl_eve') }] : []),
  ];
  return `
      <div class="nd-pop-head"><span class="nd-pop-value">${esc(f.dl.date ? fmtDateTime(localDateTime(f.dl.date, f.dl.time)) : tt('no_deadline'))}</span><button type="button" class="nd-icon-btn" data-action="pop-close" aria-label="${esc(tt('done'))}">${icon('ph-x')}</button></div>
      <div class="nd-pop-chips nd-pop-chips--top">${quick.map((q) => `<button type="button" class="nd-pop-cell" data-action="dl-day" data-day="${q.k}" aria-pressed="${f.dl.date === q.k}">${esc(q.label)}</button>`).join('')}</div>
      ${renderCalendar({ cal: f.dlCal, selected: f.dl.date, dayAction: 'dl-day', monthAction: 'dl-month', compact: true })}
      <div class="nd-pop-cols nd-pop-cols--dl">
        <div><span class="nd-pop-h">${esc(tt('hour'))}</span>
          <div class="nd-pop-grid nd-pop-grid--dlh">${DL_HOURS.map((i) => `<button type="button" class="nd-pop-cell nd-mono" data-action="dl-h" data-h="${i}" aria-pressed="${Number(h) === i}">${pad(i)}</button>`).join('')}</div>
        </div>
        <div><span class="nd-pop-h">${esc(tt('minute'))}</span>
          <div class="nd-pop-grid nd-pop-grid--dlm">${DL_MINUTES.map((v) => `<button type="button" class="nd-pop-cell nd-mono" data-action="dl-m" data-m="${v}" aria-pressed="${mm === v}">${v}</button>`).join('')}</div>
        </div>
      </div>
      <div class="nd-pop-foot">
        <button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="dl-clear">${esc(tt('clear'))}</button>
        <button type="button" class="btn glass-btn nd-btn nd-btn--primary btn-sm" data-action="pop-close">${esc(tt('done'))}</button>
      </div>`;
}

function renderSlots() {
  const keys = selectedKeys();
  return `
    <div class="nd-slots">
      <p class="nd-quiet">${esc(tt('f_slots_hint', { tz: tzLabel(S.form.tz) }))}</p>
      ${keys.map((k, di) => `
        <div class="nd-slot-day">
          <div class="nd-slot-dayname"><span>${esc(fmtDay(fromKey(k)))}</span><button type="button" class="nd-icon-btn nd-icon-btn--sm" data-action="day" data-day="${k}" aria-label="${esc(tt('remove_day'))}" title="${esc(tt('remove_day'))}">${icon('ph-x')}</button></div>
          <div class="nd-slot-rows">
            ${slotsFor(k).map((sl, i) => `
              <div class="nd-slot-row">
                ${timeField(`nd-s-${di}-${i}`, sl.start, `data-day="${k}" data-i="${i}"`)}
                <span class="nd-slot-sep" aria-hidden="true">–</span>
                <span class="nd-slot-end nd-mono">${esc(slotEnd(sl))}</span>
                <button type="button" class="nd-icon-btn" data-action="slot-del" data-day="${k}" data-i="${i}" aria-label="${esc(tt('remove'))}" title="${esc(tt('remove'))}">${icon('ph-x')}</button>
              </div>`).join('')}
            <button type="button" class="nd-link-btn" data-action="slot-add" data-day="${k}">${icon('ph-plus')} ${esc(tt('add_slot'))}</button>
          </div>
        </div>`).join('')}
      ${keys.length > 1 ? `<button type="button" class="nd-link-btn nd-link-btn--quiet nd-slots-copy" data-action="slot-copy">${icon('ph-copy')} ${esc(tt('copy_slots'))}</button>` : ''}
    </div>`;
}

// ---- Enquete -------------------------------------------------
function renderPoll() {
  const back = `<p class="nd-back"><a href="./noodle" data-nav="">${icon('ph-arrow-left')} ${esc(tt('back'))}</a></p>`;

  if (!CONFIGURED) {
    return `${back}
      <div class="nd-pane glass nd-setup">
        <h2 class="nd-pane-title">${esc(tt('setup_title'))}</h2>
        <p class="body-base">${esc(tt('setup_body'))}</p>
      </div>`;
  }
  if (S.pollMissing) {
    return `${back}<div class="nd-pane glass nd-setup"><h2 class="nd-pane-title">${esc(tt('err_notfound'))}</h2></div>`;
  }
  const poll = S.poll;
  if (!poll) return `${back}<p class="nd-loading">${icon('ph-spinner')} ${esc(tt('loading'))}</p>`;

  const views = optionViews(poll);
  const byId = Object.fromEntries(views.map((v) => [v.id, v]));
  const open = pollOpen(poll);
  const owner = isOwner();
  const booking = isBooking(poll);
  const dl = tsToDate(poll.deadline);
  const finalView = poll.finalOptionId ? byId[poll.finalOptionId] : null;

  let status = statusText(poll);
  if (poll.status === 'open' && dl) status += ' · ' + (dl.getTime() <= Date.now() ? tt('deadline_passed') : tt('deadline_note', { when: fmtDateTime(dl) }));

  const hasTimes = views.some((v) => v.time);
  const tzNote = hasTimes && poll.tz && poll.tz !== S.tz ? tt('tz_note_other', { tz: tzLabel(poll.tz) }) : '';

  return `${back}
    <header class="nd-pane glass nd-poll-head">
      <p class="nd-status nd-status--${statusKind(poll)}"><i class="nd-dot"></i>${esc(status)}</p>
      <h2 class="display-md nd-poll-title">${esc(poll.title)}</h2>
      ${poll.description ? `<p class="body-base nd-poll-desc">${linkify(poll.description)}</p>` : ''}
      <ul class="nd-poll-meta">
        ${poll.ownerName ? `<li>${avatar(poll.ownerName, poll.ownerPhoto, 'sm')}<span>${esc(tt('created_by', { name: poll.ownerName }))}</span></li>` : ''}
        ${poll.location ? `<li>${icon('ph-map-pin')}<span>${linkify(poll.location)}</span></li>` : ''}
        ${hasTimes ? `<li class="nd-tz-line">${icon('ph-globe')}<span>${esc(tt('tz_note'))}</span>${tzField('nd-tz-view', S.tz, 'view')}${tzNote ? `<span class="nd-quiet--inline">${esc(tzNote)}</span>` : ''}</li>` : ''}
      </ul>
      ${finalView ? `<div class="nd-final">${icon('ph-crown-simple')}<span><b>${esc(tt('final_note', { when: optionLabel(finalView) }))}</b>${calendarLinks(poll, finalView)}</span></div>` : ''}
    </header>

    ${booking ? renderBookingList(poll, views, open, owner) : renderGroupTable(poll, views, open, owner)}

    <div class="nd-grid nd-grid--poll">
      ${renderComments(poll, owner)}
      <aside class="nd-side">
        ${renderShare(poll)}
        ${owner ? renderAdmin(poll, views) : ''}
      </aside>
    </div>`;
}

function renderNameField() {
  return `<div class="nd-me-name">
      <label class="nd-label" for="nd-my-name">${esc(tt('your_name'))}</label>
      <input class="nd-input nd-input--name" id="nd-my-name" type="text" maxlength="${MAX.name}" autocomplete="name" placeholder="${esc(tt('your_name_ph'))}" value="${esc(S.draft.name)}" data-bind-draft="name">
    </div>`;
}

const markOf = (vote) => (vote === 'unset' ? '<span class="nd-mark v-unset"></span>' : `<span class="nd-mark v-${vote}">${icon(vote === 'yes' ? 'ph-check' : vote === 'maybe' ? 'ph-question' : 'ph-x')}</span>`);

/* Na linha de quem responde, uma casa ainda não tocada fica vazia, e não em
   "não": a casa vazia é o convite ao clique. Salvar sem tocar vale como não. */
const draftVote = (id) => { const v = S.draft.votes[id]; return v === 'yes' || v === 'maybe' || v === 'no' ? v : 'unset'; };

function renderGroupTable(poll, views, open, owner) {
  const groups = groupByDay(views);
  const hasTimes = views.some((v) => v.time);
  const c = counts(poll, S.responses);
  const n = S.responses.length;
  const { ids: best, everyone } = bestIds(views, c, n);
  const finalId = poll.finalOptionId || null;
  const colCls = (id) => [finalId === id ? 'is-final' : '', best.has(id) && !finalId ? (everyone ? 'is-best is-everyone' : 'is-best') : ''].filter(Boolean).join(' ');
  const flag = (id) => {
    if (finalId === id) return `<span class="nd-col-flag" title="${esc(tt('final_col'))}">${icon('ph-crown-simple')}</span>`;
    if (finalId || !best.has(id)) return '';
    return everyone
      ? `<span class="nd-col-flag" title="${esc(tt('all_can'))}">${icon('ph-crown-simple')}</span>`
      : `<span class="nd-col-flag nd-col-flag--soft" title="${esc(tt('best'))}">${icon('ph-star')}</span>`;
  };
  const myUid = S.user ? S.user.uid : null;
  const mine = myUid ? S.responses.find((r) => r.id === myUid) : null;

  /* Cabeçalho: dia da semana em cima, dia e mês embaixo; com horas, uma
     terceira linha com a faixa. */
  const head1 = `<tr>
      <th scope="col" class="nd-name-col" rowspan="${hasTimes ? 2 : 1}"></th>
      ${groups.map((g) => `<th scope="colgroup" class="nd-th-day ${g.items.length === 1 ? colCls(g.items[0].id) : ''}" colspan="${g.items.length}">${g.items.length === 1 ? flag(g.items[0].id) : ''}<span class="nd-th-wd">${esc(g.weekday)}</span><span class="nd-th-dm">${esc(g.dayMonth)}</span></th>`).join('')}
    </tr>`;
  const head2 = hasTimes ? `<tr>${views.map((v) => `<th scope="col" class="nd-th-time nd-mono ${colCls(v.id)}">${groups.find((g) => g.items.includes(v)).items.length > 1 ? flag(v.id) : ''}${v.time ? esc(v.time) : esc(tt('all_day'))}</th>`).join('')}</tr>` : '';
  const countRow = `<tr class="nd-count-row">
      <th scope="row" class="nd-name-col nd-count-label">${esc(tt('count_label'))}</th>
      ${views.map((v) => { const s = c[v.id]; return `<td class="nd-count ${colCls(v.id)}">
          <span class="nd-mono nd-count-yes">${s.yes}</span>${poll.allowMaybe && s.maybe ? `<span class="nd-mono nd-count-maybe">+${s.maybe}</span>` : ''}
        </td>`; }).join('')}
    </tr>`;

  const rows = S.responses.map((r) => {
    const isMe = myUid && r.id === myUid;
    if (isMe && open) return ''; // enquanto aberta, a própria pessoa está na linha editável, abaixo
    return `<tr class="${isMe ? 'nd-me-saved' : ''}">
      <th scope="row" class="nd-name-col"><span class="nd-name-wrap">
        ${avatar(r.name, r.photo, 'sm')}
        <span class="nd-name">${esc(r.name)}${isMe ? ` <small>${esc(tt('you'))}</small>` : ''}</span>
        ${owner && !isMe ? `<button type="button" class="nd-icon-btn nd-row-del" data-action="del-resp" data-uid="${esc(r.id)}" aria-label="${esc(tt('remove_participant', { name: r.name }))}" title="${esc(tt('remove_participant', { name: r.name }))}">${icon('ph-trash')}</button>` : ''}
      </span></th>
      ${views.map((v) => { const vote = voteOf(r, v.id); return `<td class="nd-cell ${colCls(v.id)}" title="${esc(r.name)}: ${esc(optionLabel(v))}"><span role="img" aria-label="${esc(tt('vote_' + vote))}">${markOf(vote)}</span></td>`; }).join('')}
    </tr>`;
  }).join('');

  const myRow = open ? `<tr class="nd-me">
      <th scope="row" class="nd-name-col"><span class="nd-name-wrap">
        ${avatar(S.draft.name || displayName(S.user), myPhoto(), 'sm')}
        <input class="nd-input nd-input--name" id="nd-my-name" type="text" maxlength="${MAX.name}" autocomplete="name" placeholder="${esc(tt('your_name_ph'))}" aria-label="${esc(tt('your_name'))}" value="${esc(S.draft.name)}" data-bind-draft="name">
      </span></th>
      ${views.map((v) => {
        const vote = draftVote(v.id);
        const next = vote === 'yes' ? (poll.allowMaybe ? 'maybe' : 'no') : vote === 'maybe' ? 'no' : 'yes';
        return `<td class="nd-cell ${colCls(v.id)}">
          <button type="button" class="nd-vote" data-action="vote" data-opt="${esc(v.id)}" data-next="${next}" title="${esc(optionLabel(v))}" aria-label="${esc(optionLabel(v))}: ${esc(tt('vote_' + vote))}">${markOf(vote)}</button>
        </td>`;
      }).join('')}
    </tr>` : '';

  const actions = open ? `
    <div class="nd-actions nd-actions--vote">
      <button type="button" class="btn glass-btn nd-btn nd-btn--primary" data-action="save" ${S.saving ? 'disabled' : ''}>${S.saving ? icon('ph-spinner') : ''}${esc(S.saving ? tt('saving') : mine ? tt('update') : tt('save'))}</button>
      ${mine ? `<button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="del-mine">${esc(tt('delete_mine'))}</button>` : `<span class="nd-quiet nd-quiet--inline">${esc(tt('vote_hint'))}</span>`}
    </div>` : '';

  return `
    <section class="nd-pane glass nd-table-pane" aria-labelledby="nd-participants-title">
      <div class="nd-pane-head">
        <h3 class="nd-pane-title" id="nd-participants-title">${esc(tt('participants'))} <span class="nd-mono nd-count-badge">${n}</span></h3>
        <div class="nd-legend" aria-hidden="true">
          <span>${markOf('yes')}${esc(tt('vote_yes'))}</span>
          ${poll.allowMaybe ? `<span>${markOf('maybe')}${esc(tt('vote_maybe'))}</span>` : ''}
          <span>${markOf('no')}${esc(tt('vote_no'))}</span>
        </div>
      </div>
      <div class="nd-table-wrap">
        <table class="nd-table ${hasTimes ? 'has-times' : ''}">
          <thead>${head1}${head2}</thead>
          <tbody>${rows}${myRow}</tbody>
          <tfoot>${countRow}</tfoot>
        </table>
      </div>
      ${!n && !open ? `<p class="nd-quiet nd-empty">${esc(tt('no_answers'))}</p>` : ''}
      ${actions}
    </section>`;
}

function renderBookingList(poll, views, open, owner) {
  const groups = groupByDay(views);
  const byOpt = Object.fromEntries(S.bookings.map((b) => [b.id, b]));
  const myUid = S.user ? S.user.uid : null;
  const mineBooking = myUid ? S.bookings.find((b) => b.uid === myUid) : null;
  const taken = views.filter((v) => byOpt[v.id]).length;

  const items = groups.map((g) => `
    <li class="nd-book-day">
      <h4 class="nd-book-dayname">${esc(g.dayLong)}</h4>
      <ul class="nd-book-slots">
        ${g.items.map((v) => {
          const b = byOpt[v.id];
          const mine = b && myUid && b.uid === myUid;
          const cls = ['nd-book-slot', b ? (mine ? 'is-mine' : 'is-taken') : 'is-free'].join(' ');
          let right;
          if (mine) right = `<span class="nd-book-who">${icon('ph-check-circle')}${esc(tt('yours'))}</span>
              ${calendarLinks(poll, v)}
              ${open ? `<button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="unbook" data-opt="${esc(v.id)}">${esc(tt('cancel_booking'))}</button>` : ''}`;
          else if (b) right = `<span class="nd-book-who">${avatar(b.name, b.photo, 'sm')}${esc(b.name)}</span>
              ${owner ? `<button type="button" class="nd-icon-btn" data-action="unbook-any" data-opt="${esc(v.id)}" aria-label="${esc(tt('remove_booking', { name: b.name }))}" title="${esc(tt('remove_booking', { name: b.name }))}">${icon('ph-trash')}</button>` : ''}`;
          else if (open) right = `<button type="button" class="btn glass-btn nd-btn nd-btn--outline btn-sm" data-action="book" data-opt="${esc(v.id)}" ${S.booking || mineBooking ? 'disabled' : ''}>${S.booking === v.id ? icon('ph-spinner') : ''}${esc(S.booking === v.id ? tt('saving') : tt('book'))}</button>`;
          else right = `<span class="nd-book-who nd-book-free">${esc(tt('free'))}</span>`;
          return `<li class="${cls}">
            <span class="nd-book-time nd-mono">${v.time ? esc(v.time) : esc(tt('all_day'))}</span>
            <span class="nd-book-right">${right}</span>
          </li>`;
        }).join('')}
      </ul>
    </li>`).join('');

  return `
    <section class="nd-pane glass nd-book-pane" aria-labelledby="nd-book-title">
      <div class="nd-pane-head">
        <h3 class="nd-pane-title" id="nd-book-title">${esc(tt('book_title'))} <span class="nd-mono nd-count-badge">${taken}/${views.length}</span></h3>
        ${open && !mineBooking ? `<p class="nd-quiet">${esc(tt('book_hint'))}</p>` : ''}
        ${open && mineBooking ? `<p class="nd-quiet">${esc(tt('one_booking'))}</p>` : ''}
      </div>
      ${open && !mineBooking ? renderNameField() : ''}
      <ul class="nd-book-days">${items}</ul>
    </section>`;
}

function renderComments(poll, owner) {
  const myUid = S.user ? S.user.uid : null;
  const open = pollOpen(poll);
  /* Numa reserva já feita não há campo de nome na página; o comentário traz o
     seu. Na tabela de grupo o campo é a própria linha "você". */
  const nameHere = open && isBooking(poll) && S.bookings.some((b) => myUid && b.uid === myUid);
  return `
    <section class="nd-pane glass nd-comments" aria-labelledby="nd-comments-title">
      <h3 class="nd-pane-title" id="nd-comments-title">${esc(tt('comments'))}${S.comments.length ? ` <span class="nd-mono nd-count-badge">${S.comments.length}</span>` : ''}</h3>
      ${S.comments.length ? `<ul class="nd-comment-list">${S.comments.map((cm) => {
        const d = tsToDate(cm.createdAt);
        const isMine = myUid && cm.uid === myUid;
        const canDel = isMine || owner;
        const editing = S.editing && S.editing.id === cm.id;
        return `<li>
          ${avatar(cm.name, cm.photo)}
          <div class="nd-comment-body">
            <div class="nd-comment-head">
              <span class="nd-comment-name">${esc(cm.name)}</span>
              ${d ? `<time class="nd-mono" datetime="${d.toISOString()}">${esc(fmtDateTime(d))}</time>` : ''}
              ${cm.editedAt ? `<span class="nd-comment-edited">${esc(tt('edited'))}</span>` : ''}
              <span class="nd-comment-tools">
                ${isMine && open && !editing ? `<button type="button" class="nd-icon-btn" data-action="edit-comment" data-id="${esc(cm.id)}" aria-label="${esc(tt('edit'))}" title="${esc(tt('edit'))}">${icon('ph-pencil-simple')}</button>` : ''}
                ${canDel && !editing ? `<button type="button" class="nd-icon-btn" data-action="del-comment" data-id="${esc(cm.id)}" aria-label="${esc(tt('delete'))}" title="${esc(tt('delete'))}">${icon('ph-trash')}</button>` : ''}
              </span>
            </div>
            ${editing ? `
            <form class="nd-comment-edit" id="nd-comment-edit">
              <textarea class="nd-input nd-textarea" id="nd-comment-edit-text" rows="1" maxlength="${MAX.comment}" data-bind-edit>${esc(S.editing.text)}</textarea>
              <div class="nd-actions">
                <button type="submit" class="btn glass-btn nd-btn nd-btn--primary btn-sm" ${S.editing.busy || !S.editing.text.trim() ? 'disabled' : ''}>${S.editing.busy ? icon('ph-spinner') : ''}${esc(tt('save'))}</button>
                <button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="edit-cancel">${esc(tt('cancel'))}</button>
              </div>
            </form>` : `<p>${linkify(cm.text)}</p>`}
          </div>
        </li>`;
      }).join('')}</ul>` : `<p class="nd-quiet">${esc(tt('no_comments'))}</p>`}
      ${open ? `
      <form class="nd-comment-form" id="nd-comment-form">
        ${nameHere ? renderNameField() : ''}
        <textarea class="nd-input nd-textarea" id="nd-comment-text" rows="1" maxlength="${MAX.comment}" placeholder="${esc(tt('comment_ph'))}" data-bind-comment>${esc(S.comment.text)}</textarea>
        <button type="submit" class="btn glass-btn nd-btn nd-btn--outline btn-sm" ${S.comment.busy || !S.comment.text.trim() ? 'disabled' : ''}>${S.comment.busy ? icon('ph-spinner') : ''}${esc(tt('send'))}</button>
      </form>` : ''}
    </section>`;
}

function renderShare(poll) {
  const url = pollUrl(poll.id);
  const subject = tt('email_subject', { title: poll.title });
  const body = tt('email_body', { url });
  const mailto = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return `
    <div class="nd-pane glass nd-share">
      <h3 class="nd-pane-title">${esc(tt('share_title'))}</h3>
      <p class="nd-quiet">${esc(tt('share_hint'))}</p>
      <div class="nd-share-row">
        <input class="nd-input nd-mono" id="nd-share-url" type="text" readonly value="${esc(url)}" aria-label="${esc(tt('share_title'))}">
        <button type="button" class="btn glass-btn nd-btn nd-btn--primary btn-sm" data-action="copy">${esc(S.copied ? tt('copied') : tt('copy_link'))}</button>
      </div>
      <div class="nd-share-more">
        <a class="nd-chip" href="${mailto}">${icon('ph-paper-plane-tilt')} ${esc(tt('share_email'))}</a>
        ${canShare ? `<button type="button" class="nd-chip" data-action="share">${icon('ph-share-network')} ${esc(tt('share_native'))}</button>` : ''}
      </div>
    </div>`;
}

function renderAdmin(poll, views) {
  const finalId = poll.finalOptionId || null;
  const booking = isBooking(poll);
  return `
    <div class="nd-pane glass nd-admin">
      <h3 class="nd-pane-title">${esc(tt('admin_title'))}</h3>
      <div class="nd-admin-actions">
        ${poll.status === 'open'
          ? `<button type="button" class="btn glass-btn nd-btn nd-btn--outline btn-sm" data-action="status" data-status="closed">${esc(tt('close_poll'))}</button>`
          : `<button type="button" class="btn glass-btn nd-btn nd-btn--outline btn-sm" data-action="status" data-status="open">${esc(tt('reopen_poll'))}</button>`}
        <button type="button" class="nd-link-btn nd-link-btn--danger" data-action="del-poll">${esc(tt('delete_poll'))}</button>
      </div>
      ${booking ? '' : `
      <span class="nd-label">${esc(tt('pick_final'))}</span>
      <ul class="nd-final-list">
        ${views.map((v) => `<li>
          <button type="button" class="nd-final-opt ${finalId === v.id ? 'is-on' : ''}" data-action="final" data-opt="${esc(v.id)}" aria-pressed="${finalId === v.id}">
            <span class="nd-final-day">${esc(v.dayLabel)}</span>${v.time ? `<span class="nd-mono nd-final-time">${esc(v.time)}</span>` : ''}
            ${finalId === v.id ? icon('ph-crown-simple') : ''}
          </button>
        </li>`).join('')}
      </ul>
      ${finalId ? `<button type="button" class="nd-link-btn nd-link-btn--quiet" data-action="final" data-opt="">${esc(tt('unpick_final'))}</button>` : ''}`}
    </div>`;
}

// ============================================================
// Eventos: um ouvinte na raiz, ações por data-action
// ============================================================
function onClick(e) {
  const nav = e.target.closest('[data-nav]');
  if (nav && root.contains(nav)) {
    e.preventDefault();
    navigate(nav.getAttribute('data-nav'));
    return;
  }
  const btn = e.target.closest('[data-action]');
  if (!btn || !root.contains(btn)) return;
  const a = btn.getAttribute('data-action');
  const f = S.form;
  const slotOf = () => slotsFor(btn.getAttribute('data-day'))[Number(btn.getAttribute('data-i'))];

  /* Um clique em qualquer controle fora do painel aberto fecha o painel. */
  if (S.pop && !btn.closest('.nd-popwrap')) S.pop = null;

  switch (a) {
    case 'kind': {
      f.kind = btn.getAttribute('data-kind') === 'booking' ? 'booking' : 'group';
      if (f.kind === 'booking' && f.mode === 'days' && f.selected.size === 0) f.mode = 'slots';
      render();
      break;
    }
    case 'day': {
      const k = btn.getAttribute('data-day');
      if (f.selected.has(k)) { f.selected.delete(k); f.slots.delete(k); } else f.selected.add(k);
      f.error = null;
      render();
      break;
    }
    case 'month': case 'dl-month': {
      const which = a === 'month' ? 'cal' : 'dlCal';
      const dir = Number(btn.getAttribute('data-dir'));
      const d = new Date(f[which].y, f[which].m + dir, 1);
      f[which] = { y: d.getFullYear(), m: d.getMonth() };
      if (which === 'dlCal') patchPop(); else render();
      break;
    }
    case 'mode': f.mode = btn.getAttribute('data-mode'); S.pop = null; render(); break;
    case 'duration': f.duration = Number(btn.getAttribute('data-dur')); S.pop = null; render(); break;
    case 'toggle-maybe': f.allowMaybe = !f.allowMaybe; btn.setAttribute('aria-checked', String(f.allowMaybe)); break;

    /* painéis */
    case 'pop': {
      const kind = btn.getAttribute('data-pop');
      const id = btn.id;
      if (S.pop && S.pop.kind === kind && S.pop.id === id) { S.pop = null; }
      else {
        S.pop = { kind, id, day: btn.getAttribute('data-day'), i: Number(btn.getAttribute('data-i')) };
        if (kind === 'duration') f.duration = 'custom';
        if (kind === 'deadline' && f.dl.date) { const d = fromKey(f.dl.date); f.dlCal = { y: d.getFullYear(), m: d.getMonth() }; }
        S.popAnim = true;
      }
      render();
      if (S.pop && S.pop.kind === 'duration') { const inp = document.getElementById('nd-dur-input'); if (inp) { inp.focus(); inp.select(); } }
      if (S.pop && S.pop.kind === 'tz') document.getElementById('nd-tz-q')?.focus();
      break;
    }
    case 'pop-close': { const id = S.pop && S.pop.id; S.pop = null; render(); if (id) document.getElementById(id)?.focus(); break; }
    case 'time-h': case 'time-m': {
      const sl = slotOf(); if (!sl) break;
      const [h, m] = sl.start.split(':');
      sl.start = a === 'time-h' ? `${pad(btn.getAttribute('data-h'))}:${m}` : `${h}:${btn.getAttribute('data-m')}`;
      if (a === 'time-m') { S.pop = null; render(); } else patchPop();
      break;
    }
    case 'dur-step': f.customMin = clampMin(f.customMin + Number(btn.getAttribute('data-d'))); syncDuration(); break;
    case 'dur-set': f.customMin = clampMin(btn.getAttribute('data-dur')); S.pop = null; render(); break;
    case 'dl-day': {
      f.dl.date = btn.getAttribute('data-day');
      const d = fromKey(f.dl.date); f.dlCal = { y: d.getFullYear(), m: d.getMonth() };
      f.error = null;
      patchPop();
      break;
    }
    case 'dl-h': { const [, m] = f.dl.time.split(':'); f.dl.time = `${pad(btn.getAttribute('data-h'))}:${m}`; if (!f.dl.date) f.dl.date = dateKey(addDays(today, 1)); patchPop(); break; }
    case 'dl-m': { const [h] = f.dl.time.split(':'); f.dl.time = `${h}:${btn.getAttribute('data-m')}`; if (!f.dl.date) f.dl.date = dateKey(addDays(today, 1)); patchPop(); break; }
    case 'dl-clear': f.dl = { date: null, time: '18:00' }; S.pop = null; render(); break;

    case 'slot-add': { const list = slotsFor(btn.getAttribute('data-day')); list.push(nextSlot(list)); render(); break; }
    case 'slot-del': {
      /* Tirar o único horário de um dia é tirar o dia. Antes, um horário novo
         nascia no lugar, e o botão parecia não fazer nada. */
      const k = btn.getAttribute('data-day');
      const list = slotsFor(k);
      if (list.length <= 1) { f.selected.delete(k); f.slots.delete(k); }
      else list.splice(Number(btn.getAttribute('data-i')), 1);
      S.pop = null;
      render();
      break;
    }
    case 'clear-form': {
      const wipe = () => { S.form = freshForm(); S.pop = null; clearForm(); render(); };
      if (formHasContent()) ask({ text: tt('confirm_clear'), ok: tt('clear_all') }).then((yes) => { if (yes) wipe(); });
      else wipe();
      break;
    }
    case 'edit-comment': {
      const cm = S.comments.find((c) => c.id === btn.getAttribute('data-id'));
      if (cm) { S.editing = { id: cm.id, text: cm.text || '', busy: false }; render(); document.getElementById('nd-comment-edit-text')?.focus(); }
      break;
    }
    case 'edit-cancel': S.editing = null; render(); break;
    case 'tz-set': {
      const tz = btn.getAttribute('data-tz');
      if (!validTz(tz)) break;
      if (btn.getAttribute('data-target') === 'form') f.tz = tz; else S.tz = tz;
      storeTz(tz);
      S.pop = null;
      render();
      break;
    }
    case 'slot-copy': {
      const keys = selectedKeys();
      const src = slotsFor(keys[0]).map((s) => ({ ...s }));
      for (const k of keys.slice(1)) f.slots.set(k, src.map((s) => ({ ...s })));
      render();
      break;
    }
    case 'signin': signInGoogle().catch((err) => toast(errMsg(err))); break;
    case 'signout': signOutUser().then(() => navigate('')).catch((err) => toast(errMsg(err))); break;
    case 'vote': {
      const id = btn.getAttribute('data-opt');
      S.draft.votes[id] = btn.getAttribute('data-next');
      S.draftDirty = true;
      saveVoteDraft();
      render();
      break;
    }
    case 'save': saveVote(); break;
    case 'del-mine': if (S.user) deleteResponse(S.user.uid, 'confirm_delete_answer'); break;
    case 'del-resp': deleteResponse(btn.getAttribute('data-uid'), 'confirm_delete_answer'); break;
    case 'book': book(btn.getAttribute('data-opt')); break;
    case 'unbook': cancelBooking(btn.getAttribute('data-opt'), 'confirm_cancel_booking', 'cancel_booking'); break;
    case 'unbook-any': cancelBooking(btn.getAttribute('data-opt'), 'confirm_remove_booking', 'delete'); break;
    case 'del-comment': deleteComment(btn.getAttribute('data-id')); break;
    case 'status': setStatus(btn.getAttribute('data-status')); break;
    case 'final': {
      const id = btn.getAttribute('data-opt') || null;
      setFinal(S.poll && S.poll.finalOptionId === id ? null : id);
      break;
    }
    case 'del-poll': deletePoll(); break;
    case 'copy': {
      const input = document.getElementById('nd-share-url');
      const url = input ? input.value : location.href;
      const done = () => { S.copied = true; render(); setTimeout(() => { S.copied = false; render(); }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { input?.select(); });
      else { input?.select(); try { document.execCommand('copy'); done(); } catch (_) {} }
      break;
    }
    case 'share': {
      if (!S.poll || typeof navigator.share !== 'function') break;
      navigator.share({ title: S.poll.title, text: tt('email_body', { url: '' }).trim(), url: pollUrl(S.poll.id) }).catch(() => {});
      break;
    }
    default: break;
  }
  if (S.route.page === 'home') saveForm();
}

function onInput(e) {
  const el = e.target;
  if (!root.contains(el)) return;
  if (el.tagName === 'TEXTAREA') autosize(el);
  const bind = el.getAttribute('data-bind');
  if (bind) {
    S.form[bind] = el.value;
    if (S.form.error) { S.form.error = null; const p = root.querySelector('.nd-error'); if (p) p.remove(); }
    saveForm();
    /* Nada de redesenhar no meio da digitação: o navegador rejeita trocar o
       innerHTML enquanto processa o input do campo, e o texto se perde. */
    const clear = root.querySelector('[data-action="clear-form"]');
    if (clear) clear.hidden = !formHasContent();
    return;
  }
  if (el.hasAttribute('data-bind-tzq')) {
    /* A busca filtra a lista no lugar; o campo continua com o foco. */
    const pop = root.querySelector('.nd-pop--tz');
    if (pop) {
      const box = pop.querySelector('.nd-tz-list');
      const tmp = document.createElement('div');
      tmp.innerHTML = tzPopInner(el.getAttribute('data-tz-current'), el.getAttribute('data-bind-tzq'), el.value);
      box.innerHTML = tmp.querySelector('.nd-tz-list').innerHTML;
    }
    return;
  }
  if (el.hasAttribute('data-bind-edit')) {
    if (S.editing) { S.editing.text = el.value; const b = root.querySelector('#nd-comment-edit button[type=submit]'); if (b) b.disabled = S.editing.busy || !el.value.trim(); }
    return;
  }
  if (el.hasAttribute('data-bind-custom')) {
    const v = Number(el.value);
    if (v >= 5) { S.form.customMin = clampMin(v); syncDuration(); }
    return;
  }
  if (el.hasAttribute('data-bind-draft')) { S.draft.name = el.value; S.draftDirty = true; saveVoteDraft(); return; }
  if (el.hasAttribute('data-bind-comment')) {
    S.comment.text = el.value;
    const b = root.querySelector('#nd-comment-form button[type=submit]');
    if (b) b.disabled = S.comment.busy || !el.value.trim();
  }
}

function onSubmit(e) {
  if (!root.contains(e.target)) return;
  e.preventDefault();
  if (e.target.id === 'nd-create') createPoll();
  else if (e.target.id === 'nd-comment-form') addComment();
  else if (e.target.id === 'nd-comment-edit') saveCommentEdit();
}

/* Clicar fora de um painel, ou Esc, fecha o painel. */
function onDocClick(e) {
  if (!S.pop) return;
  /* Um clique dentro do painel pode ter trocado o miolo antes de chegar aqui:
     o alvo já não está na página, e um alvo órfão não é um clique fora. */
  if (!e.target.isConnected) return;
  if (e.target.closest && e.target.closest('.nd-popwrap')) return;
  S.pop = null;
  render();
}
function onKey(e) {
  if (document.getElementById('nd-dialog-wrap')) return;
  if (e.key === 'Escape' && S.pop) { const id = S.pop.id; S.pop = null; render(); if (id) document.getElementById(id)?.focus(); }
}

// ============================================================
// Arranque
// ============================================================
if (root) {
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('submit', onSubmit);
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
  window.addEventListener('popstate', route);
  document.addEventListener('langchange', () => render());

  /* Em localhost, o estado e o redesenho ficam à mão para se testar a página
     da enquete com dados fictícios, sem banco. Em produção não existe. */
  if (location.hostname === 'localhost') window.__noodle = { S, render, unwatch };

  S.tz = storedTz() || VIEWER_TZ;
  S.form = loadForm() || freshForm();

  if (CONFIGURED) fb().catch((e) => { console.error('[noodle] Firebase failed to load:', e); toast(tt('err_generic')); });
  route();

  const wake = () => { if (READY) return; READY = true; render(); };
  if (t('noodle.title') !== 'noodle.title') wake();
  else { document.addEventListener('langchange', wake, { once: true }); setTimeout(wake, 3000); }
}
