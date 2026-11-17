// Applies the saved theme before the first paint to avoid a light/dark flash.
(function () {
  try {
    var s = JSON.parse(localStorage.getItem('fn:prefs') || '{}');
    var t = s.theme || 'auto', h = new Date().getHours();
    var dark = t === 'dark' || (t === 'auto' && (h >= 19 || h < 6)) || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
    if (localStorage.getItem('fn:reduce-motion') === '1') document.documentElement.classList.add('reduce-motion');
  } catch (e) { /* storage unavailable */ }
})();
