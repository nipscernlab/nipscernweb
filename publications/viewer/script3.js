// /publications/viewer/script3.js
// =====================================================
// NIPSCERN — VIEWER PDF (PDF.js local)
// - Canvas único (1 página por vez)
// - FitWidth / FitPage com base no container real
// - Preserva scroll no zoom e fit
// - Margens (toggle) ✅
// - Scroll do mouse troca página SÓ quando "passa do limite" ✅
// - Teclas: ←/→, +/-, Home/End, R, F
// =====================================================

// 0) Garantia: PDF.js carregou
if (typeof window.pdfjsLib === "undefined") {
  alert(
    "PDF.js não carregou (pdfjsLib undefined).\n" +
      "Confira se o viewer/index.html está incluindo:\n" +
      "/publications/vendor/pdfjs/pdf.min.js\n" +
      "ANTES do /publications/viewer/script3.js"
  );
  throw new Error("pdfjsLib is not defined");
}

// 1) Worker LOCAL
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "/publications/vendor/pdfjs/pdf.worker.min.js";

(function initViewer() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initViewer, { once: true });
    return;
  }

  const $ = (id) => document.getElementById(id);

  // Canvas
  const canvas = $("pdfCanvas");
  if (!canvas) {
    console.error("[VIEWER] #pdfCanvas não existe.");
    return;
  }
  const ctx = canvas.getContext("2d");

  // Shell (scroll interno)
  const shell = $("pdfShell") || canvas.closest(".pdf-shell");
  function getScroller() {
    return shell || document.scrollingElement || document.documentElement;
  }

  // Controles (IDs do seu HTML)
  const pdfTitle = $("pdfTitle");
  const pageNumber = $("pageNumber");
  const pageCount = $("pageCount");

  const btnMargins = $("toggleMargins");
  const paperEl = $("pdfPaper") || canvas.closest(".pdf-paper");

  const zoomIn = $("zoomIn");
  const zoomOut = $("zoomOut");

  const btnPrev = $("prevPage");
  const btnNext = $("nextPage");
  const btnFirst = $("firstPage");
  const btnLast = $("lastPage");

  const btnFitWidth = $("fitWidth");
  const btnFitPage = $("fitPage");

  const btnRotate = $("rotate");

  // ✅ alinhados ao seu HTML
  const btnTheme = $("themeToggle");
  const btnFull = $("btnFullscreen");
  const btnOpen = $("btnOpen");
  const btnPrint = $("btnPrint");

  const dl = $("pdfDownload");

  // Toast simples (debug)
  const uiMsg = document.createElement("div");
  uiMsg.style.position = "fixed";
  uiMsg.style.left = "16px";
  uiMsg.style.bottom = "16px";
  uiMsg.style.maxWidth = "min(780px, 92vw)";
  uiMsg.style.padding = "10px 12px";
  uiMsg.style.borderRadius = "12px";
  uiMsg.style.border = "1px solid rgba(255,255,255,.18)";
  uiMsg.style.background = "rgba(10,10,30,.75)";
  uiMsg.style.backdropFilter = "blur(10px)";
  uiMsg.style.color = "#e9ecff";
  uiMsg.style.fontFamily = `"Space Grotesk", system-ui, sans-serif`;
  uiMsg.style.fontSize = "13px";
  uiMsg.style.display = "none";
  uiMsg.style.zIndex = "9999";
  document.body.appendChild(uiMsg);

  function showMsg(html) {
    uiMsg.innerHTML = html;
    uiMsg.style.display = "block";
  }
  function hideMsg() {
    uiMsg.style.display = "none";
  }

  // ==========
  // Preserve scroll (no container certo)
  // ==========
  async function preserveScroll(asyncWork) {
    const scroller = getScroller();
    const y = scroller.scrollTop;
    const h = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    const ratio = h ? y / h : 0;

    await asyncWork();
    await new Promise((r) => requestAnimationFrame(r));

    const h2 = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    scroller.scrollTop = ratio * h2;
  }

  // ==========
  // Pega o PDF vindo do HUB: ?file=/publications/...
  // ==========
  const params = new URLSearchParams(location.search);
  const file = params.get("file");

  if (!file) {
    if (pdfTitle) pdfTitle.textContent = "PDF não informado";
    showMsg(`❌ Faltou o parâmetro <code>?file=</code> na URL.`);
    return;
  }

  // Título “revista”
  function formatTitleFromFile(path) {
    const raw = path.split("/").pop() || "Documento";
    const clean = raw.replace(/\.pdf$/i, "");
    const spaced = clean.replace(/[-_]/g, " ");

    // opcional: remove tokens muito técnicos do final (tcc/mestrado/etc) se quiser:
    // return spaced.replace(/\b(pdf|final|versao|v\d+)\b/gi, "").trim()

    return spaced
      .split(" ")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  if (pdfTitle) pdfTitle.textContent = formatTitleFromFile(file);
  if (dl) dl.href = file;

  // ==========
  // Estado do viewer
  // ==========
  let pdfDoc = null;
  let pageNum = Number(pageNumber?.value || 1) || 1;

  let scale = 1.0;
  let rotation = 0;
  let rendering = false;

  let scaleMode = "fitPage"; // manual | fitWidth | fitPage

  // ==========
  // Fit scale baseado no shell real (PDF maior)
  // ==========
  function getFitBox() {
    const box = shell || document.body;
    const rect = box.getBoundingClientRect();

    // margens bem pequenas (pra PDF ficar grande)
    const padX = 24;
    const padY = 18;

    return {
      width: Math.max(220, rect.width - padX),
      height: Math.max(220, rect.height - padY),
    };
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function computeFitScale(page, mode) {
    const base = page.getViewport({ scale: 1, rotation });
    const box = getFitBox();

    const sW = box.width / base.width;
    const sH = box.height / base.height;

    if (mode === "fitWidth") return clamp(sW, 0.3, 6);

    // leve boost pra “encher” mais a tela
    return clamp(Math.min(sW, sH) * 1.06, 0.3, 6);
  }

  // ==========
  // Render
  // ==========
  async function renderPage(num) {
    if (!pdfDoc || rendering) return;
    rendering = true;

    try {
      const page = await pdfDoc.getPage(num);

      if (scaleMode === "fitWidth" || scaleMode === "fitPage") {
        scale = computeFitScale(page, scaleMode);
      }

      const viewport = page.getViewport({ scale, rotation });

      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // papel branco
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      await page.render({ canvasContext: ctx, viewport }).promise;

      if (pageNumber) pageNumber.value = String(num);
      if (pageCount) pageCount.textContent = `/ ${pdfDoc.numPages}`;

      hideMsg();
    } catch (err) {
      console.error("[VIEWER] renderPage error:", err);
      showMsg(`❌ Erro ao renderizar: <code>${String(err.message || err)}</code>`);
    } finally {
      rendering = false;
    }
  }

  async function goTo(n, { snapTop = true } = {}) {
    if (!pdfDoc) return;
    const max = pdfDoc.numPages;
    const nn = Math.min(Math.max(1, Number(n) || 1), max);
    pageNum = nn;

    await renderPage(pageNum);
    if (snapTop) getScroller().scrollTop = 0;
  }

  // ==========
  // Load
  // ==========
  async function loadPdf() {
    try {
      showMsg(`⏳ Carregando… <code>${file}</code>`);

      const task = pdfjsLib.getDocument({
        url: file,
        disableRange: true,
        disableStream: true,
      });

      pdfDoc = await task.promise;

      if (pageCount) pageCount.textContent = `/ ${pdfDoc.numPages}`;
      if (pageNumber) {
        pageNumber.min = "1";
        pageNumber.max = String(pdfDoc.numPages);
        pageNumber.value = String(pageNum);
      }

      scaleMode = "fitPage";
      await renderPage(pageNum);
      hideMsg();
    } catch (err) {
      console.error("[VIEWER] loadPdf error:", err);
      showMsg(`
        ❌ Não consegui carregar esse PDF no viewer.<br>
        <div style="margin-top:8px;">
          <a href="${file}" target="_blank" rel="noopener"
             style="display:inline-block; padding:8px 10px; border-radius:10px;
                    border:1px solid rgba(255,255,255,.18); color:#e9ecff; text-decoration:none;
                    background:rgba(10,10,30,.55);">
            Abrir PDF direto
          </a>
          <span style="opacity:.75; margin-left:10px;">
            Erro: <code>${String(err.message || err)}</code>
          </span>
        </div>
      `);
    }
  }

  // ==========
  // Botões
  // ==========
  zoomIn?.addEventListener("click", async () => {
    await preserveScroll(async () => {
      scaleMode = "manual";
      scale = Math.min(6, scale + 0.12);
      await renderPage(pageNum);
    });
  });

  zoomOut?.addEventListener("click", async () => {
    await preserveScroll(async () => {
      scaleMode = "manual";
      scale = Math.max(0.2, scale - 0.12);
      await renderPage(pageNum);
    });
  });

  pageNumber?.addEventListener("change", async () => {
    await goTo(pageNumber.value, { snapTop: false });
  });

  btnPrev?.addEventListener("click", async () => goTo(pageNum - 1));
  btnNext?.addEventListener("click", async () => goTo(pageNum + 1));
  btnFirst?.addEventListener("click", async () => goTo(1));
  btnLast?.addEventListener("click", async () => goTo(pdfDoc?.numPages || 1));

  btnFitWidth?.addEventListener("click", async () => {
    await preserveScroll(async () => {
      scaleMode = "fitWidth";
      await renderPage(pageNum);
    });
  });

  btnFitPage?.addEventListener("click", async () => {
    await preserveScroll(async () => {
      scaleMode = "fitPage";
      await renderPage(pageNum);
    });
  });

  btnRotate?.addEventListener("click", async () => {
    await preserveScroll(async () => {
      rotation = (rotation + 90) % 360;
      await renderPage(pageNum);
    });
  });

  btnMargins?.addEventListener("click", () => {
    if (!paperEl) return;
    paperEl.classList.toggle("margins-off");
  });

  btnTheme?.addEventListener("click", () => {
    document.body.classList.toggle("viewer-dark");
    document.body.classList.toggle("viewer-light");
  });

  btnFull?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("[VIEWER] fullscreen falhou:", e);
    }
  });

  btnOpen?.addEventListener("click", () => {
    window.open(file, "_blank", "noopener");
  });

  btnPrint?.addEventListener("click", () => {
    const w = window.open(file, "_blank", "noopener");
    if (!w) return;
    const t = setInterval(() => {
      try {
        if (w.document && w.document.readyState === "complete") {
          clearInterval(t);
          w.focus();
          w.print();
        }
      } catch (_) {
        clearInterval(t);
      }
    }, 250);
    setTimeout(() => clearInterval(t), 6000);
  });

  // ==========
  // Scroll do mouse → troca página só se insistir no limite
  // ==========
  let wheelLock = false;
  let wheelAccum = 0;

  const EDGE = 14;
  const TRIGGER = 220;

  getScroller().addEventListener(
    "wheel",
    async (e) => {
      if (!pdfDoc) return;
      if (e.ctrlKey) return;
      if (wheelLock) return;

      const scroller = getScroller();
      const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const pos = scroller.scrollTop;

      const atTop = pos <= EDGE;
      const atBottom = pos >= (maxScroll - EDGE);

      // se ainda tem leitura/scroll, deixa rolar normal
      if (!atTop && !atBottom) {
        wheelAccum = 0;
        return;
      }

      wheelAccum += e.deltaY;

      // topo + scroll down => quer ler, não virar
      if (atTop && e.deltaY > 0) { wheelAccum = 0; return; }
      // fundo + scroll up => quer voltar um pouco
      if (atBottom && e.deltaY < 0) { wheelAccum = 0; return; }

      if (atBottom && wheelAccum > TRIGGER) {
        e.preventDefault();
        wheelLock = true;
        wheelAccum = 0;
        await goTo(pageNum + 1);
        setTimeout(() => (wheelLock = false), 280);
      } else if (atTop && wheelAccum < -TRIGGER) {
        e.preventDefault();
        wheelLock = true;
        wheelAccum = 0;
        await goTo(pageNum - 1);
        setTimeout(() => (wheelLock = false), 280);
      }
    },
    { passive: false }
  );

  // ==========
  // Teclado
  // ==========
  window.addEventListener("keydown", async (e) => {
    if (!pdfDoc) return;

    const active = document.activeElement;
    const isTyping =
      active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA");
    if (isTyping) return;

    if (e.key === "ArrowRight") { e.preventDefault(); await goTo(pageNum + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); await goTo(pageNum - 1); }
    else if (e.key === "Home") { e.preventDefault(); await goTo(1); }
    else if (e.key === "End") { e.preventDefault(); await goTo(pdfDoc.numPages); }
    else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      scaleMode = "manual";
      scale = Math.min(6, scale + 0.12);
      await renderPage(pageNum);
    } else if (e.key === "-" || e.key === "_") {
      e.preventDefault();
      scaleMode = "manual";
      scale = Math.max(0.2, scale - 0.12);
      await renderPage(pageNum);
    } else if (e.key.toLowerCase() === "r") {
      e.preventDefault();
      rotation = (rotation + 90) % 360;
      await renderPage(pageNum);
    } else if (e.key.toLowerCase() === "f") {
      e.preventDefault();
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) {}
    }
  });

  // Resize
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderPage(pageNum);
    }, 140);
  });

  loadPdf();
})();
