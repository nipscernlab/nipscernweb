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

    // meteoro esquerda -> direita
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

    // Favoritos (persistência)
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

    // Estado
    let lista = [];
    let tipoAtual = "todos"; // todos | favoritos | congresso | revista | tese
    let nivelAtual = ""; // tcc | mestrado | doutorado | ""
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

        // filtro tipo
        if (tipoAtual === "favoritos" && !isFav) return false;
        if (tipoAtual !== "todos" && tipoAtual !== "favoritos") {
          if (tipo !== tipoAtual) return false;
        }

        // filtro nível (só em tese)
        if (nivelAtual) {
          if (tipo !== "tese") return false;
          if (nivel !== nivelAtual) return false;
        }

        // busca
        if (!matchesBusca(pub, termoBusca)) return false;

        return true;
      });

      container.innerHTML = "";
      filtradas.forEach((pub) => container.appendChild(criarCard(pub)));
      setCount(filtradas.length);
    }

    function initUI() {
      // ✅ ESTADO INICIAL (o que estava faltando):
      // Subfiltros começam SEMPRE escondidos
      mostrarSubfiltros(false);

      // Tipo (Todos / Favoritos / Congresso / Revista / Tese)
      btnTipo.forEach((btn) => {
        btn.addEventListener("click", () => {
          tipoAtual = btn.getAttribute("data-filter-tipo") || "todos";

          // subfiltros só em tese
          mostrarSubfiltros(tipoAtual === "tese");

          // se saiu de tese, zera nível
          if (tipoAtual !== "tese") nivelAtual = "";

          marcarAtivoTipo(btn);
          aplicarFiltros();
        });
      });

      // Nível (TCC / Mestrado / Doutorado)
      btnNivel.forEach((btn) => {
        btn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          nivelAtual = btn.getAttribute("data-filter-nivel") || "";

          // força tese ativa
          tipoAtual = "tese";
          mostrarSubfiltros(true);

          const btnTese = document.querySelector('[data-filter-tipo="tese"]');
          marcarAtivoTipo(btnTese);
          marcarAtivoNivel(btn);

          aplicarFiltros();
        });
      });

      // Busca
      if (searchEl) {
        searchEl.addEventListener("input", () => {
          termoBusca = (searchEl.value || "").trim();
          aplicarFiltros();
        });
      }

      // Voltar
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

        // ✅ garante que, ao carregar, continua escondido até clicar em TESE
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

// =========================================
// Anos — animação de entrada em TODOS os botões
// =========================================
(function () {
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  // Troque o seletor se necessário
  const yearButtons = Array.from(document.querySelectorAll(".year-btn"));
  if (!yearButtons.length) return;

  // garante que todos comecem "fora"
  yearButtons.forEach((btn) => btn.classList.remove("is-in"));

  // entrada com stagger (efeito cascata)
  yearButtons.forEach((btn, i) => {
    if (reduceMotion) {
      btn.classList.add("is-in");
      return;
    }
    setTimeout(() => btn.classList.add("is-in"), 60 + i * 55);
  });
})();


// =========================================
// ANOS — aplica animação/ glow em TODOS (sem depender de classe)
// Marca automaticamente itens com texto "####" (ex: 2001, 2025)
// =========================================
(function () {
  const reduceMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

  // pega links/botoes/divs clicáveis comuns
  const candidates = Array.from(
    document.querySelectorAll("a, button, .year, .card, .chip, .pill, div, li")
  );

  // filtra quem parece "um ano"
  const years = candidates.filter((el) => {
    const t = (el.textContent || "").trim();
    // exatamente 4 dígitos e dentro de um range plausível
    if (!/^\d{4}$/.test(t)) return false;
    const y = Number(t);
    return y >= 1900 && y <= 2100;
  });

  if (!years.length) {
    console.warn("[NIPSCERN] Não encontrei itens de ano (####) para animar.");
    return;
  }

  // marca e anima em cascata
  years.forEach((el, i) => {
    const y = (el.textContent || "").trim();
    el.setAttribute("data-year", y);

    el.classList.remove("is-in");

    if (reduceMotion) {
      el.classList.add("is-in");
    } else {
      el.style.setProperty("--in-delay", `${60 + i * 55}ms`);
      // requestAnimationFrame garante que o browser aplique o estado inicial antes do "is-in"
      requestAnimationFrame(() => el.classList.add("is-in"));
    }
  });

  console.log("[NIPSCERN] Animação aplicada em", years.length, "anos.");
})();


