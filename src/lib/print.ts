import { fmtDate, fmtDateTime } from './utils';
import type { Prep, Formula } from '../types';

export const printHtml = (html: string) => {
  const w = window.open('', '_blank', 'width=400,height=500');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:6cm 8.5cm;margin:0}body{font-family:'Sarabun',sans-serif;margin:0;padding:8mm 3mm 3mm 3mm;width:6cm;height:8.5cm;box-sizing:border-box;overflow:hidden}.lb{line-height:1.2;font-size:10px}.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};

export const generateLabelHtml = (prep: Prep) => {
  const dateStr = fmtDate(prep.date);
  
  // Format expiry date based on string length or value
  // If expiry contains time (ISO with 'T' and time part), we might want fmtDateTime
  // But usually stored string is YYYY-MM-DD or ISO. 
  // Let's infer if it has time component relevant to hours.
  // Actually, utilize fmtDateTime if it looks like hours (negative match in PreparePage).
  // But here we rely on the string stored in DB.
  // If DB stores YYYY-MM-DD for everything, we lose hour precision?
  // Let's assume standard fmtDate unless we detect time.
  // Actually, to be safe, if we just print what's stored formatted:
  const expStr = prep.expiry_date.includes('T') ? fmtDateTime(prep.expiry_date) : fmtDate(prep.expiry_date);

  // Extract Patient Name and HN from target if mode is patient
  // Or use what's in prep object (patient_name, hn)
  const pn = prep.mode === 'patient' ? (prep.patient_name || '-') : 'Stock';
  const hnVal = prep.mode === 'patient' ? (prep.hn || '-') : '-';

  return `<div class="lb"><div class="row"><span>ชื่อยา:</span><strong style="max-width:65%">${prep.formula_name}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${prep.concentration || '-'}</strong></div><div class="row"><span>ผู้ป่วย:</span><strong style="max-width:65%">${pn}${hnVal !== '-' ? ' (' + hnVal + ')' : ''}</strong></div><div class="row"><span>Lot No.:</span><span>${prep.lot_no}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${dateStr}</span></div><div class="row" style="color:#000;font-weight:700"><span>วันหมดอายุ:</span><span>${expStr}</span></div><div class="row"><span>วิธีใช้:</span><span>หยอดตาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${prep.prepared_by} | ${prep.location}</div>`;
};

const getIngredientsHtml = (str: string | null) => {
  if (!str) return '-';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return `<ul style="margin:0;padding-left:20px">${parsed.map((p: any) => `<li>${p.name} ${p.amount ? `(${p.amount})` : ''}</li>`).join('')}</ul>`;
    }
  } catch {}
  return `<pre style="font-family:Sarabun,sans-serif;white-space:pre-wrap;margin:0">${str}</pre>`;
};

const getMethodHtml = (str: string | null) => {
  if (!str) return '-';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      return `<ol style="margin:0;padding-left:20px">${parsed.map((p: string) => `<li>${p}</li>`).join('')}</ol>`;
    }
  } catch {}
  return `<pre style="font-family:Sarabun,sans-serif;white-space:pre-wrap;margin:0">${str}</pre>`;
};

export const generateBatchSheetHtml = (prep: Prep, formula: Formula) => {
  const dateStr = fmtDate(prep.date);
  const expStr = prep.expiry_date.includes('T') ? fmtDateTime(prep.expiry_date) : fmtDate(prep.expiry_date);
  
  const ingHtml = getIngredientsHtml(formula.ingredients);
  const metHtml = getMethodHtml(formula.method);

  return `<div style="border:2px solid #333;border-radius:8px;padding:24px;font-size:13px;line-height:1.8"><div style="text-align:center;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:16px"><h3 style="font-size:16px">ใบสูตรผลิต (Batch Production Record)</h3><p style="color:#666">โรงพยาบาลอุตรดิตถ์ — กลุ่มงานเภสัชกรรม</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px"><div><strong>ชื่อตำรับ:</strong> ${formula.name}</div><div><strong>ความเข้มข้น:</strong> ${formula.concentration}</div><div><strong>Lot No.:</strong> ${prep.lot_no}</div><div><strong>จำนวน:</strong> ${prep.qty} ขวด</div><div><strong>วันที่ผลิต:</strong> ${dateStr}</div><div><strong>วันหมดอายุ:</strong> ${expStr}</div></div><div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px"><h4 style="font-size:14px;margin-bottom:8px">ส่วนประกอบ</h4><div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${ingHtml}</div></div><div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px"><h4 style="font-size:14px;margin-bottom:8px">วิธีเตรียม</h4><div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${metHtml}</div></div><div style="border-top:2px solid #333;padding-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px"><div style="text-align:center"><div style="border-bottom:1px solid #999;height:50px"></div><strong>ผู้เตรียม (Prepared by)</strong><div style="color:#666;font-size:11px">วันที่: ____/____/____</div></div><div style="text-align:center"><div style="border-bottom:1px solid #999;height:50px"></div><strong>ผู้ตรวจสอบ (Checked by)</strong><div style="color:#666;font-size:11px">วันที่: ____/____/____</div></div></div></div>`;
};

