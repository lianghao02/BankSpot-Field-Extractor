// js/main.js －－ 完整覆蓋版
import { handleFiles, state } from './sheets.js';
import { OUTPUT_HEADERS, formatROCDateSafe, formatTimeSafe, formatAmountStandard } from './parser.js';
import { exportCSV } from './export.js';
import { fixEncoding, bindColDrag } from './utils.js';
import { view, els, renderHead, renderTable, getDisplayRows, getDisplayHeaders } from './table.js';
import { bindSelection } from './selection.js';
import { bindCrosshair } from './crosshair.js';


// ===== 來源欄位模式：型別推論（關鍵：把「餘額」也視為金額） =====
function inferTypeByHeader(key, v){
  const s = String(key);
  if (s.includes('日期')) return formatROCDateSafe(v);
  if (s.includes('時間')) return formatTimeSafe(v);
  if (s.includes('金額') || s.includes('餘額')) return formatAmountStandard(v);
  return v == null ? '' : String(v);
}

// ===== UI 參照 =====
const elFile = document.getElementById('file');
const elDrop = document.getElementById('drop');
const elBtnExport = document.getElementById('btn-export');
const elBtnClear  = document.getElementById('btn-clear');
const elBtnCopy   = document.getElementById('btn-copy');
const elBtnCols   = document.getElementById('btn-cols');
const elBtnRawCols= document.getElementById('btn-raw-cols');

// ===== 模式切換 =====
Array.from(document.querySelectorAll('#modeSeg .seg')).forEach(seg=>{
  seg.addEventListener('click', ()=>{
    document.querySelectorAll('#modeSeg .seg').forEach(s=>s.classList.remove('active'));
    seg.classList.add('active');
    view.mode = seg.dataset.mode;
    els.modeChip.textContent = '模式：' + (view.mode==='normalized'?'統一欄位':'來源欄位');
    elBtnCols.style.display    = (view.mode==='normalized') ? '' : 'none';
    elBtnRawCols.style.display = (view.mode==='raw') ? '' : 'none';
    draw();
  });
});

// ===== 檔案載入（input + 拖曳） =====
elFile.addEventListener('change', async (e)=>{ await handleFiles(e.target.files, onProgress); e.target.value=''; draw(); });
['dragenter','dragover'].forEach(t => elDrop.addEventListener(t, (e)=>{ e.preventDefault(); e.stopPropagation(); elDrop.classList.add('dragover'); }));
['dragleave','drop'].forEach(t => elDrop.addEventListener(t, (e)=>{ e.preventDefault(); e.stopPropagation(); elDrop.classList.remove('dragover'); }));
elDrop.addEventListener('drop', async (e)=>{ await handleFiles(e.dataTransfer.files, onProgress); draw(); });

function onProgress(type, fileName){
  const elFileCount = document.getElementById('file-count');
  if (type==='skip')     elFileCount.textContent = `略過：${fileName}`;
  if (type==='fileDone') elFileCount.textContent = `已處理：${fileName}`;
}

// ===== 清空 =====
elBtnClear.addEventListener('click', ()=>{
  state.normalizedRows.length = 0;
  state.rawRows.length = 0;
  view.rawSelectedHeaders = [];
  els.tbody.innerHTML = '';
  elBtnExport.disabled = true;
  elBtnCopy.disabled = true;
  document.getElementById('file-count').textContent = '未載入檔案';
  document.getElementById('row-count').textContent = '0 筆資料';
  renderHead([]);
});

// ===== 匯出 =====
elBtnExport.addEventListener('click', ()=>{
  exportCSV(getDisplayRows(state, (k,v)=>inferTypeByHeader(k,v)), getDisplayHeaders([]));
});

// ===== 日期篩選 =====
document.getElementById('btn-apply-date').onclick = ()=>{
  const f = document.getElementById('dateFrom').value ? Number(document.getElementById('dateFrom').value.replace(/-/g,'')) : null;
  const t = document.getElementById('dateTo').value   ? Number(document.getElementById('dateTo').value.replace(/-/g,''))   : null;
  view.filterFrom = f; view.filterTo = t; draw();
};
document.getElementById('btn-reset-date').onclick = ()=>{
  document.getElementById('dateFrom').value=''; document.getElementById('dateTo').value='';
  view.filterFrom=null; view.filterTo=null; draw();
};

