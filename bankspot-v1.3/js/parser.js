// js/parser.js
// 欄位映射與格式化（民國日期、時間、金額標準化）
export const OUTPUT_HEADERS = ['帳號','交易日期','交易時間','支出金額','存入金額','ATM編號','提款地點'];
export const FIELD_MAP = {
  '帳號': ['帳號','人頭帳戶'],
  '交易日期': ['交易日期','提款日期'],
  '交易時間': ['交易時間','提款時間'],
  '支出金額': ['支出金額','提款金額','交易金額'],
  '存入金額': ['存入金額'],
  'ATM編號': ['ATM編號','ATM或端末機代碼'],
  '提款地點': ['提款地點']
};

export function normalizeHeaderRow(hdr){ return hdr.map(h => String(h).trim()); }

export function pickAndFormatRow(headerRow, dataRow){
  const obj = {};
  for (let i=0;i<headerRow.length;i++){ const key = headerRow[i] || ''; if (!key) continue; obj[key] = dataRow[i]; }
  const getFirst = (cands)=>{ for (const k of cands){ if (k in obj){ const v=obj[k]; if (v!==''&&v!==null&&v!==undefined) return v; } } return null; };

  const rawAcct = getFirst(FIELD_MAP['帳號']);
  const rawDate = getFirst(FIELD_MAP['交易日期']);
  const rawTime = getFirst(FIELD_MAP['交易時間']);
  const rawOut  = getFirst(FIELD_MAP['支出金額']);
  const rawIn   = getFirst(FIELD_MAP['存入金額']);
  const rawATM  = getFirst(FIELD_MAP['ATM編號']);
  const rawLoc  = getFirst(FIELD_MAP['提款地點']);

  return [
    formatAccount(rawAcct),
    formatROCDateSafe(rawDate),
    formatTimeSafe(rawTime),
    formatAmountStandard(rawOut),
    formatAmountStandard(rawIn),
    formatText(rawATM),
    formatText(rawLoc)
  ];
}

export function formatAccount(v){ return (v===null||v===undefined||String(v).trim()==='')?'0':String(v).trim(); }

export function formatROCDateSafe(v){
  if (v===null||v===undefined||v==='') return '0';
  if (typeof v === 'number' && v >= 1 && window.XLSX?.SSF){
    const d = XLSX.SSF.parse_date_code(v);
    if (d?.y && d?.m && d?.d){
      const roc = d.y - 1911; if (roc<=0) return '0';
      return `${roc}/${String(d.m).padStart(2,'0')}/${String(d.d).padStart(2,'0')}`;
    }
  }
  let s = String(v).trim().replace(/[．。.-]/g,'/').replace(/／/g,'/');
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())){
    const yyyy=d2.getFullYear(), mm=String(d2.getMonth()+1).padStart(2,'0'), dd=String(d2.getDate()).padStart(2,'0');
    const roc = yyyy - 1911; if (roc<=0) return '0';
    return `${roc}/${mm}/${dd}`;
  }
  const digits = s.replace(/[^\d]/g,'');
  if (digits.length===8){
    const yyyy=parseInt(digits.slice(0,4),10), mm=digits.slice(4,6), dd=digits.slice(6,8);
    const roc = yyyy-1911; if (roc<=0) return '0';
    return `${roc}/${mm}/${dd}`;
  }
  if (digits.length===7){
    const yyy=digits.slice(0,3), mm=digits.slice(3,5), dd=digits.slice(5,7);
    return `${yyy}/${mm}/${dd}`;
  }
  const m = s.match(/^(\d{3})[\/](\d{1,2})[\/](\d{1,2})$/);
  if (m){ const yyy=m[1], mm=m[2].padStart(2,'0'), dd=m[3].padStart(2,'0'); return `${yyy}/${mm}/${dd}`; }
  return '0';
}

export function formatTimeSafe(v){
  if (v===null||v===undefined||v==='') return '0';
  // Excel 小數時間
  if (typeof v==='number'){
    if (v>0 && v<1 && window.XLSX?.SSF){
      const totalSec = Math.round(v * 24 * 60 * 60);
      const hh = String(Math.floor(totalSec/3600)).padStart(2,'0');
      const mm = String(Math.floor((totalSec%3600)/60)).padStart(2,'0');
      const ss = String(totalSec%60).padStart(2,'0');
      return `${hh}:${mm}:${ss}`;
    }
    return timeFromDigits(String(Math.round(v)));
  }
  const digits = String(v).replace(/[^\d]/g,'');
  if (digits.length===0) return '0';
  return timeFromDigits(digits);
}

// 把「22148」→ 補到 6 碼「022148」；「915」→ 視為 HMM，補成「0915:00」
function timeFromDigits(s){
  // 只有小時：HH
  if (s.length===2) return `${s}:00:00`;
  // 典型：HHMM
  if (s.length===4) return `${s.slice(0,2)}:${s.slice(2,4)}:00`;
  // 典型：HHMMSS
  if (s.length===6) return `${s.slice(0,2)}:${s.slice(2,4)}:${s.slice(4,6)}`;

  // 3 碼：HMM → 0H:MM:00
  if (s.length===3) {
    const p = s.padStart(4,'0');
    return `${p.slice(0,2)}:${p.slice(2,4)}:00`;
  }
  // 5 碼：?HHMMS → 補 6 碼（常見像 22148 → 022148）
  if (s.length===5) {
    const p = s.padStart(6,'0');
    return `${p.slice(0,2)}:${p.slice(2,4)}:${p.slice(4,6)}`;
  }
  // 其餘 1,>6：盡量補到 6 碼再當 HHMMSS；無法則回 0
  if (s.length===1 || s.length>6) {
    const onlyDigits = s.replace(/[^\d]/g,'');
    if (onlyDigits.length>=1 && onlyDigits.length<=6){
      const p = onlyDigits.padStart(6,'0');
      return `${p.slice(0,2)}:${p.slice(2,4)}:${p.slice(4,6)}`;
    }
  }
  return '0';
}

// 金額：<1萬直接數字；≥1萬「萬」字顯示（去正負，方向交由欄位決定）
export function formatAmountStandard(v){
  if (v===null||v===undefined||v==='') return '0';
  let s = String(v).trim().replace(/,/g,'');
  const num = Math.abs(parseFloat(s.replace(/[^\d.-]/g,'')));
  if (isNaN(num)) return '0';
  const n = Math.floor(num + 1e-6);
  if (n < 10000) return n.toLocaleString('zh-TW');
  const w = Math.floor(n/10000), r = n%10000;
  return r===0 ? `${w}萬` : `${w}萬${r.toLocaleString('zh-TW')}`;
}
export function amountToNumber(s){
  s = String(s||'').trim();
  if (s==='0'||s==='') return 0;
  if (s.includes('萬')){
    const [wPart, rest=''] = s.split('萬');
    const w = parseInt(wPart.replace(/[^\d]/g,''),10)||0;
    const r = parseInt(rest.replace(/[^\d]/g,''),10)||0;
    return w*10000 + r;
  }
  const n = parseInt(s.replace(/[^\d]/g,''),10);
  return isNaN(n)?0:n;
}

export function formatText(v){ if (v===null||v===undefined) return '0'; const s=String(v).trim(); return s===''?'0':s; }

export function parseDateKeyFromUnified(rocStr){
  const p = String(rocStr).split('/');
  if (p.length!==3) return NaN;
  const y = parseInt(p[0],10)+1911, m=parseInt(p[1],10), d=parseInt(p[2],10);
  if ([y,m,d].some(isNaN)) return NaN;
  return y*10000 + m*100 + d;
}
