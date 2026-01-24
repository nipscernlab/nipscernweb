// =====================================================
// NIPSCERN • Starfield (meteoro) + Publicações (JSON)
// Arquivo único, limpo e sem duplicações
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
// 2) PUBLICAÇÕES POR ANO (JSON + filtros + busca + fav)
// (mantido para páginas antigas que usam #lista-publicacoes)
// -----------------------------------------------------
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("lista-publicacoes");
    if (!container) return;

    const statusEl = document.getElementById("status-publicacoes");
    const countEl = document.getElementById("publications-count");
    const searchEl = document.getElementById("busca-publicacoes");

    const jsonPath = container.dataset.jsonPath;
    const eixo = (container.dataset.eixo || "").toUpperCase();
    const ano = container.dataset.ano || "";

    const btnTipo = Array.from(document.querySelectorAll("[data-filter-tipo]"));
    const btnNivel = Array.from(document.querySelectorAll("[data-filter-nivel]"));
    const subRow = document.querySelector(".subfilters-row");

    const backBtn = document.querySelector(".back-arrow-btn");

    const LS_KEY = "nipscern:favorites:v1";
    const readFavs = () => {
      try {
        return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
      } catch {
        return new Set();
      }
    };
    const writeFavs = (set) =>
      localStorage.setItem(LS_KEY, JSON.stringify([...set]));

    let lista = [];
    let tipoAtual = "todos";
    let nivelAtual = "";
    let termoBusca = "";

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    function pluralPublicacao(n) {
      if (n === 1) return "1 publicação";
      return `${n} publicações`;
    }

    function setCount(n) {
      if (countEl) countEl.textContent = pluralPublicacao(n);
    }

    function labelTipo(tipo, nivel) {
      if (tipo === "congresso") return "Artigo de congresso";
      if (tipo === "revista") return "Artigo de revista";
      if (tipo === "tese") {
        if (nivel === "tcc") return "Trabalho de conclusão de curso";
        if (nivel === "mestrado") return "Dissertação de mestrado";
        if (nivel === "doutorado") return "Tese de doutorado";
        return "Tese";
      }
      return "Publicação";
    }

    function criarCard(pub) {
      const card = document.createElement("article");
      card.className = "publication-card";
      card.dataset.tipo = pub.tipo || "outro";
      card.dataset.nivel = pub.nivel || "";
      card.dataset.id = pub.id || "";

      const titulo = pub.titulo || "Publicação sem título";
      const autores = pub.autores || "";
      const tipoLbl = labelTipo(pub.tipo, pub.nivel);
      const veiculo = pub.veiculo || "";
      const resumo = pub.resumo || "";
      const arquivo = pub.arquivo || "#";

      const favs = readFavs();
      const isFav = pub.id && favs.has(pub.id);

      card.innerHTML = `
        <button class="fav-btn ${isFav ? "is-fav" : ""}" type="button" aria-label="Favoritar">
          <i class="${isFav ? "fa-solid fa-star" : "fa-regular fa-star"}"></i>
        </button>

        <h2 class="publication-title">${titulo}</h2>

        <p class="publication-meta">
          ${autores ? `<span class="pub-authors">${autores}</span>` : ""}
          ${tipoLbl ? ` • <span class="pub-type">${tipoLbl}</span>` : ""}
          ${veiculo ? ` • <span class="pub-venue">${veiculo}</span>` : ""}
          ${ano ? ` • <span class="pub-year">${ano}</span>` : ""}
          ${eixo ? ` • <span class="pub-axis">${eixo}</span>` : ""}
        </p>

        ${resumo ? `<p class="publication-summary">${resumo}</p>` : ""}

        <a href="${arquivo}" class="publication-link" target="_blank" rel="noopener noreferrer">
          📄 Abrir PDF
        </a>
      `;

      const favBtn = card.querySelector(".fav-btn");
      favBtn.addEventListener("click", () => {
        if (!pub.id) return;
        const favs2 = readFavs();
        if (favs2.has(pub.id)) favs2.delete(pub.id);
        else favs2.add(pub.id);
        writeFavs(favs2);
        aplicarFiltros();
      });

      return card;
    }

    function matchesBusca(pub, term) {
      if (!term) return true;
      const t = term.toLowerCase();
      const hay = [
        pub.titulo || "",
        pub.autores || "",
        pub.resumo || "",
        pub.veiculo || "",
        pub.tipo || "",
        pub.nivel || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(t);
    }

    function marcarAtivoTipo(btnAtivo) {
      btnTipo.forEach((b) => b.classList.remove("is-active"));
      if (btnAtivo) btnAtivo.classList.add("is-active");
    }

    function marcarAtivoNivel(btnAtivo) {
      btnNivel.forEach((b) => b.classList.remove("is-active"));
      if (btnAtivo) btnAtivo.classList.add("is-active");
    }

    function mostrarSubfiltros(show) {
      if (!subRow) return;
      subRow.style.display = show ? "flex" : "none";
      if (!show) {
        nivelAtual = "";
        marcarAtivoNivel(null);
      }
    }

    function aplicarFiltros() {
      const favs = readFavs();

      const filtradas = lista.filter((pub) => {
        const tipo = pub.tipo || "outro";
        const nivel = pub.nivel || "";
        const isFav = pub.id && favs.has(pub.id);

        if (tipoAtual === "favoritos" && !isFav) return false;
        if (tipoAtual !== "todos" && tipoAtual !== "favoritos") {
          if (tipo !== tipoAtual) return false;
        }

        if (nivelAtual) {
          if (tipo !== "tese") return false;
          if (nivel !== nivelAtual) return false;
        }

        if (!matchesBusca(pub, termoBusca)) return false;

        return true;
      });

      container.innerHTML = "";
      filtradas.forEach((pub) => container.appendChild(criarCard(pub)));
      setCount(filtradas.length);
    }

    function initUI() {
      mostrarSubfiltros(false);

      btnTipo.forEach((btn) => {
        btn.addEventListener("click", () => {
          tipoAtual = btn.getAttribute("data-filter-tipo") || "todos";

          mostrarSubfiltros(tipoAtual === "tese");
          if (tipoAtual !== "tese") nivelAtual = "";

          marcarAtivoTipo(btn);
          aplicarFiltros();
        });
      });

      btnNivel.forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          nivelAtual = btn.getAttribute("data-filter-nivel") || "";

          tipoAtual = "tese";
          mostrarSubfiltros(true);

          const btnTese = document.querySelector('[data-filter-tipo="tese"]');
          marcarAtivoTipo(btnTese);
          marcarAtivoNivel(btn);

          aplicarFiltros();
        });
      });

      if (searchEl) {
        searchEl.addEventListener("input", () => {
          termoBusca = (searchEl.value || "").trim();
          aplicarFiltros();
        });
      }

      if (backBtn) {
        backBtn.addEventListener("click", () => window.history.back());
      }
    }

    async function carregarJSON() {
      if (!jsonPath) {
        setStatus("Configuração ausente (data-json-path não informado).");
        setCount(0);
        return;
      }

      try {
        setStatus("Carregando publicações...");
        const resp = await fetch(jsonPath);
        if (!resp.ok) throw new Error("Falha ao carregar JSON: " + resp.status);

        const data = await resp.json();
        lista = Array.isArray(data.publicacoes) ? data.publicacoes : [];

        if (!lista.length) {
          setStatus("Nenhuma publicação cadastrada para este ano.");
          setCount(0);
          container.innerHTML = "";
          return;
        }

        setStatus("");
        mostrarSubfiltros(tipoAtual === "tese");
        aplicarFiltros();
      } catch (err) {
        console.error(err);
        setStatus("Ocorreu um erro ao carregar as publicações.");
        setCount(0);
      }
    }

    initUI();
    carregarJSON();
  });
})();

