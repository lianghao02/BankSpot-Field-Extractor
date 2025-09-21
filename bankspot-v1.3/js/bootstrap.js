// js/bootstrap.js
(async function boot() {
  try {
    await ensureXLSX();
    console.log('[boot] XLSX ready:', !!window.XLSX);
  } catch (e) {
    console.error('[boot] XLSX load failed', e);
    alert('無法載入 Excel 解析庫（xlsx.full.min.js）。\n請確認已把檔案放在 js/lib/ 下，或暫時連網讓 CDN 可用。');
    return;
  }

  try {
    // 加上版本參數強制瀏覽器抓新檔，避免舊版 parser.js 被快取
    await import('./main.js?v=1.3.1');
    console.log('[boot] main.js loaded');
  } catch (e) {
    console.error('[boot] fail to import main.js', e);
    alert('主程式載入失敗，請打開主控台(DevTools)查看錯誤訊息。');
  }
})();

function ensureXLSX() {
  if (window.XLSX) return Promise.resolve();

  const tryLocal = loadScript('js/lib/xlsx.full.min.js')
    .then(() => { if (!window.XLSX) throw new Error('Local XLSX loaded but window.XLSX is undefined'); });

  const tryCdn = () => loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js')
    .then(() => { if (!window.XLSX) throw new Error('CDN XLSX loaded but window.XLSX is undefined'); });

  return tryLocal.catch(err => {
    console.warn('[XLSX] local not found, fallback to CDN…', err);
    return tryCdn();
  });
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('fail to load: ' + src));
    document.head.appendChild(s);
  });
}
