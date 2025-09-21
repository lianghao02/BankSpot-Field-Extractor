// 矩形框選（直拉/橫拉/跨列）＋ Ctrl/⌘ 多段加入 ＋ 複製 TSV（加入 rAF 節流）
import { els } from './table.js';

let selectionRanges = [];
let selecting = false;
let startCell = null;

// rAF 節流（大量列更順）
let rafId = 0;
let pendingRedraw = false;

export function bindSelection(){
  els.tbody.addEventListener('mousedown', (e)=>{
    const pos = cellPosFromEvent(e); if (!pos) return;
    selecting = true; startCell = pos;
    if (!(e.ctrlKey || e.metaKey)) clearSelection();
    const cur = normalizeRange({ r1:pos.r, c1:pos.c, r2:pos.r, c2:pos.c });
    selectionRanges.push(cur);
    scheduleRedraw();
    e.preventDefault();
  });

  els.tbody.addEventListener('mousemove', (e)=>{
    if (!selecting || !startCell) return;
    const pos = cellPosFromEvent(e); if (!pos) return;
    const last = selectionRanges[selectionRanges.length - 1];
    Object.assign(last, normalizeRange({ r1:startCell.r, c1:startCell.c, r2:pos.r, c2:pos.c }));
    scheduleRedraw();
  });

  window.addEventListener('mouseup', ()=>{ selecting = false; startCell = null; });

  document.getElementById('btn-copy').addEventListener('click', copySelectedToClipboard);

  document.addEventListener('keydown', (e)=>{
    const isCopy = (e.key === 'c' || e.key === 'C') && (e.ctrlKey || e.metaKey);
    if (!isCopy) return;
    if (!document.activeElement || document.activeElement === document.body) {
      e.preventDefault();
      copySelectedToClipboard();
    }
  });
}

function scheduleRedraw(){
  if (pendingRedraw) return;
  pendingRedraw = true;
  rafId = requestAnimationFrame(()=> {
    pendingRedraw = false;
    redrawSelection();
  });
}

function cellPosFromEvent(e){
  const td = e.target.closest('td'); if (!td) return null;
  const tr = td.parentElement;
  const r = Array.prototype.indexOf.call(els.tbody.children, tr);
  const c = Array.prototype.indexOf.call(tr.children, td);
  return { r, c };
}

function normalizeRange({r1,c1,r2,c2}){
  const a=Math.min(r1,r2), b=Math.max(r1,r2);
  const x=Math.min(c1,c2), y=Math.max(c1,c2);
  return { r1:a, c1:x, r2:b, c2:y };
}

function redrawSelection(){
  els.btnCopy.disabled = selectionRanges.length === 0;

  // 先清空
  els.tbody.querySelectorAll('td.sel').forEach(td => td.classList.remove('sel'));
  const rows = els.tbody.querySelectorAll('tr');

  // 畫出所有區塊
  for (const rg of selectionRanges) {
    for (let r = rg.r1; r <= rg.r2; r++) {
      const tr = rows[r]; if (!tr) continue;
      for (let c = rg.c1; c <= rg.c2; c++) {
        const td = tr.children[c];
        if (td) td.classList.add('sel');
      }
    }
  }
}

function clearSelection(){
  selectionRanges = [];
  redrawSelection();
}

async function copySelectedToClipboard(){
  if (!selectionRanges.length) {
    await copyWholeTable();
    return;
  }
  const rows = els.tbody.querySelectorAll('tr');
  const blocks = selectionRanges.map(rg=>{
    const lines = [];
    for (let r = rg.r1; r <= rg.r2; r++) {
      const tr = rows[r]; if (!tr) continue;
      const cells = [];
      for (let c = rg.c1; c <= rg.c2; c++) {
        const td = tr.children[c];
        cells.push(td ? td.textContent : '');
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  });
  const tsv = blocks.join('\n\n');
  await writeClipboard(tsv);
}

async function copyWholeTable(){
  const rows = els.tbody.querySelectorAll('tr');
  const lines = Array.from(rows).map(tr =>
    Array.from(tr.children).map(td => td.textContent).join('\t')
  );
  await writeClipboard(lines.join('\n'));
}

async function writeClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('btn-copy');
    const old = btn.textContent;
    btn.textContent = '已複製！';
    setTimeout(()=> btn.textContent = old, 900);
  }catch{
    const ta = document.createElement('textarea');
    ta.style.position='fixed'; ta.style.opacity='0'; ta.value = text;
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  }
}
