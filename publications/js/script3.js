// /publications/js/script3.js
// =====================================================
// NIPSCERN • Starfield + HUB de Publicações (OFICIAL)
// - Multi-eixo (SAPHO/CERN/SC/CS)
// - Tipo, Ano, Busca, Favoritos
// - TESE com submenu (TCC/Mestrado/Doutorado) ✅ fix definitivo
// - Infinite scroll (carrega automaticamente ao chegar no fim) ✅
// =====================================================

// -----------------------------------------------------
// 1) FUNDO ESTRELADO + ESTRELAS CADENTES
// -----------------------------------------------------
(function () {
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

    if (!reduceMotion && Math.random() < CFG.shootingProb) {
      spawnShootingStar();
    }

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
// 2) HUB de Publicações (OFICIAL)
// -----------------------------------------------------
(function () {
  const grid = document.getElementById("pubsGrid");
  if (!grid) return;

  const PAGE_SIZE = 24;
  const LS_KEY = "nipscern_favs_v1";
  let DATA = [];

  const SOURCES = ["/publications/data/publicacoes.json"];

  const eixoWrap = document.getElementById("filterEixo");
  const tipoWrap = document.getElementById("filterTipo");

  const yearSelect = document.getElementById("yearSelect");
  const yearDD = document.getElementById("yearDD");
  const yearBtn = document.getElementById("yearBtn");
  const yearBtnLabel = document.getElementById("yearBtnLabel");
  const yearMenu = document.getElementById("yearMenu");

  const searchEl = document.getElementById("pubSearch");
  const favOnlyBtn = document.getElementById("favOnlyBtn");
  const resultsMeta = document.getElementById("resultsMeta");

  // Infinite scroll UI (precisa existir no HTML)
  const sentinelEl = document.getElementById("infiniteSentinel");
  const loaderEl = document.getElementById("pubLoader");

  // TESE submenu
  const chipTeseBtn = document.getElementById("chipTeseBtn");
  const submenuTese = document.getElementById("submenuTese");

  function resolveHref(path, baseJsonUrl) {
    try {
      return new URL(path, baseJsonUrl).pathname;
    } catch {
      return path;
    }
  }

  const loadFavs = () => {
    try {
      return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  };
  const saveFavs = (set) =>
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  let favs = loadFavs();

  let state = {
    eixos: new Set(["all"]),
    tipo: "all",
    niveis: new Set(), // tcc | mestrado | doutorado
    ano: "all",
    q: "",
    favOnly: false,
    limit: PAGE_SIZE,
  };

  let _io = null;
  let _isLoadingMore = false;
  let _lastFilteredTotal = 0;

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

 
function eixoLabel(eixo) {
  const e = (eixo || "").toLowerCase();
  if (e === "sapho") return "SAPHO";
  if (e === "cern") return "CERN";
  if (e === "sc") return "SC (SAPHO × CERN)";
  return (eixo || "").toUpperCase();
}



  function tipoLabel(tipo) {
    const t = (tipo || "").toLowerCase();
    if (t === "congresso") return "CONGRESSO";
    if (t === "revista") return "REVISTA";
    if (t === "tese") return "TESE";
    return (tipo || "").toUpperCase();
  }

  function nivelLabel(nivel) {
    const n = (nivel || "").toLowerCase();
    if (n === "tcc") return "TCC";
    if (n === "mestrado") return "MESTRADO";
    if (n === "doutorado") return "DOUTORADO";
    return (nivel || "").toUpperCase();
  }

  function badge(item) {
    const eixo = eixoLabel(item.eixo);
    const tipo = tipoLabel(item.tipo);
    const ano = item.ano ?? "—";

    if ((item.tipo || "").toLowerCase() === "tese" && item.nivel) {
      return `${eixo} • ${tipo} (${nivelLabel(item.nivel)}) • ${ano}`;
    }
    return `${eixo} • ${tipo} • ${ano}`;
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

    settled.forEach((r) =>
      r.status === "fulfilled" ? ok.push(r.value) : fail.push(r.reason)
    );
    if (fail.length) console.warn("[HUB] Alguns JSONs falharam:", fail);

    DATA = ok.flatMap(({ json, baseJsonUrl }) => {
      const eixoRoot = (json.eixo || "").toLowerCase();
      const anoBase = Number(json.ano || 0);
      const pubs = Array.isArray(json.publicacoes) ? json.publicacoes : [];

return pubs.map((p) => {
  let eixoItem = (p.eixo || eixoRoot || "").toLowerCase();

  // 🔁 normalização definitiva CS → SC
  if (eixoItem === "cs") eixoItem = "sc";

  return {
    id: p.id,
    eixo: eixoItem,
    tipo: (p.tipo || "").toLowerCase(),
    ano: Number(p.ano || anoBase),
    titulo: p.titulo || "Sem título",
    autores: p.autores || "—",
    resumo: p.resumo || "",
    palavrasChave: Array.isArray(p.palavrasChave) ? p.palavrasChave : [],
    veiculo: p.veiculo || "",
    nivel: p.nivel ? String(p.nivel).toLowerCase() : null,
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

    if (state.niveis.size > 0) {
      if (item.tipo !== "tese") return false;
      if (!item.nivel || !state.niveis.has(item.nivel)) return false;
    }

    if (state.ano !== "all" && String(item.ano) !== String(state.ano))
      return false;
    if (state.favOnly && !favs.has(item.id)) return false;

    const q = norm(state.q);
    if (q) {
      const hay = norm(
        `${item.titulo} ${item.autores} ${item.resumo} ${item.veiculo} ${(item.palavrasChave || []).join(
          " "
        )} ${item.eixo} ${item.tipo} ${item.ano} ${item.nivel || ""}`
      );
      if (!hay.includes(q)) return false;
    }

    return true;
  }

  function cardHTML(item) {
    const isFav = favs.has(item.id);
    const resumoHTML = item.resumo ? `<p class="pub-resumo">${item.resumo}</p>` : "";
    const veicHTML = item.veiculo ? `<p class="pub-veic">${item.veiculo}</p>` : "";

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

        <h3 class="pub-title">${item.titulo}</h3>
        <p class="pub-meta">${item.autores}</p>
        ${veicHTML}
        ${resumoHTML}

        <div class="pub-actions">
          <a class="pub-open" href="${item.arquivo}" target="_blank" rel="noopener">
            Abrir PDF
            <i class="fa-solid fa-up-right-from-square" aria-hidden="true"></i>
          </a>
        </div>
      </article>
    `;
  }

  function setActiveChips(container, attr, activeValue) {
    container.querySelectorAll(`[${attr}]`).forEach((btn) => {
      const v = btn.getAttribute(attr);
      btn.classList.toggle("is-active", v === activeValue);
    });
  }

  function syncEixoChipsUI() {
    const btns = eixoWrap.querySelectorAll("[data-eixo]");
    btns.forEach((btn) => {
      const v = btn.getAttribute("data-eixo");
      btn.classList.toggle("is-active", state.eixos.has(v));
    });
  }

  // -----------------------
  // ANO dropdown (2 colunas)
  // -----------------------
  function populateYears() {
    const years = Array.from(new Set(DATA.map((d) => d.ano)))
      .filter((y) => Number.isFinite(y))
      .sort((a, b) => b - a);

    yearSelect.innerHTML =
      `<option value="all">Todos</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("");

    const items = [`all`, ...years.map(String)];
    yearMenu.innerHTML = `
      <div class="year-grid">
        ${items
          .map((v) => {
            const label = v === "all" ? "Todos" : v;
            const active = String(state.ano) === String(v) ? "is-active" : "";
            return `<button type="button" class="year-item ${active}" data-year="${v}">${label}</button>`;
          })
          .join("")}
      </div>
    `;

    yearBtnLabel.textContent = state.ano === "all" ? "Todos" : String(state.ano);
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

  yearBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    const open = yearDD.classList.contains("is-open");
    if (open) closeYearMenu();
    else openYearMenu();
  });

  yearMenu.addEventListener("click", (ev) => {
    const btn = ev.target.closest(".year-item");
    if (!btn) return;

    const v = btn.getAttribute("data-year") || "all";
    state.ano = v;
    yearSelect.value = v;

    yearBtnLabel.textContent = v === "all" ? "Todos" : v;

    yearMenu.querySelectorAll(".year-item").forEach((b) => {
      b.classList.toggle("is-active", b.getAttribute("data-year") === v);
    });

    state.limit = PAGE_SIZE;
    closeYearMenu();
    render();
  });

  // -----------------------
  // TESE submenu (FIX DEFINITIVO)
  // -----------------------
  function markActiveNivelUI() {
    submenuTese.querySelectorAll(".submenu-item[data-nivel]").forEach((b) => {
      const n = String(b.getAttribute("data-nivel") || "").toLowerCase();
      b.classList.toggle("is-active", state.niveis.has(n));
    });
  }

  function closeTeseMenu() {
    submenuTese.classList.remove("is-open");
    chipTeseBtn.setAttribute("aria-expanded", "false");
  }

  function openTeseMenu() {
    submenuTese.classList.add("is-open");
    chipTeseBtn.setAttribute("aria-expanded", "true");

    if (submenuTese.parentElement !== document.body) {
      document.body.appendChild(submenuTese);
    }

    const r = chipTeseBtn.getBoundingClientRect();
    const gap = 10;

    const top = Math.round(r.bottom + gap);
    let left = Math.round(r.left);

    submenuTese.style.top = `${top}px`;
    submenuTese.style.left = `${left}px`;

    const menuW = submenuTese.offsetWidth || 280;
    const maxLeft = window.innerWidth - menuW - 12;
    if (left > maxLeft) {
      left = Math.max(12, maxLeft);
      submenuTese.style.left = `${left}px`;
    }
  }

  function toggleTeseMenu() {
    const isOpen = submenuTese.classList.contains("is-open");
    if (isOpen) closeTeseMenu();
    else openTeseMenu();
  }

  chipTeseBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();

    state.tipo = "tese";
    setActiveChips(tipoWrap, "data-tipo", "tese");

    toggleTeseMenu();
    markActiveNivelUI();
    state.limit = PAGE_SIZE;
    render();
  });

  submenuTese.addEventListener("click", (ev) => {
    ev.stopPropagation();

    const btn = ev.target.closest(".submenu-item[data-nivel]");
    if (!btn) return;

    const nivel = String(btn.getAttribute("data-nivel") || "").toLowerCase();
    if (state.niveis.has(nivel)) state.niveis.delete(nivel);
    else state.niveis.add(nivel);

    state.tipo = "tese";
    setActiveChips(tipoWrap, "data-tipo", "tese");

    markActiveNivelUI();
    state.limit = PAGE_SIZE;
    render();
  });

  document.addEventListener("click", () => {
    closeYearMenu();
    closeTeseMenu();
  });

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeYearMenu();
      closeTeseMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (submenuTese.classList.contains("is-open")) openTeseMenu();
  });
  window.addEventListener(
    "scroll",
    () => {
      if (submenuTese.classList.contains("is-open")) openTeseMenu();
    },
    true
  );

  // -----------------------
  // Infinite scroll (liga/desliga conforme os filtros)
  // -----------------------
  function ensureInfiniteScroll() {
    if (!sentinelEl) return;

    const canLoad = state.limit < _lastFilteredTotal;

    // se não tem mais para carregar, desconecta e esconde loader
    if (!canLoad) {
      if (_io) _io.disconnect();
      if (loaderEl) loaderEl.hidden = true;
      return;
    }

    // garante que existe um observer ativo
    if (_io) _io.disconnect();

    _io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) return;
        if (_isLoadingMore) return;

        if (state.limit >= _lastFilteredTotal) return;

        _isLoadingMore = true;
        if (loaderEl) loaderEl.hidden = false;

        // carrega mais + re-render
        state.limit += PAGE_SIZE;
        render();

        if (loaderEl) loaderEl.hidden = true;
        _isLoadingMore = false;
      },
      { root: null, rootMargin: "1200px 0px 1200px 0px", threshold: 0 }
    );

    _io.observe(sentinelEl);
  }

  // -----------------------
  // Render
  // -----------------------
  function render() {
    if (!DATA.length) {
      resultsMeta.textContent = "Mostrando 0 de 0 resultado(s)";
      grid.innerHTML = `
        <div class="no-results">
          Nenhuma publicação foi carregada. <br/>
          Verifique se o arquivo existe em <code>/publications/data/publicacoes.json</code>.
        </div>
      `;
      _lastFilteredTotal = 0;
      ensureInfiniteScroll();
      return;
    }

    const filtered = DATA
      .filter(matches)
      .sort(
        (a, b) => b.ano - a.ano || norm(a.titulo).localeCompare(norm(b.titulo))
      );

    _lastFilteredTotal = filtered.length;

    const visible = filtered.slice(0, state.limit);

    resultsMeta.textContent = `Mostrando ${visible.length} de ${filtered.length} resultado(s)`;

    grid.innerHTML =
      visible.map(cardHTML).join("") ||
      `<div class="no-results">Nenhuma publicação encontrada com os filtros atuais.</div>`;

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

    // (re)liga infinite scroll sempre que renderiza (filtros mudam, total muda, etc.)
    ensureInfiniteScroll();
  }

  // -----------------------
  // Eventos: EIXO / TIPO / BUSCA / FAV
  // -----------------------
  eixoWrap.addEventListener("click", (e) => {
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

  tipoWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tipo]");
    if (!btn) return;

    // TESE é tratado no listener do chipTeseBtn
    if (btn.id === "chipTeseBtn") return;

    const tipo = btn.getAttribute("data-tipo") || "all";
    state.tipo = tipo;

    if (tipo !== "tese") {
      state.niveis.clear();
      closeTeseMenu();
      markActiveNivelUI();
    }

    state.limit = PAGE_SIZE;
    setActiveChips(tipoWrap, "data-tipo", state.tipo);
    render();
  });

  searchEl.addEventListener("input", () => {
    state.q = searchEl.value;
    state.limit = PAGE_SIZE;
    render();
  });

  favOnlyBtn.addEventListener("click", () => {
    state.favOnly = !state.favOnly;
    favOnlyBtn.setAttribute("aria-pressed", state.favOnly ? "true" : "false");
    favOnlyBtn.classList.toggle("is-active", state.favOnly);
    state.limit = PAGE_SIZE;
    render();
  });

  // -----------------------
  // Boot
  // -----------------------
  (async function initHub() {
    await loadPublicacoes();
    populateYears();
    syncEixoChipsUI();
    setActiveChips(tipoWrap, "data-tipo", state.tipo);
    render();
  })();
})();
