// 表頭繪製、排序、欄位拖曳、資料渲染
import { OUTPUT_HEADERS } from './parser.js';


export const view = {
mode: 'normalized', // normalized | raw
visibleCols: OUTPUT_HEADERS.map((_,i)=>i),
colEnabled: OUTPUT_HEADERS.map(()=>true),
rawSelectedHeaders: [], // 使用者挑選的來源欄位（允許空）
filterFrom: null, // YYYYMMDD number
filterTo: null,
currentSort: { col:null, dir:1, rawKey:null },
};


export const els = {
tbody: document.getElementById('tbody'),
theadRow: document.getElementById('thead-row'),
btnExport: document.getElementById('btn-export'),
btnCopy: document.getElementById('btn-copy'),
rowCount: document.getElementById('row-count'),
modeChip: document.getElementById('mode-chip'),
};


export function getDisplayHeaders(rawUniverse){
if(view.mode==='normalized') return view.visibleCols.filter(i=>view.colEnabled[i]).map(i=>OUTPUT_HEADERS[i]);
return view.rawSelectedHeaders.slice();
}


export function getDisplayRows(state, inferTypeByHeader){
const rows=[];
if(view.mode==='normalized'){
const order=view.visibleCols.filter(i=>view.colEnabled[i]);
for(const r of state.normalizedRows){ if(!passDateFilter(r.dateKey)) continue; rows.push(order.map(i=> r.vals[i])); }
}else{
if(!view.rawSelectedHeaders.length) return rows;
for(const r of state.rawRows){ if(!passDateFilter(r.dateKey)) continue; const out=[]; for(const key of view.rawSelectedHeaders){ out.push(inferTypeByHeader(key, r.data[key])); } rows.push(out); }
}
return rows;
}


export function passDateFilter(dateKey){
if(isNaN(dateKey)) return true;
if(view.filterFrom && dateKey<view.filterFrom) return false;
if(view.filterTo && dateKey>view.filterTo) return false;
return true;
}


export function renderHead(rawHeaders){
els.theadRow.innerHTML='';
const headers=getDisplayHeaders(rawHeaders);
headers.forEach((name,idx)=>{
const th=document.createElement('th'); th.draggable=true; th.classList.add('sortable');
if(view.mode==='normalized'){
const colIdx=view.visibleCols.filter(i=>view.colEnabled[i])[idx]; th.dataset.col=String(colIdx);
}else{ th.dataset.raw='1'; th.dataset.key=view.rawSelectedHeaders[idx]; }
const handle=document.createElement('span'); handle.className='drag-handle'; handle.innerHTML='<svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6h6M9 10h6M9 14h6M9 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const title=document.createElement('span'); title.textContent=name;
const sortIcon=document.createElement('span'); sortIcon.className='sort-icon';
th.appendChild(handle); th.appendChild(title); th.appendChild(sortIcon); els.theadRow.appendChild(th);
});
}


export function renderTable(state, rows, headers){
const frag=document.createDocumentFragment();
for(const r of rows){ const tr=document.createElement('tr'); for(const cell of r){ const td=document.createElement('td'); td.textContent=cell; tr.appendChild(td);} frag.appendChild(tr); }
els.tbody.innerHTML=''; els.tbody.appendChild(frag);
els.rowCount.textContent=`${state.normalizedRows.length} 筆資料`;
const hasRows=els.tbody.querySelectorAll('tr').length>0; const hasCols=headers.length>0;
els.btnCopy.disabled=!(hasRows && hasCols);
els.btnExport.disabled=!(hasRows && hasCols);
}