/**
 * NIPSCERN — GoatCounter analytics loader
 * Loaded as a classic script from every page in the site.
 *
 * Behavior:
 *   1. Strips ".html" / "/index.html" from the URL bar (cosmetic).
 *   2. Sends a normal pageview for the current path (per-page analytics).
 *   3. Also sends a synthetic pageview for "/" on every non-home page,
 *      so the home counter reflects the TOTAL number of views
 *      across the whole site, not just visits to the landing page.
 */
(function () {
  var l = window.location;

  var clean = l.pathname.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  if (clean !== l.pathname) {
    try { history.replaceState(null, '', clean + l.search + l.hash); } catch (e) {}
  }

  window.goatcounter = window.goatcounter || {};
  window.goatcounter.path = function (p) {
    return p.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '');
  };

  var s = document.createElement('script');
  s.setAttribute('data-goatcounter', 'https://nipscern.goatcounter.com/count');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';

  s.onload = function () {
    var p = window.goatcounter.path(l.pathname);
    if (p !== '/' && typeof window.goatcounter.count === 'function') {
      try { window.goatcounter.count({ path: '/' }); } catch (e) {}
    }
  };

  (document.head || document.documentElement).appendChild(s);
})();