/* ── Bottle Labels (ฉลากติดขวดยา) — 3 per 6×8.5cm page ── */

export const generateBottleLabelsHtml = (
  prep: Prep,
  formula: Formula,
): string => {
  const mfgStr = fmtDate(prep.date);
  const expStr = prep.expiry_date.includes('T') ? fmtDateTime(prep.expiry_date) : fmtDate(prep.expiry_date);
  const drugName = formula.short_name?.trim() || prep.formula_name;
  const storage = formula.storage?.trim() || 'เก็บในตู้เย็น 2-8°C';
  const qty = prep.qty;
  const qrData = encodeURIComponent(`LOT:${prep.lot_no}|MFG:${prep.date}|EXP:${prep.expiry_date}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`;

  const pages: string[] = [];
  const totalPages = Math.ceil(qty / 3);

  for (let page = 0; page < totalPages; page++) {
    let labelsHtml = '';
    for (let i = 0; i < 3; i++) {
      const idx = page * 3 + i;
      if (idx >= qty) break;
      const num = `${idx + 1}/${qty}`;
      labelsHtml += `<div class="bl"><div class="bl-text"><div class="bl-name">${drugName}</div><div class="bl-row"><span>Mfg: ${mfgStr}</span><span>Exp: ${expStr}</span></div><div class="bl-row"><span>By: ${prep.prepared_by}</span></div><div class="bl-storage">${storage}</div></div><div class="bl-num">${num}</div><div class="bl-qr"><img src="${qrUrl}" /></div></div>`;
    }
    pages.push(`<div class="bp">${labelsHtml}</div>`);
  }
  return pages.join('');
};

export const printAllLabels = (patientHtml: string, bottleHtml: string) => {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์ฉลาก</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>
@page{size:6cm 8.5cm;margin:0}
body{font-family:'Sarabun',sans-serif;margin:0;padding:0}
/* Patient label page */
.pp{padding:8mm 3mm 3mm 3mm;width:6cm;height:8.5cm;box-sizing:border-box;overflow:hidden;page-break-after:always}
.lb{line-height:1.2;font-size:10px}
.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}
.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000}
/* Bottle label pages */
.bp{width:6cm;height:8.5cm;box-sizing:border-box;padding:0.8mm 0.3mm 0 0.3mm;page-break-after:always;display:flex;flex-direction:column;gap:0.5mm}
.bl{height:18mm;width:100%;box-sizing:border-box;border:0.3px dashed #999;display:flex;align-items:stretch;position:relative}
.bl-text{flex:1;padding:0.8mm 1mm;display:flex;flex-direction:column;justify-content:center;overflow:hidden;min-width:0}
.bl-name{font-weight:700;font-size:9px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.5px}
.bl-row{font-size:7px;line-height:1.25;display:flex;gap:2mm}
.bl-row span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-storage{font-size:6.5px;line-height:1.1;color:#333;margin-top:auto;border-top:0.3px solid #ccc;padding-top:0.3mm}
.bl-num{position:absolute;top:0.5mm;right:15mm;font-size:6px;color:#666;font-weight:600}
.bl-qr{width:14mm;min-width:14mm;display:flex;align-items:center;justify-content:center;border-left:0.3px dashed #999}
.bl-qr img{width:12mm;height:12mm}
</style></head><body><div class="pp">${patientHtml}</div>${bottleHtml}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};

