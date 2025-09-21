// js/utils.js
// 共用小工具（避免動態 RegExp 錯誤、HTML 轉義、簡易編碼修復、清單拖曳）

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[m]);
}

// ✅ 正確且唯一的安全跳脫：方括號與反斜線都在字元類別中
export function escapeRegExp(s = '') {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countCJK(str = '') {
  return (String(str).match(/[\u4E00-\u9FFF]/g) || []).length;
}

function tryDecodeLatin1ToUTF8(s){ try { return decodeURIComponent(escape(s)); } catch { return s; } }
function tryEncodeUTF8ToLatin1(s){ try { return unescape(encodeURIComponent(s)); } catch { return s; } }

export function fixEncoding(s = '') {
  const a = String(s);
  const b = tryDecodeLatin1ToUTF8(a);
  const c = tryEncodeUTF8ToLatin1(a);
  const cand = [a, b, c];
  cand.sort((x, y) =>
    countCJK(y) - countCJK(x) ||
    Math.abs(y.length - a.length) - Math.abs(x.length - a.length)
  );
  return cand[0];
}

// 欄位挑選器的拖曳排序（統一欄位／來源欄位共用）
export function bindColDrag(container) {
  let dragging = null;
  container.querySelectorAll('.col-item').forEach(it => {
    it.addEventListener('dragstart', () => {
      dragging = it;
      it.classList.add('dragging');
    });
    it.addEventListener('dragend', () => {
      it.classList.remove('dragging');
      dragging = null;
    });
    it.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = it;
      if (!dragging || dragging === target) return;
      const rect = target.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) target.parentNode.insertBefore(dragging, target);
      else        target.parentNode.insertBefore(dragging, target.nextSibling);
      target.classList.add('dragover');
    });
    it.addEventListener('dragleave', () => it.classList.remove('dragover'));
    it.addEventListener('drop',      () => it.classList.remove('dragover'));
  });
}
