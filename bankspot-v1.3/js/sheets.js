// 檔案載入、分頁挑選；確保只讀取使用者勾選的分頁
import { normalizeHeaderRow, pickAndFormatRow, parseDateKeyFromUnified, amountToNumber } from './parser.js';
import { escapeHtml } from './utils.js';

export const state = {
  normalizedRows: [], // { vals:[7], dateKey, inAmt, outAmt }
  rawRows: [],        // { data:{},  dateKey, inAmt, outAmt }
};

export async function handleFiles(fileList, onProgress){
  if (!fileList || !fileList.length) return;

  for (const file of fileList) {
    try{
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type:'array' });

      const sheets = Array.isArray(wb.SheetNames) ? wb.SheetNames.filter(Boolean) : [];
      if (!sheets.length) { onProgress?.('skip', file.name); continue; }

      let selectedSheets = [];
      if (sheets.includes('整理總表-更新版')) selectedSheets = ['整理總表-更新版'];
      else if (sheets.length <= 1) selectedSheets = [sheets[0]];
      else selectedSheets = await pickSheetsUI(file.name, sheets);

      if (!selectedSheets || !selectedSheets.length) { onProgress?.('skip', file.name); continue; }

      for (const name of selectedSheets) {
        const ws = wb.Sheets[name]; if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });
        if (!rows || !rows.length) continue;

        const rawHeader = rows[0] || [];
        if (rawHeader.every(cell => String(cell ?? '').trim() === '')) continue;

        const header = normalizeHeaderRow(rawHeader);
        const dataRows = rows.slice(1);

        for (const r of dataRows){
          const everyEmpty = !r || r.every(cell => String(cell ?? '').trim() === '');
          if (everyEmpty) continue;

          const rawObj = {};
          for (let i=0;i<header.length;i++){ const key = header[i] || ''; if (!key) continue; rawObj[key] = r[i]; }

          const uni   = pickAndFormatRow(header, r);
          const dKey  = parseDateKeyFromUnified(uni[1]);
          const inAmt = amountToNumber(uni[4]);
          const outAmt= amountToNumber(uni[3]);

          state.normalizedRows.push({ vals:uni, dateKey:dKey, inAmt:inAmt, outAmt:outAmt });
          state.rawRows.push({ data:rawObj, dateKey:dKey, inAmt:inAmt, outAmt:outAmt });
        }
      }
      onProgress?.('fileDone', file.name);
    }catch(err){
      console.error('handleFiles error:', err);
      onProgress?.('skip', file.name);
    }
  }
}

export function pickSheetsUI(fileName, sheetNames){
  return new Promise((resolve)=>{
    const modal   = document.getElementById('sheetModal');
    const list    = document.getElementById('sheetList');
    const fn      = document.getElementById('sheetFileName');
    const btnAll  = document.getElementById('sheetAll');
    const btnNone = document.getElementById('sheetNone');
    const btnOk   = document.getElementById('sheetOk');
    const btnCancel = document.getElementById('sheetCancel');

    fn.textContent = `檔案：${fileName}`;
    list.innerHTML = '';
    sheetNames.forEach(name=>{
      const lab = document.createElement('label');
      lab.innerHTML = `<input type="checkbox" checked> <span>${escapeHtml(name)}</span>`;
      list.appendChild(lab);
    });

    const collect = () => Array.from(list.querySelectorAll('input[type=checkbox]'))
                          .filter(cb=>cb.checked)
                          .map((cb,i)=> sheetNames[i]);

    function close(ret){
      // 先把焦點移出 modal，再隱藏（避免 aria-hidden 警告）
      (document.body).focus({preventScroll:true});
      document.removeEventListener('keydown', onKey);
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
      resolve(ret);
    }
    function onKey(e){
      if (e.key==='Escape'){ e.preventDefault(); close([]); }
      if (e.key==='Enter'){  e.preventDefault(); close(collect()); }
    }

    btnAll.onclick    = () => list.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=true);
    btnNone.onclick   = () => list.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=false);
    btnCancel.onclick = () => close([]);
    btnOk.onclick     = () => close(collect());

    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    document.addEventListener('keydown', onKey);

    // 入場時，將焦點移到第一個可聚焦元素
    setTimeout(()=>{
      const first = modal.querySelector('button, input, [tabindex]:not([tabindex="-1"])') || modal;
      first.focus({preventScroll:true});
    }, 0);
  });
}