// ===== 統一欄位挑選器 =====
const colModal   = document.getElementById('colModal');
const colList    = document.getElementById('colList');
const colApply   = document.getElementById('colApply');
const colCancel  = document.getElementById('colCancel');
const colReset   = document.getElementById('colReset');
const colSearch  = document.getElementById('colSearch');

document.getElementById('btn-cols').addEventListener('click', ()=>{
  rebuildColList(); showModal(colModal);
});
function rebuildColList(){
  const q = (colSearch.value||'').trim();
  colList.innerHTML = '';
  const order = [...view.visibleCols];
  order.forEach(idx=>{
    const name = OUTPUT_HEADERS[idx];
    if (q && !name.includes(q)) return;
    const item = document.createElement('div');
    item.className = 'col-item'; item.draggable = true; item.dataset.idx = String(idx);
    item.innerHTML = `<span class="drag-handle"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6h6M9 10h6M9 14h6M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      <input type="checkbox" ${view.colEnabled[idx]?'checked':''} />
      <strong>${name}</strong>`;
    colList.appendChild(item);
  });
  bindColDrag(colList);
}
colSearch.addEventListener('input', rebuildColList);
colApply.addEventListener('click', ()=>{
  const items = Array.from(colList.querySelectorAll('.col-item'));
  const newOrder = items.map(it => parseInt(it.dataset.idx,10));
  const newEnabled = items.map(it => it.querySelector('input[type=checkbox]').checked);
  if (!newEnabled.some(Boolean)){ alert('請至少選擇 1 個欄位顯示。'); return; }
  view.visibleCols = newOrder; view.colEnabled  = newEnabled; hideModal(colModal); draw();
});
colCancel.addEventListener('click', ()=> hideModal(colModal));
colReset.addEventListener('click', ()=>{ view.visibleCols = OUTPUT_HEADERS.map((_,i)=>i); view.colEnabled = OUTPUT_HEADERS.map(()=>true); rebuildColList(); });
Array.from(document.querySelectorAll('#colModal .tag')).forEach(tag=>{
  tag.addEventListener('click', ()=>{
    const preset = tag.dataset.preset;
    if (preset==='all')   view.colEnabled = OUTPUT_HEADERS.map(()=>true);
    if (preset==='none')  view.colEnabled = OUTPUT_HEADERS.map(()=>false);
    if (preset==='common')view.colEnabled = OUTPUT_HEADERS.map(h=> ['帳號','交易日期','交易時間','支出金額','存入金額'].includes(h));
    if (preset==='basic') view.colEnabled = OUTPUT_HEADERS.map(h=> h!=='提款地點');
    rebuildColList();
  });
});

// ===== 來源欄位挑選器 =====
const rawColModal   = document.getElementById('rawColModal');
const rawColList    = document.getElementById('rawColList');
const rawColApply   = document.getElementById('rawColApply');
const rawColCancel  = document.getElementById('rawColCancel');
const rawColSearch  = document.getElementById('rawColSearch');

document.getElementById('btn-raw-cols').addEventListener('click', ()=>{
  rebuildRawColList(); showModal(rawColModal);
});