// =====================================================
// 3) NIPSCERN • HUB de Publicações (filtros + cards)
//   - Multi-eixo (SAPHO/CERN/SC)
//   - Tipo, Ano, Busca, Favoritos
//   - Inicial: mais recentes + "Carregar mais"
//   - ✅ Puxa JSONs em /data/*/*.json
//   - ✅ NÃO derruba tudo se 1 JSON falhar
// =====================================================
(function () {
  const grid = document.getElementById("pubsGrid");
  if (!grid) return;

  const PAGE_SIZE = 24;
  const LS_KEY = "nipscern_favs_v1";

  let DATA = [];

  // ✅ use caminhos ABSOLUTOS: funcionam no local e no site
  const SOURCES = [
    "/data/cern/2001.json",
    "/data/cern/2004.json",
    "/data/cern/2005.json",
    "/data/cern/2008.json",
  ];

  function resolveHref(path, baseJsonUrl) {
    try {
      return new URL(path, baseJsonUrl).pathname; // "/artigos/pdfs/..."
    } catch {
      return path;
    }
  }

  async function loadPublicacoes() {
    // ✅ não usa Promise.all (que derruba tudo)
    const settled = await Promise.allSettled(
      SOURCES.map(async (url) => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`${url} (${res.status})`);
        const json = await res.json();
        const baseJsonUrl = new URL(url, window.location.href);
        return { json, baseJsonUrl, url };
      })
    );

    const ok = [];
    const fail = [];

    settled.forEach((r) => {
      if (r.status === "fulfilled") ok.push(r.value);
      else fail.push(r.reason);
    });

    if (fail.length) {
      console.warn("[HUB] Alguns JSONs falharam (vou ignorar e seguir):", fail);
    }

    DATA = ok.flatMap(({ json, baseJsonUrl }) => {
      const eixo = (json.eixo || "").toLowerCase();
      const anoBase = Number(json.ano || 0);
      const pubs = Array.isArray(json.publicacoes) ? json.publicacoes : [];

      return pubs.map((p) => ({
        id: p.id,
        eixo,
        tipo: (p.tipo || "").toLowerCase(),
        ano: Number(p.ano || anoBase),
        titulo: p.titulo || "Sem título",
        autores: p.autores || "—",
        resumo: p.resumo || "",
        palavrasChave: Array.isArray(p.palavrasChave) ? p.palavrasChave : [],
        veiculo: p.veiculo || "",
        nivel: p.nivel || null,
        arquivo: resolveHref(p.arquivo, baseJsonUrl),
      }));
    });

    console.log("[HUB] Total de publicações carregadas:", DATA.length);
  }

  const eixoWrap = document.getElementById("filterEixo");
  const tipoWrap = document.getElementById("filterTipo");
  const yearSelect = document.getElementById("yearSelect");
  const searchEl = document.getElementById("pubSearch");
  const favOnlyBtn = document.getElementById("favOnlyBtn");
  const resultsMeta = document.getElementById("resultsMeta");
  const loadMoreBtn = document.getElementById("loadMoreBtn");

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
    ano: "all",
    q: "",
    favOnly: false,
    limit: PAGE_SIZE,
  };

  const norm = (s) =>
    (s || "")
      .toString()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  function getEixosActive() {
    if (state.eixos.has("all")) return null;
    return state.eixos;
  }

  function matches(item) {
    const active = getEixosActive();
    if (active && !active.has(item.eixo)) return false;

    if (state.tipo !== "all" && item.tipo !== state.tipo) return false;
    if (state.ano !== "all" && String(item.ano) !== String(state.ano))
      return false;

    if (state.favOnly && !favs.has(item.id)) return false;

    const q = norm(state.q).trim();
    if (q) {
      const hay = norm(
        `${item.titulo} ${item.autores} ${item.resumo} ${item.veiculo} ${(item.palavrasChave || []).join(" ")} ${item.eixo} ${item.tipo} ${item.ano}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function badge(item) {
    return `${item.eixo.toUpperCase()} • ${item.tipo.toUpperCase()} • ${item.ano}`;
  }

  function cardHTML(item) {
    const isFav = favs.has(item.id);

    const resumoHTML = item.resumo ? `<p class="pub-resumo">${item.resumo}</p>` : "";
    const veicHTML = item.veiculo ? `<p class="pub-veic">${item.veiculo}</p>` : "";

    return `
      <article class="pub-card" data-id="${item.id}">
        <div class="pub-top">
          <span class="pub-badge">${badge(item)}</span>

          <!-- ⭐ sempre visível; só fica amarela quando is-fav -->
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
          <a class="pub-open" href="${item.arquivo}" target="_blank" rel="noopener">Abrir PDF</a>
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

  function populateYears() {
    const years = Array.from(new Set(DATA.map((d) => d.ano))).sort((a, b) => b - a);
    yearSelect.innerHTML =
      `<option value="all">Todos</option>` +
      years.map((y) => `<option value="${y}">${y}</option>`).join("");
  }

  function render() {
    if (!DATA.length) {
      resultsMeta.textContent = "Mostrando 0 de 0 resultado(s)";
      grid.innerHTML = `
        <div class="no-results">
          Nenhuma publicação foi carregada. <br/>
          Verifique se os arquivos existem em <code>/data/...</code>.
        </div>
      `;
      loadMoreBtn.style.display = "none";
      return;
    }

    const filtered = DATA
      .filter(matches)
      .sort(
        (a, b) => (b.ano - a.ano) || norm(a.titulo).localeCompare(norm(b.titulo))
      );

    const visible = filtered.slice(0, state.limit);

    resultsMeta.textContent = `Mostrando ${visible.length} de ${filtered.length} resultado(s)`;

    grid.innerHTML =
      visible.map(cardHTML).join("") ||
      `<div class="no-results">Nenhuma publicação encontrada com os filtros atuais.</div>`;

    loadMoreBtn.style.display =
      filtered.length > visible.length ? "inline-flex" : "none";

    grid.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".pub-card");
        const id = card.getAttribute("data-id");
        if (!id) return;

        if (favs.has(id)) favs.delete(id);
        else favs.add(id);

        saveFavs(favs);
        state.limit = Math.max(state.limit, PAGE_SIZE);
        render();
      });
    });
  }

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
    state.tipo = btn.getAttribute("data-tipo");
    state.limit = PAGE_SIZE;
    setActiveChips(tipoWrap, "data-tipo", state.tipo);
    render();
  });

  yearSelect.addEventListener("change", () => {
    state.ano = yearSelect.value;
    state.limit = PAGE_SIZE;
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

  loadMoreBtn.addEventListener("click", () => {
    state.limit += PAGE_SIZE;
    render();
  });

  document.querySelectorAll(".diagram.venn [data-id]").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const eixo = el.getAttribute("data-id");
      if (!eixo) return;

      if (state.eixos.has("all")) state.eixos.delete("all");
      if (state.eixos.has(eixo)) state.eixos.delete(eixo);
      else state.eixos.add(eixo);
      if (state.eixos.size === 0) state.eixos.add("all");

      state.limit = PAGE_SIZE;
      syncEixoChipsUI();
      render();

      document.getElementById("pubs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll(".intersection.sc a").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const eixo = "sc";

      if (state.eixos.has("all")) state.eixos.delete("all");
      if (state.eixos.has(eixo)) state.eixos.delete(eixo);
      else state.eixos.add(eixo);
      if (state.eixos.size === 0) state.eixos.add("all");

      state.limit = PAGE_SIZE;
      syncEixoChipsUI();
      render();

      document.getElementById("pubs")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  (async function initHub() {
    await loadPublicacoes();
    populateYears();
    syncEixoChipsUI();
    setActiveChips(tipoWrap, "data-tipo", state.tipo);
    render();
  })();
})();
