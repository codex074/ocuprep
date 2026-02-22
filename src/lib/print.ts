import { fmtDate, fmtDateTime } from './utils';
import type { Prep, Formula } from '../types';

export const printHtml = (html: string) => {
  const w = window.open('', '_blank', 'width=400,height=500');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:8.5cm 6cm;margin:0}body{font-family:'Sarabun',sans-serif;margin:0;padding:3mm 3mm 3mm 8mm;width:8.5cm;height:6cm;box-sizing:border-box;overflow:hidden}.lb{line-height:1.2;font-size:10px}.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};

export const printA4Html = (html: string) => {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์ Batch Sheet</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:A4;margin:10mm}body{font-family:'Sarabun',sans-serif;margin:0;padding:0;box-sizing:border-box}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};

export const generateLabelHtml = (prep: Prep, formula: Formula) => {
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

  const preparer = prep.user_pha_id || prep.prepared_by;
  const pkgSize = formula.package_size ? ` (${formula.package_size})` : '';
  const fullName = `${prep.formula_name}${pkgSize}`;
  
  return `<div class="lb"><div class="row"><span>ชื่อยา:</span><strong style="max-width:65%">${fullName}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${prep.concentration || '-'}</strong></div><div class="row"><span>ผู้ป่วย:</span><strong style="max-width:65%">${pn}${hnVal !== '-' ? ' (' + hnVal + ')' : ''}</strong></div><div class="row"><span>Lot No.:</span><span>${prep.lot_no}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${dateStr}</span></div><div class="row" style="color:#000;font-weight:700"><span>วันหมดอายุ:</span><span>${expStr}</span></div><div class="row"><span>วิธีใช้:</span><span>ใช้ยาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${preparer} | ${prep.location}</div>`;
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
  
  const storage = formula.storage?.trim() || 'เก็บในตู้เย็น 2-8°C';
  const pkgSize = formula.package_size || '-';

  return `
  <div style="padding:16px;font-size:13px;line-height:1.8">
    <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:16px;">
      <tr>
        <td style="width:120px;border-right:1px solid #000;text-align:center;padding:10px;vertical-align:middle;">
           <div><img src="data:image/png;base64,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" style="height:55px;object-fit:contain;" /></div>
           <div style="font-size:28px;font-weight:bold;margin-top:8px;line-height:1;">${formula.code || ''}</div>
        </td>
        <td style="text-align:center;padding:12px;vertical-align:middle;">
           <div style="font-size:16px;font-weight:bold;margin-bottom:4px;">ฝ่ายเภสัชกรรม โรงพยาบาลอุตรดิตถ์</div>
           <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">บันทึกการผลิตยาตาเฉพาะราย (Batch Processing Record)</div>
           <div style="font-size:18px;font-weight:bold;">${formula.name}</div>
        </td>
      </tr>
    </table>
    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;border:1px solid #ccc;padding:12px;border-radius:6px;">
      <div><strong>ความเข้มข้น:</strong> ${formula.concentration || '-'}</div>
      <div><strong>ขนาดบรรจุ:</strong> ${pkgSize}</div>
      <div><strong>Lot No.:</strong> ${prep.lot_no}</div>
      <div><strong>จำนวน:</strong> ${prep.qty} ขวด</div>
      <div><strong>วันที่ผลิต:</strong> ${dateStr}</div>
      <div><strong>วันหมดอายุ:</strong> ${expStr}</div>
      <div style="grid-column: span 2;"><strong>การเก็บรักษา:</strong> ${storage}</div>
    </div>
    
    <div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px">
      <h4 style="font-size:14px;margin-bottom:8px">ส่วนประกอบ</h4>
      <div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${ingHtml}</div>
    </div>
    
    <div style="border-top:1px solid #ccc;padding-top:12px;margin-bottom:16px">
      <h4 style="font-size:14px;margin-bottom:8px">วิธีเตรียม</h4>
      <div style="background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #eee">${metHtml}</div>
    </div>
    
    <div style="border-top:2px solid #333;padding-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px;">
      <div style="text-align:center;padding:0 20px;">
        <div style="border-bottom:1px solid #999;height:50px"></div>
        <strong style="display:block;margin-top:8px;">ผู้เตรียม (Prepared by)</strong>
        <div style="color:#666;font-size:11px;margin-top:4px;">วันที่: ____/____/____</div>
      </div>
      <div style="text-align:center;padding:0 20px;">
        <div style="border-bottom:1px solid #999;height:50px"></div>
        <strong style="display:block;margin-top:8px;">ผู้ตรวจสอบ (Checked by)</strong>
        <div style="color:#666;font-size:11px;margin-top:4px;">วันที่: ____/____/____</div>
      </div>
    </div>
  </div>`;
};

/* ── Bottle Labels (ฉลากติดขวดยา) — 3 per 6×8.5cm page ── */

