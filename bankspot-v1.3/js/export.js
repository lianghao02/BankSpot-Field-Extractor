// 匯出 CSV（UTF-8 + BOM）
export function exportCSV(rows, headers){
if(!rows?.length || !headers?.length) return;
const header=headers.join(',');
const lines=rows.map(r=> r.map(escapeCSV).join(','));
const csv=[header, ...lines].join('\r\n');
const blob=new Blob(["\uFEFF"+csv], {type:'text/csv;charset=utf-8;'});
const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
const ts=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); a.download=`抽欄位_輸出_${ts}.csv`;
a.click(); URL.revokeObjectURL(a.href);
}
function escapeCSV(v){ const s=String(v ?? ''); if(s.includes(',')||s.includes('"')||s.includes('\n')) return '"'+s.replace(/"/g,'""')+'"'; return s; }