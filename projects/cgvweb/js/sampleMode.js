export function setupSampleMode({
  advanceProgress,
  endProgress,
  esc,
  processXml,
  setStatus,
  startProgress,
  t,
}) {
  let sampleLoaded = false;

  async function loadSampleIndex() {
    if (sampleLoaded) return;
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
      if (!names.length) {
        msgEl.textContent = t('sample-empty');
        msgEl.hidden = false;
        return;
      }

      names.forEach(name => {
        const btn = document.createElement('button');
        btn.className = 'sample-item';
        btn.innerHTML = `<svg class="ic sample-item-icon" style="width:11px;height:11px"><use href="#i-star"/></svg><span class="sample-item-name">${esc(name)}</span>`;
        btn.addEventListener('click', async () => {
          document.querySelectorAll('.sample-item.cur').forEach(b => b.classList.remove('cur'));
          btn.classList.add('cur');
          setStatus('Loading sample…');
          startProgress();
          advanceProgress('request');
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
            btn.classList.remove('cur');
          }
        });
        listEl.appendChild(btn);
      });

      sampleLoaded = true;
    } catch (_) {
      msgEl.textContent = t('sample-error');
      msgEl.hidden = false;
    }
  }

  return { loadSampleIndex };
}