export const generateBottleLabelsHtml = (
  prep: Prep,
  formula: Formula,
): string => {
  const mfgStr = fmtDate(prep.date);
  const expStr = prep.expiry_date.includes('T') ? fmtDateTime(prep.expiry_date) : fmtDate(prep.expiry_date);
  const drugName = (formula.short_name?.trim() || prep.formula_name) + (formula.package_size ? ` (${formula.package_size})` : '');
  const storage = formula.storage?.trim() || 'เก็บในตู้เย็น 2-8°C';
  const qty = prep.qty;
  const totalPages = Math.ceil(qty / 3);
  const pages: string[] = [];

  for (let page = 0; page < totalPages; page++) {
    let labelsHtml = '';
    for (let i = 0; i < 3; i++) {
      const idx = page * 3 + i;
      if (idx >= qty) break;
      const preparer = prep.user_pha_id || prep.prepared_by;
      // Use TEC-IT Barcode API (more reliable)
      // code=Code128, dpi=96, imagetype=Png
      // we hide text in API (datamajor=0, dataminor=0 usually hides or default) - actually strictly we want to CONTROL it.
      // TEC-IT shows text by default. Let's create our own text below to control font/size.
      // &hideText=1
      const barcodeUrl = `https://barcode.tec-it.com/barcode.ashx?data=${prep.lot_no}&code=Code128&dpi=96&datamajor=0&dataminor=0&hideText=1`;
      
      labelsHtml += `<div class="bl">
        <div class="bl-text">
          <div class="bl-name">${drugName}</div>
          <div class="bl-row"><span>Mfg: ${mfgStr}</span></div>
          <div class="bl-row"><span>Exp: ${expStr}</span></div>
          <div class="bl-row"><span>By: ${preparer}</span></div>
          <div class="bl-storage">${storage}</div>
        </div>
        <div class="bl-right">
             <div class="bl-count">${idx + 1}/${qty}</div>
             <div class="bl-barcode">
                <img src="${barcodeUrl}" />
                <div class="bl-lot">${prep.lot_no}</div>
             </div>
        </div>
      </div>`;
    }
    pages.push(`<div class="bp">${labelsHtml}</div>`);
  }
  return pages.join('');
};



export const generatePrepDetailsHtml = (prep: Prep, formula: Formula): string => {
  const ingredients = formula.ingredients ? JSON.parse(formula.ingredients) : [];
  const method = formula.method ? JSON.parse(formula.method) : [];

  let ingredientsHtml = '';
  if (Array.isArray(ingredients) && ingredients.length > 0) {
    ingredientsHtml = `
      <div class="pp" style="page-break-before: always;">
        <div class="lb">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">รายการส่วนประกอบ</div>
            <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name} (${formula.concentration})</div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead>
                <tr style="border-bottom:1px solid #000;">
                  <th style="text-align:left;padding:2px;">รายการ</th>
                  <th style="text-align:right;padding:2px;">ปริมาณ</th>
                </tr>
              </thead>
              <tbody>
                ${ingredients.map((ing: any) => `
                  <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:2px;">${ing.name}</td>
                    <td style="text-align:right;padding:2px;">${ing.amount}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
             <div class="lf" style="margin-top:auto;">Lot: ${prep.lot_no}</div>
        </div>
      </div>
    `;
  }

  let methodHtml = '';
  if (Array.isArray(method) && method.length > 0) {
     methodHtml = `
      <div class="pp" style="page-break-before: always;">
        <div class="lb" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">ขั้นตอนการเตรียม</div>
             <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name}</div>
            <ol style="padding-left:15px;margin:0;font-size:10px;flex-grow:1;">
              ${method.map((step: string) => `<li style="margin-bottom:2px;">${step}</li>`).join('')}
            </ol>
             <div class="lf" style="margin-top:auto;">Lot: ${prep.lot_no}</div>
        </div>
      </div>
    `;
  }

  let shortPrepHtml = '';
  if (formula.short_prep) {
     shortPrepHtml = `
      <div class="pp" style="page-break-before: always;">
        <div class="lb" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">วิธีการเตรียมอย่างย่อ</div>
             <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name}</div>
            <div style="padding:0;font-size:10px;white-space:pre-wrap;flex-grow:1;">${formula.short_prep}</div>
             <div class="lf" style="margin-top:auto;">Lot: ${prep.lot_no}</div>
        </div>
      </div>
    `;
  }

  return ingredientsHtml + methodHtml + shortPrepHtml;
};

export const printAllLabels = (patientHtml: string, bottleHtml: string, detailsHtml: string = '') => {
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์ฉลาก</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>
@page{size:8.5cm 6cm;margin:0}
body{font-family:'Sarabun',sans-serif;margin:0;padding:0}
/* Patient label page */
.pp{padding:8mm 3mm 3mm 3mm;width:8.5cm;height:6cm;box-sizing:border-box;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;}
.lb{line-height:1.2;font-size:10px;width:100%;}
.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}
.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000;width:100%;}
/* Bottle label pages */
.bp{width:8.5cm;height:6cm;box-sizing:border-box;padding:8mm 2mm 0 2mm;page-break-after:always;display:flex;flex-direction:column;gap:0;justify-content:flex-start;align-items:center}
/* .bl size: 7cm x 1.7cm */
.bl{width:7cm;height:1.7cm;box-sizing:border-box;border:0.5px solid #ccc;display:flex;flex-direction:row;position:relative;padding:1mm 2mm;font-family:'Sarabun',sans-serif;background:#fff}

/* Left side text - Maximize space */
.bl-text{flex:1;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;min-width:0;padding-right:1mm}
.bl-name{font-weight:700;font-size:11px;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-row{font-size:10px;line-height:1.1;display:flex;gap:3mm}
.bl-storage{font-size:10px;line-height:1.1;color:#333;margin-top:auto;font-weight:500}

/* Right side wrapper */
.bl-right{width:2.4cm;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end;position:relative}

/* Pagination top right */
.bl-count{font-size:7px;font-weight:700;line-height:1;position:absolute;top:-1px;right:0}

/* Barcode area */
.bl-barcode{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:100%;margin-top:2mm}
.bl-barcode img{width:100%;height:10mm;object-fit:contain}
.bl-lot{font-size:7px;font-weight:700;text-align:center;line-height:1;margin-top:1px}

.bl-num{display:none} 
.bl-qr{display:none}
</style></head><body><div class="pp"><div class="lb">${patientHtml}</div></div>${bottleHtml}${detailsHtml}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};

