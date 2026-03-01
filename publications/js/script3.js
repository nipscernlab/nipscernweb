// /publications/js/script3.js
// =====================================================
// NIPSCERN • Starfield + HUB de Publicações (OFICIAL)
// - Multi-eixo (SAPHO/CERN/SC/CS)
// - Tipo (Congresso/Revista/TCC/Mestrado/Doutorado)
// - Idioma (PT/EN) antes do Ano
// - Ano, Busca, Favoritos
// - Infinite scroll
// - Botão flutuante "Voltar aos filtros" (robusto) ✅
// - ✅ Idioma da INTERFACE via PT/EN (texto puro)
// =====================================================


// -----------------------------------------------------
// 0) BOTÃO FLUTUANTE "VOLTAR AOS FILTROS" (ROBUSTO)
// -----------------------------------------------------
(function setupBackToTopGlobal() {
  const btn = document.getElementById("backToTop");
  if (!btn) return;

  const SHOW_AFTER = 250;

  function getScrollY() {
    return (
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  function onScroll() {
    btn.classList.toggle("is-show", getScrollY() > SHOW_AFTER);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  document.body.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const target =
      document.getElementById("filtersTop") ||
      document.querySelector(".pubs-filters") ||
      document.querySelector(".filters-container") ||
      document.getElementById("pubs") ||
      document.body;

    if (target && target !== document.body) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });
})();


// -----------------------------------------------------
// 1) FUNDO ESTRELADO + ESTRELAS CADENTES
// -----------------------------------------------------
(function starfield() {
  const canvas = document.getElementById("stars");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const DPR = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CFG = {
    densityDiv: 12000,
    radiusMin: 0.2,
    radiusMax: 1.2,
    layers: 3,
    twinkleMin: 0.3,
    twinkleSpan: 0.5,

    moveAmp: reduceMotion ? 2 : 5,
    moveFreq: 0.00005,

    shootingProb: reduceMotion ? 0.0005 : 0.0012,
    shootingBaseSpeed: 12,
    shootingExtraSpeed: 6,
    shootingLength: 260,
  };

  let width = 0;
  let height = 0;
  let stars = [];
  let shootingStars = [];
  let tick = 0;

  const rand = (min, max) => Math.random() * (max - min) + min;

  function resize() {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;

    canvas.width = width * DPR;
    canvas.height = height * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    generateStars();
  }

  function generateStars() {
    stars = [];
    const baseNum = Math.round((width * height) / CFG.densityDiv);

    for (let layer = 0; layer < CFG.layers; layer++) {
      for (let i = 0; i < baseNum; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: rand(CFG.radiusMin, CFG.radiusMax),
          layer,
          twinkleOffset: Math.random() * Math.PI * 2,
          baseAlpha: rand(CFG.twinkleMin, CFG.twinkleMin + CFG.twinkleSpan),
        });
      }
    }
  }

  function spawnShootingStar() {
    const fromTop = Math.random() < 0.5;
    const startX = -50;
    const startY = fromTop
      ? rand(height * 0.05, height * 0.45)
      : rand(height * 0.55, height * 0.95);

    const speed = CFG.shootingBaseSpeed + Math.random() * CFG.shootingExtraSpeed;

    shootingStars.push({
      x: startX,
      y: startY,
      vx: speed,
      vy: fromTop ? speed * 0.15 : -speed * 0.15,
      life: 0,
      maxLife: CFG.shootingLength,
    });
  }

  function update() {
    tick++;
    if (!reduceMotion && Math.random() < CFG.shootingProb) spawnShootingStar();

    shootingStars = shootingStars.filter((s) => {
      s.x += s.vx;
      s.y += s.vy;
      s.life += 1;
      return (
        s.x < width + 100 &&
        s.y > -100 &&
        s.y < height + 100 &&
        s.life < s.maxLife
      );
    });
  }

  function drawStars() {
    const t = tick * CFG.moveFreq;
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const depth = (star.layer + 1) / CFG.layers;
      const offsetX = Math.sin(t + star.layer) * CFG.moveAmp * depth;
      const offsetY = Math.cos(t * 1.3 + star.layer) * CFG.moveAmp * depth;

      const alpha =
        star.baseAlpha +
        Math.sin(t * 8 + star.twinkleOffset) * (CFG.twinkleSpan / 2);

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.beginPath();
      ctx.arc(star.x + offsetX, star.y + offsetY, star.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function drawShootingStars() {
    for (let i = 0; i < shootingStars.length; i++) {
      const s = shootingStars[i];
      const lifeRatio = 1 - s.life / s.maxLife;
      const length = CFG.shootingLength * (0.3 + 0.7 * lifeRatio);

      const tailX = s.x - s.vx * (length / CFG.shootingBaseSpeed);
      const tailY = s.y - s.vy * (length / CFG.shootingBaseSpeed);

      const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(0.25, "rgba(255, 255, 255, 0.3)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0.95)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
    }
  }

  function loop() {
    update();
    drawStars();
    drawShootingStars();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  loop();
})();


// -----------------------------------------------------
// 2) HUB de Publicações (OFICIAL) + i18n interface
// -----------------------------------------------------
(function hub() {
  const grid = document.getElementById("pubsGrid");
  if (!grid) return;

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  function escapeHTML(str) {
    return (str ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function highlight(text, query) {
    const raw = (text ?? "").toString();
    const q = (query ?? "").toString().trim();
    if (!q) return escapeHTML(raw);

    const qNorm = norm(q);
    if (!qNorm) return escapeHTML(raw);

    let out = "";
    let i = 0;

    while (i < raw.length) {
      const sliceRaw = raw.slice(i);
      const sliceNorm = norm(sliceRaw);

      const idx = sliceNorm.indexOf(qNorm);
      if (idx === -1) {
        out += escapeHTML(sliceRaw);
        break;
      }

      let start = 0;
      for (start = 0; start < sliceRaw.length; start++) {
        const nextAcc = norm(sliceRaw.slice(0, start + 1));
        if (nextAcc.length > idx) break;
      }

      let end = start;
      for (end = start; end < sliceRaw.length; end++) {
        const nextAcc = norm(sliceRaw.slice(0, end + 1));
        if (nextAcc.length >= idx + qNorm.length) break;
      }

      out += escapeHTML(sliceRaw.slice(0, start));
      out += `<span class="hl">${escapeHTML(sliceRaw.slice(start, end + 1))}</span>`;
      i += end + 1;
    }

    return out;
  }

  // -------------------------
  // i18n (idioma da interface)
  // -------------------------
  const UI_LANG_KEY = "nipscern_ui_lang_v1";

  const I18N = {
    pt: {
      site_title: "NIPSCERN — PUBLICAÇÕES",
      hero_title: "Sinergia entre SAPHO e CERN",
      pubs_title: "Publicações",
      axis_label: "EIXO",
      type_label: "TIPO",
      pdf_lang_label: "IDIOMA DO PDF",
      year_label: "ANO",
      search_label: "BUSCA",
      all: "Todos",

      type_congresso: "Congresso",
      type_revista: "Revista",
      type_tcc: "TCC",
      type_mestrado: "Mestrado",
      type_doutorado: "Doutorado",

      pdf_lang_pt: "Português",
      pdf_lang_en: "Inglês",

      search_ph: "Buscar por título, autor, ano...",
      open_pdf: "Abrir PDF",
      results_total: (n) => `${n} resultado(s)`,
      no_results: "Nenhuma publicação encontrada com os filtros atuais.",
      no_pubs_loaded:
        `Nenhuma publicação foi carregada. <br/>Verifique se existe <code>/publications/data/publicacoes.json</code>.`,
      loading_more: "Carregando mais resultados…",
    },
    en: {
      site_title: "NIPSCERN — PUBLICATIONS",
      hero_title: "Synergy between SAPHO and CERN",
      pubs_title: "Publications",
      axis_label: "AXIS",
      type_label: "TYPE",
      pdf_lang_label: "PDF LANGUAGE",
      year_label: "YEAR",
      search_label: "SEARCH",
      all: "All",

      type_congresso: "Conference",
      type_revista: "Journal",
      type_tcc: "Undergrad thesis",
      type_mestrado: "Master’s",
      type_doutorado: "PhD",

      pdf_lang_pt: "Portuguese",
      pdf_lang_en: "English",

      search_ph: "Search by title, author, year...",
      open_pdf: "Open PDF",
      results_total: (n) => `${n} result(s)`,
      no_results: "No publications found with the current filters.",
      no_pubs_loaded:
        `No publications loaded. <br/>Check if <code>/publications/data/publicacoes.json</code> exists.`,
      loading_more: "Loading more results…",
    },
  };

  let uiLang = (localStorage.getItem(UI_LANG_KEY) || "pt").toLowerCase();
  if (!I18N[uiLang]) uiLang = "pt";

  const t = (key, arg) => {
    const v = I18N[uiLang]?.[key];
    return typeof v === "function" ? v(arg) : (v ?? key);
  };

  function applyI18N() {
    document.documentElement.lang = uiLang === "en" ? "en" : "pt-BR";

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (!k) return;

      if (k === "hero_title") {
        if (uiLang === "en") {
          el.innerHTML = `Synergy between <span class="sapho-text">SAPHO</span> and <span class="cern-text">CERN</span>`;
        } else {
          el.innerHTML = `Sinergia entre <span class="sapho-text">SAPHO</span> e <span class="cern-text">CERN</span>`;
        }
        return;
      }

      el.textContent = t(k);
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const k = el.getAttribute("data-i18n-placeholder");
      if (!k) return;
      el.setAttribute("placeholder", t(k));
    });

    const loader = document.getElementById("pubLoader");
    if (loader) loader.textContent = t("loading_more");

    document.querySelectorAll(".lang-btn[data-lang]").forEach((b) => {
      b.classList.toggle(
        "is-active",
        (b.getAttribute("data-lang") || "").toLowerCase() === uiLang
      );
    });
  }

  function setUILang(lang) {
    const next = (lang || "pt").toLowerCase();
    if (!I18N[next]) return;
    uiLang = next;
    localStorage.setItem(UI_LANG_KEY, uiLang);
    applyI18N();
    populateYears();
    render();
  }

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".lang-btn[data-lang]");
    if (!btn) return;
    setUILang(btn.getAttribute("data-lang"));
  });

  // -------------------------
  // HUB
  // -------------------------
  const PAGE_SIZE = 24;
  const LS_KEY = "nipscern_favs_v1";
  const SOURCES = ["/publications/data/publicacoes.json"];

  const eixoWrap = document.getElementById("filterEixo");
  const tipoWrap = document.getElementById("filterTipo");
  const idiomaWrap = document.getElementById("filterIdioma");

  const yearSelect = document.getElementById("yearSelect");
  const yearDD = document.getElementById("yearDD");
  const yearBtn = document.getElementById("yearBtn");
  const yearBtnLabel = document.getElementById("yearBtnLabel");
  const yearMenu = document.getElementById("yearMenu");

  const searchEl = document.getElementById("pubSearch");
  const favOnlyBtn = document.getElementById("favOnlyBtn");
  const resultsMeta = document.getElementById("resultsMeta");

  const sentinelEl = document.getElementById("infiniteSentinel");
  const loaderEl = document.getElementById("pubLoader");

  let DATA = [];

  function resolveHref(path, baseJsonUrl) {
    try {
      return new URL(path, baseJsonUrl).pathname;
    } catch {
      return path;
    }
  }

  const loadFavs = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); }
    catch { return new Set(); }
  };
  const saveFavs = (set) => localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  let favs = loadFavs();

  let state = {
    eixos: new Set(["all"]),
    tipo: "all",
    idioma: "all",
    ano: "all",
    q: "",
    favOnly: false,
    limit: PAGE_SIZE,
  };

  let _io = null;
  let _isLoadingMore = false;
  let _lastFilteredTotal = 0;

  function eixoLabel(eixo) {
    const e = (eixo || "").toLowerCase();
    if (e === "sapho") return "SAPHO";
    if (e === "cern") return "CERN";
    if (e === "sc") return "SC (SAPHO × CERN)";
    return (eixo || "").toUpperCase();
  }

  function tipoLabel(tipo) {
    const tt = (tipo || "").toLowerCase();
    if (tt === "congresso") return uiLang === "en" ? "CONFERENCE" : "CONGRESSO";
    if (tt === "revista") return uiLang === "en" ? "JOURNAL" : "REVISTA";
    if (tt === "tcc") return "TCC";
    if (tt === "mestrado") return uiLang === "en" ? "MASTER’S" : "MESTRADO";
    if (tt === "doutorado") return uiLang === "en" ? "PHD" : "DOUTORADO";
    return (tipo || "").toUpperCase();
  }

  function idiomaLabel(id) {
    const v = (id || "").toLowerCase();
    if (v === "pt") return "PT";
    if (v === "en") return "EN";
    return (id || "").toUpperCase();
  }

  function badge(item) {
    const eixo = eixoLabel(item.eixo);
    const tipo = tipoLabel(item.tipo);
    const ano = item.ano ?? "—";
    const idi = idiomaLabel(item.idioma || "pt");
    return `${eixo} • ${tipo} • ${idi} • ${ano}`;
  }

  function normalizeIdioma(p) {
    const raw = (p?.idioma ?? p?.lingua ?? p?.language ?? "").toString().toLowerCase().trim();
    if (!raw) return "pt";
    if (raw.startsWith("pt")) return "pt";
    if (raw.startsWith("en")) return "en";
    if (raw.includes("port")) return "pt";
    if (raw.includes("ing")) return "en";
    return "pt";
  }

  function normalizeTipoETese(p) {
    const tipo = (p?.tipo || "").toString().toLowerCase().trim();
    const nivel = (p?.nivel || "").toString().toLowerCase().trim();

    if (tipo === "tese") {
      if (nivel === "tcc" || nivel === "mestrado" || nivel === "doutorado") return nivel;
      return "mestrado";
    }

    if (tipo === "tcc" || tipo === "mestrado" || tipo === "doutorado") return tipo;
    return tipo || "congresso";
  }

  async function loadPublicacoes() {
    const settled = await Promise.allSettled(
      SOURCES.map(async (url) => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${url} (${res.status})`);
        const json = await res.json();
        const baseJsonUrl = new URL(url, window.location.href);
        return { json, baseJsonUrl };
      })
    );

    const ok = [];
    const fail = [];
    settled.forEach((r) => (r.status === "fulfilled" ? ok.push(r.value) : fail.push(r.reason)));
    if (fail.length) console.warn("[HUB] Alguns JSONs falharam:", fail);

    DATA = ok.flatMap(({ json, baseJsonUrl }) => {
      const eixoRoot = (json.eixo || "").toLowerCase();
      const anoBase = Number(json.ano || 0);
      const pubs = Array.isArray(json.publicacoes) ? json.publicacoes : [];

      return pubs.map((p) => {
        let eixoItem = (p.eixo || eixoRoot || "").toLowerCase();
        if (eixoItem === "cs") eixoItem = "sc";

        return {
          id: p.id,
          eixo: eixoItem,
          tipo: normalizeTipoETese(p),
          idioma: normalizeIdioma(p),
          ano: Number(p.ano || anoBase),
          titulo: p.titulo || "Sem título",
          autores: p.autores || "—",
          resumo: p.resumo || "",
          palavrasChave: Array.isArray(p.palavrasChave) ? p.palavrasChave : [],
          veiculo: p.veiculo || "",
          arquivo: resolveHref(p.arquivo, baseJsonUrl),
        };
      });
    });

    console.log("[HUB] Total de publicações carregadas:", DATA.length);
  }

  function getEixosActive() {
    if (state.eixos.has("all")) return null;
    return state.eixos;
  }

  function matches(item) {
    const active = getEixosActive();
    if (active && !active.has(item.eixo)) return false;

    if (state.tipo !== "all" && item.tipo !== state.tipo) return false;
    if (state.idioma !== "all" && (item.idioma || "pt") !== state.idioma) return false;
    if (state.ano !== "all" && String(item.ano) !== String(state.ano)) return false;
    if (state.favOnly && !favs.has(item.id)) return false;

    const q = norm(state.q);
    if (q) {
      const hay = norm(
        `${item.titulo} ${item.autores} ${item.resumo} ${item.veiculo} ${(item.palavrasChave || []).join(" ")} ` +
        `${item.eixo} ${item.tipo} ${item.idioma} ${item.ano}`
      );
      if (!hay.includes(q)) return false;
    }

    return true;
  }

  function cardHTML(item) {
    const isFav = favs.has(item.id);

    return `
      <article class="pub-card" data-id="${item.id}" data-eixo="${item.eixo}">
        <div class="pub-top">
          <span class="pub-badge">${badge(item)}</span>

          <button class="fav-btn ${isFav ? "is-fav" : ""}" type="button"
            aria-label="Favoritar" aria-pressed="${isFav ? "true" : "false"}"
            title="Favoritar">
            <i class="${isFav ? "fa-solid fa-star" : "fa-regular fa-star"}"></i>
          </button>
        </div>

        <h3 class="pub-title">${highlight(item.titulo, state.q)}</h3>
        <p class="pub-meta">${highlight(item.autores, state.q)}</p>
        ${item.veiculo ? `<p class="pub-veic">${highlight(item.veiculo, state.q)}</p>` : ""}
        ${item.resumo ? `<p class="pub-resumo">${highlight(item.resumo, state.q)}</p>` : ""}

        <div class="pub-actions">
          <a class="pub-open"
             href="/publications/viewer/index.html?file=${encodeURIComponent(item.arquivo)}"
             target="_blank" rel="noopener">
            ${t("open_pdf")}
            <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>
      </article>
    `;
  }

  function setActiveChips(container, attr, activeValue) {
    if (!container) return;
    container.querySelectorAll(`[${attr}]`).forEach((btn) => {
      const v = btn.getAttribute(attr);
      btn.classList.toggle("is-active", v === activeValue);
    });
  }

  function syncEixoChipsUI() {
    if (!eixoWrap) return;
    eixoWrap.querySelectorAll("[data-eixo]").forEach((btn) => {
      const v = btn.getAttribute("data-eixo");
      btn.classList.toggle("is-active", state.eixos.has(v));
    });
  }

  function reserveYearSpace(open) {
    const block = yearDD?.closest(".filter-block");
    if (!block) return;

    if (!open) {
      block.style.marginBottom = "";
      return;
    }

    const menu = yearMenu;
    if (!menu) return;

    const h = menu.getBoundingClientRect().height;
    block.style.marginBottom = `${Math.ceil(h + 14)}px`;
  }

  function closeYearMenu() {
    if (!yearDD) return;
    yearDD.classList.remove("is-open");
    yearBtn?.setAttribute("aria-expanded", "false");
    reserveYearSpace(false);
  }

  function openYearMenu() {
    if (!yearDD) return;
    yearDD.classList.add("is-open");
    yearBtn?.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => reserveYearSpace(true));
  }

  function populateYears() {
    if (!yearSelect || !yearMenu || !yearBtnLabel) return;

    const years = Array.from(new Set(DATA.map((d) => d.ano)))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);

    yearSelect.innerHTML =
      `<option value="all">${t("all")}</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("");

    const items = ["all", ...years.map(String)];
    yearMenu.innerHTML = `
      <div class="year-grid">
        ${items
          .map((v) => {
            const label = v === "all" ? t("all") : v;
            const active = String(state.ano) === String(v) ? "is-active" : "";
            return `<button type="button" class="year-item ${active}" data-year="${v}">${label}</button>`;
          })
          .join("")}
      </div>
    `;

    yearBtnLabel.textContent = state.ano === "all" ? t("all") : String(state.ano);
  }

  yearBtn?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const open = yearDD.classList.contains("is-open");
    if (open) closeYearMenu();
    else openYearMenu();
  });

  yearMenu?.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".year-item");
    if (!btn) return;

    const v = btn.getAttribute("data-year") || "all";
    state.ano = v;
    if (yearSelect) yearSelect.value = v;
    if (yearBtnLabel) yearBtnLabel.textContent = v === "all" ? t("all") : v;

    yearMenu.querySelectorAll(".year-item").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-year") === v);
    });

    state.limit = PAGE_SIZE;
    closeYearMenu();
    render();
  });

  document.addEventListener("click", () => closeYearMenu());
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeYearMenu(); });

  function ensureInfiniteScroll() {
    if (!sentinelEl) return;

    const canLoad = state.limit < _lastFilteredTotal;

    if (!canLoad) {
      if (_io) _io.disconnect();
      if (loaderEl) loaderEl.hidden = true;
      return;
    }

    if (_io) _io.disconnect();

    _io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (_isLoadingMore) return;
        if (state.limit >= _lastFilteredTotal) return;

        _isLoadingMore = true;
        if (loaderEl) loaderEl.hidden = false;

        state.limit += PAGE_SIZE;
        render();

        if (loaderEl) loaderEl.hidden = true;
        _isLoadingMore = false;
      },
      { root: null, rootMargin: "1200px 0px 1200px 0px", threshold: 0 }
    );

    _io.observe(sentinelEl);
  }

  function render() {
    if (!DATA.length) {
      if (resultsMeta) resultsMeta.textContent = t("results_total", 0);
      grid.innerHTML = `<div class="no-results">${t("no_pubs_loaded")}</div>`;
      _lastFilteredTotal = 0;
      ensureInfiniteScroll();
      return;
    }

    const filtered = DATA
      .filter(matches)
      .sort((a, b) => b.ano - a.ano || norm(a.titulo).localeCompare(norm(b.titulo)));

    _lastFilteredTotal = filtered.length;
    const visible = filtered.slice(0, state.limit);

    if (resultsMeta) resultsMeta.textContent = t("results_total", filtered.length);

    if (!visible.length) {
      grid.innerHTML = `<div class="no-results">${t("no_results")}</div>`;
      ensureInfiniteScroll();
      return;
    }

    grid.innerHTML = visible.map(cardHTML).join("");

    grid.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".pub-card");
        const id = card?.getAttribute("data-id");
        if (!id) return;

        if (favs.has(id)) favs.delete(id);
        else favs.add(id);

        saveFavs(favs);
        state.limit = Math.max(state.limit, PAGE_SIZE);
        render();
      });
    });

    ensureInfiniteScroll();
  }

  eixoWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-eixo]");
    if (!btn) return;

    const v = btn.getAttribute("data-eixo");

    if (v === "all") {
      state.eixos = new Set(["all"]);
    } else {
      if (state.eixos.has("all")) state.eixos.delete("all");
      if (state.eixos.has(v)) state.eixos.delete(v);
      else state.eixos.add(v);
      if (state.eixos.size === 0) state.eixos.add("all");
    }

    state.limit = PAGE_SIZE;
    syncEixoChipsUI();
    render();
  });

  tipoWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tipo]");
    if (!btn) return;

    const tipo = btn.getAttribute("data-tipo") || "all";
    state.tipo = tipo;

    state.limit = PAGE_SIZE;
    setActiveChips(tipoWrap, "data-tipo", state.tipo);
    render();
  });

  idiomaWrap?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-idioma]");
    if (!btn) return;

    const v = btn.getAttribute("data-idioma") || "all";
    state.idioma = v;

    state.limit = PAGE_SIZE;
    setActiveChips(idiomaWrap, "data-idioma", state.idioma);
    render();
  });

  searchEl?.addEventListener("input", () => {
    state.q = searchEl.value;
    state.limit = PAGE_SIZE;
    render();
  });

  favOnlyBtn?.addEventListener("click", () => {
    state.favOnly = !state.favOnly;
    favOnlyBtn.setAttribute("aria-pressed", state.favOnly ? "true" : "false");
    favOnlyBtn.classList.toggle("is-active", state.favOnly);
    state.limit = PAGE_SIZE;
    render();
  });

  document.addEventListener("click", (e) => {
    const link = e.target.closest(".venn-link[data-eixo]");
    if (!link) return;

    e.preventDefault();
    const eixo = (link.getAttribute("data-eixo") || "all").toLowerCase();

    state.eixos = new Set([eixo]);
    state.tipo = "all";
    state.idioma = "all";
    state.ano = "all";
    state.q = "";
    state.favOnly = false;
    state.limit = PAGE_SIZE;

    syncEixoChipsUI();
    setActiveChips(tipoWrap, "data-tipo", "all");
    setActiveChips(idiomaWrap, "data-idioma", "all");

    if (searchEl) searchEl.value = "";

    if (favOnlyBtn) {
      favOnlyBtn.classList.remove("is-active");
      favOnlyBtn.setAttribute("aria-pressed", "false");
    }

    if (yearSelect) yearSelect.value = "all";
    if (yearBtnLabel) yearBtnLabel.textContent = t("all");
    if (yearMenu) {
      yearMenu.querySelectorAll(".year-item").forEach((b) => {
        b.classList.toggle("is-active", b.getAttribute("data-year") === "all");
      });
    }

    closeYearMenu();
    render();
    document.getElementById("pubs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  (async function initHub() {
    try {
      applyI18N();
      await loadPublicacoes();

      populateYears();
      syncEixoChipsUI();
      setActiveChips(tipoWrap, "data-tipo", state.tipo);
      setActiveChips(idiomaWrap, "data-idioma", state.idioma);

      render();
    } catch (err) {
      console.error("[HUB] Erro ao iniciar:", err);
      if (resultsMeta) resultsMeta.textContent = t("results_total", 0);
      grid.innerHTML = `<div class="no-results">Erro ao carregar publicações. Veja o Console (F12).</div>`;
    }
  })();
})();

// -----------------------------------------------------
// VENN • Opção 2: convergência + SC aparece depois
// -----------------------------------------------------
(function vennJoinOption2() {
  const venn = document.querySelector(".diagram.venn");
  if (!venn) return;

  const reduceMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return;

  venn.classList.add("venn-join-2");

  window.setTimeout(() => {
    venn.classList.remove("venn-join-2");
  }, 1300);
})();