function getRawHeadersUniverse(){
  const set = new Set();
  for (const r of state.rawRows){
    for (const k of Object.keys(r.data)){
      if (k && String(k).trim()) set.add(String(k).trim());
    }
  }
  return Array.from(set);
}
function rebuildRawColList(){
  const q = (rawColSearch.value||'').trim();
  const universe = getRawHeadersUniverse();
  const inSet = new Set(view.rawSelectedHeaders);
  rawColList.innerHTML = '';
  // 已選
  view.rawSelectedHeaders.forEach(h=>{
    const label = fixEncoding(h); if (q && !label.includes(q)) return;
    const item = document.createElement('div'); item.className='col-item'; item.draggable = true; item.dataset.key = h;
    item.innerHTML = rowItemHTML(label, true); rawColList.appendChild(item);
  });
  // 未選
  universe.filter(h=>!inSet.has(h)).forEach(h=>{
    const label = fixEncoding(h); if (q && !label.includes(q)) return;
    const item = document.createElement('div'); item.className='col-item'; item.draggable = true; item.dataset.key = h;
    item.innerHTML = rowItemHTML(label, false); rawColList.appendChild(item);
  });
  bindColDrag(rawColList);
}
function rowItemHTML(label, checked){
  return `<span class="drag-handle"><svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6h6M9 10h6M9 14h6M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      <input type="checkbox" ${checked?'checked':''} />
      <strong>${label}</strong>`;
}
rawColSearch.addEventListener('input', rebuildRawColList);
rawColApply.addEventListener('click', ()=>{
  const items = Array.from(rawColList.querySelectorAll('.col-item'));
  const keys  = items.map(it => it.dataset.key);
  const flags = items.map(it => it.querySelector('input[type=checkbox]').checked);
  view.rawSelectedHeaders = keys.filter((_,i)=>flags[i]);
  hideModal(rawColModal); draw();
});
rawColCancel.addEventListener('click', ()=> hideModal(rawColModal));
Array.from(document.querySelectorAll('#rawColModal .tag')).forEach(tag=>{
  tag.addEventListener('click', ()=>{
    const preset = tag.dataset.preset;
    const universe = getRawHeadersUniverse();
    if (preset==='all')      view.rawSelectedHeaders = universe.slice();
    if (preset==='none')     view.rawSelectedHeaders = [];
    if (preset==='money')    view.rawSelectedHeaders = universe.filter(h => h.includes('金額') || h.includes('餘額'));
    if (preset==='datetime') view.rawSelectedHeaders = universe.filter(h => h.includes('日期') || h.includes('時間'));
    rebuildRawColList();
  });
});

// ====== 排序（修復：每次 draw() 後重綁） ======
function attachSortHandlers(){
  const ths = document.querySelectorAll('#thead-row th');
  ths.forEach((th) => {
    th.classList.remove('sort-asc','sort-desc','sort-active');
    th.addEventListener('click', (e) => {
      if (e.target.closest('.drag-handle')) return;

      if (view.mode==='normalized'){
        const internalCol = parseInt(th.dataset.col,10);
        if (view.currentSort.col === internalCol){ view.currentSort.dir = -view.currentSort.dir; }
        else { view.currentSort.col = internalCol; view.currentSort.rawKey = null; view.currentSort.dir = 1; }
        sortNormalized(internalCol, view.currentSort.dir);
        updateSortIndicatorsNormalized(internalCol, view.currentSort.dir);
      } else {
        const key = th.dataset.key;
        if (view.currentSort.rawKey === key){ view.currentSort.dir = -view.currentSort.dir; }
        else { view.currentSort.rawKey = key; view.currentSort.col = null; view.currentSort.dir = 1; }
        sortRawByKey(key, view.currentSort.dir);
        updateSortIndicatorsRaw(key, view.currentSort.dir);
      }
    });
  });
}
function updateSortIndicatorsNormalized(activeInternalCol, dir){
  const ths = document.querySelectorAll('#thead-row th');
  ths.forEach((th)=>{ th.classList.remove('sort-asc','sort-desc','sort-active');
    if (parseInt(th.dataset.col,10) === activeInternalCol) th.classList.add('sort-active', dir===1?'sort-asc':'sort-desc'); });
}
function updateSortIndicatorsRaw(activeKey, dir){
  const ths = document.querySelectorAll('#thead-row th');
  ths.forEach((th)=>{ th.classList.remove('sort-asc','sort-desc','sort-active');
    if (th.dataset.key === activeKey) th.classList.add('sort-active', dir===1?'sort-asc':'sort-desc'); });
}
function makeKeyForNormalized(s,colIdx){
  s = String(s||'').trim();
  if (s===''||s==='0') return NaN;
  if (colIdx===1){ const p = s.split('/'); if (p.length!==3) return NaN;
    const y = parseInt(p[0],10)+1911, m=parseInt(p[1],10), d=parseInt(p[2],10);
    if ([y,m,d].some(isNaN)) return NaN; return y*10000 + m*100 + d; }
  if (colIdx===2){ const t = s.split(':'); if (t.length!==3) return NaN;
    const hh=parseInt(t[0],10), mm=parseInt(t[1],10), ss=parseInt(t[2],10);
    if ([hh,mm,ss].some(isNaN)) return NaN; return hh*3600+mm*60+ss; }
  if (colIdx===3 || colIdx===4){
    if (s.includes('萬')){ const [wPart, rest=''] = s.split('萬');
      const w = parseInt(wPart.replace(/[^\d]/g,''),10)||0; const r = parseInt((rest||'').replace(/[^\d]/g,''),10)||0;
      return w*10000 + r; }
    const n = parseInt(s.replace(/[^\d]/g,''),10); return isNaN(n) ? 0 : n;
  }
  return s.toLowerCase();
}
function compareCells(a,b,colIdx,dir){
  const ka = makeKeyForNormalized(a,colIdx), kb = makeKeyForNormalized(b,colIdx);
  const an = (typeof ka === 'number' && !isNaN(ka));
  const bn = (typeof kb === 'number' && !isNaN(kb));
  if (!an && !bn) {
    const r = String(a).localeCompare(String(b),'zh-Hant',{numeric:true, sensitivity:'base'});
    return dir===1 ? r : -r;
  }
  if (!an) return dir===1 ? 1 : -1;
  if (!bn) return dir===1 ? -1 : 1;
  return dir===1 ? (ka-kb) : (kb-ka);
}
function sortNormalized(internalCol, dir){
  const idx = Array.from(state.normalizedRows.keys());
  idx.sort((i,j)=> compareCells(state.normalizedRows[i].vals[internalCol], state.normalizedRows[j].vals[internalCol], internalCol, dir));
  reorderByIndex(idx, state.normalizedRows); reorderByIndex(idx, state.rawRows);
  draw();
}
function sortRawByKey(key, dir){
  const idx = Array.from(state.rawRows.keys());
  idx.sort((i,j)=> compareAny(state.rawRows[i].data[key], state.rawRows[j].data[key], dir));
  reorderByIndex(idx, state.rawRows); reorderByIndex(idx, state.normalizedRows);
  draw();
}
function reorderByIndex(order, arr){ const cp = order.map(i=>arr[i]); arr.length=0; arr.push(...cp); }
function compareAny(a, b, dir){
  const sa = String(a ?? '').trim(); const sb = String(b ?? '').trim();
  const na = parseFloat(sa.replace(/[^\d.-]/g,'')); const nb = parseFloat(sb.replace(/[^\d.-]/g,''));
  const an = !isNaN(na); const bn = !isNaN(nb);
  if (an && bn){ return dir===1 ? (na-nb) : (nb-na) }
  const r = sa.localeCompare(sb,'zh-Hant',{numeric:true, sensitivity:'base'}); return dir===1 ? r : -r;
}

