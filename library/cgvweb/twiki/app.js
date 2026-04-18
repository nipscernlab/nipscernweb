import { twikiToHtml } from "./twiki-parser.js";

const TOPICS = [
  ["WebHome",          "Home"],
  ["Overview",         "Overview"],
  ["GettingStarted",   "Getting Started"],
  ["UserInterface",    "User Interface"],
  ["DataModes",        "Data Modes"],
  ["EnergyThresholds", "Energy Thresholds"],
  ["Geometry",         "Geometry"],
  ["EventData",        "Event Data"],
  ["KeyboardShortcuts","Keyboard Shortcuts"],
  ["Developers",       "Developers"],
  ["Troubleshooting",  "Troubleshooting"],
  ["Glossary",         "Glossary"],
  ["References",       "References"],
];

const sidebar  = document.getElementById("sidebar-nav");
const main     = document.getElementById("topic-body");
const trailEl  = document.getElementById("trail");
const searchIn = document.getElementById("search");
const tocHost  = document.getElementById("toc-host");

function renderSidebar(active) {
  sidebar.innerHTML = TOPICS.map(([t, label]) =>
    `<li><a href="#/${t}" class="${t === active ? "active" : ""}" data-topic="${t}">${label}</a></li>`
  ).join("");
}

async function loadTopic(topic) {
  renderSidebar(topic);
  const label = (TOPICS.find(([t]) => t === topic) || [null, topic])[1];
  trailEl.innerHTML = `<a href="#/WebHome">ATLAS</a> &rsaquo; <a href="#/WebHome">CGV Web</a> &rsaquo; <span>${label}</span>`;
  document.title = `${label} · CGV Web TWiki`;
  try {
    const res = await fetch(`${topic}.twiki`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const src = await res.text();
    main.innerHTML = twikiToHtml(src);
    const toc = main.querySelector("nav.twiki-toc");
    if (tocHost) {
      tocHost.innerHTML = "";
      if (toc) tocHost.appendChild(toc);
    }
    main.scrollTop = 0;
    window.scrollTo(0, 0);
  } catch (e) {
    main.innerHTML = `<div class="err">Could not load <code>${topic}.twiki</code>: ${e.message}.<br/>
      Serve the folder via <code>python -m http.server</code> and reload.</div>`;
  }
}

let currentTopic = null;

function topicFromHash() {
  const m = (location.hash || "").match(/^#\/([A-Za-z0-9_\-]+)/);
  return m ? m[1] : null;
}

window.addEventListener("DOMContentLoaded", () => {
  const topic = topicFromHash() || "WebHome";
  currentTopic = topic;
  loadTopic(topic);
});

window.addEventListener("hashchange", () => {
  const topic = topicFromHash();
  if (topic === null) return;              // plain anchor click — let browser scroll
  if (topic === currentTopic) return;      // same topic — no-op
  currentTopic = topic;
  loadTopic(topic);
});

searchIn?.addEventListener("input", () => {
  const q = searchIn.value.trim().toLowerCase();
  sidebar.querySelectorAll("a").forEach((a) => {
    a.style.display = !q || a.textContent.toLowerCase().includes(q) ? "" : "none";
  });
});
