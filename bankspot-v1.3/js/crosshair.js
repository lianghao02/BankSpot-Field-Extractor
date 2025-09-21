// js/crosshair.js
// 十字準星：滑鼠所在的列與欄同步高亮
export function bindCrosshair(tbody = document.getElementById('tbody')) {
  if (!tbody) return;

  let lastRow = null;
  let lastCol = -1;
  let raf = null;

  // 事先快取一個清除函式
  function clear() {
    if (lastRow) lastRow.classList.remove('hl-row');
    if (lastCol >= 0) {
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(tr => {
        const td = tr.children[lastCol];
        if (td) td.classList.remove('hl-col');
      });
    }
    lastRow = null;
    lastCol = -1;
  }

  function highlight(targetTd) {
    // 清掉舊的
    if (lastRow && lastRow !== targetTd.parentElement) {
      lastRow.classList.remove('hl-row');
    }
    if (lastCol !== -1) {
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(tr => {
        const td = tr.children[lastCol];
        if (td) td.classList.remove('hl-col');
      });
    }

    // 標上新的
    const tr = targetTd.parentElement;
    tr.classList.add('hl-row');

    const colIndex = Array.prototype.indexOf.call(tr.children, targetTd);
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(r => {
      const td = r.children[colIndex];
      if (td) td.classList.add('hl-col');
    });

    lastRow = tr;
    lastCol = colIndex;
  }

  // 用 rAF 降低大量 mousemove 的重繪壓力
  function scheduleHighlight(td) {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => highlight(td));
  }

  tbody.addEventListener('mousemove', (e) => {
    const td = e.target.closest('td');
    if (!td || !tbody.contains(td)) return;
    scheduleHighlight(td);
  });

  // 離開表格就清除
  tbody.addEventListener('mouseleave', () => {
    if (raf) cancelAnimationFrame(raf);
    clear();
  });

  // 若內容整批重繪，保留綁定即可；tbody 元素本身沒變
}