// ===== 表頭拖曳（維持你原本的行為） =====
function attachDragHeaders(){
  const ths = document.querySelectorAll('#thead-row th');
  let dragging = null;
  ths.forEach(th => {
    th.addEventListener('dragstart', (e)=>{ dragging = th; th.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    th.addEventListener('dragend',   ()=>{ if (dragging) dragging.classList.remove('dragging'); dragging=null; });
    th.addEventListener('dragover', (e)=>{
      e.preventDefault();
      const target = th;
      if (!dragging || dragging===target) return;
      const rect = target.getBoundingClientRect();
      const before = (e.clientX - rect.left) < rect.width/2;
      if (before) target.parentNode.insertBefore(dragging, target);
      else target.parentNode.insertBefore(dragging, target.nextSibling);
    });
    th.addEventListener('drop', ()=>{
      if (view.mode==='normalized'){
        const newOrder = []; document.querySelectorAll('#thead-row th').forEach(node => newOrder.push(parseInt(node.dataset.col,10)));
        const disabled = view.visibleCols.filter(i=>!view.colEnabled[i]); view.visibleCols = [...newOrder, ...disabled];
      } else {
        const newOrder = []; document.querySelectorAll('#thead-row th').forEach(node => newOrder.push(node.dataset.key));
        view.rawSelectedHeaders = newOrder;
      }
      draw();
    });
  });
}

// ===== 重新繪製並綁定行為 =====
export function draw(){
  renderHead([]);
  const headers = getDisplayHeaders([]);
  const rows = getDisplayRows(state, (k,v)=>inferTypeByHeader(k,v));
  renderTable(state, rows, headers);
  attachSortHandlers();   // 關鍵：每次重繪後重綁排序
  attachDragHeaders();    // 每次重綁拖曳，避免失效
}

// ===== Modal 開關（簡化） =====
function showModal(m){ m.classList.add('show'); m.setAttribute('aria-hidden','false'); }
function hideModal(m){ m.classList.remove('show'); m.setAttribute('aria-hidden','true'); }
window.showModal = showModal;
window.hideModal = hideModal;

// 初始
renderHead([]); bindSelection();bindCrosshair();   // 啟用十字準星
