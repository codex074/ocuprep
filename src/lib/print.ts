import { fmtDate, multiplyAmount, resolvePath } from './utils';
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
  const expStr = fmtDate(prep.expiry_date);

  // Extract Patient Name and HN from target if mode is patient
  // Or use what's in prep object (patient_name, hn)
  const pn = prep.mode === 'patient' ? (prep.patient_name || '-') : 'Stock';
  const hnVal = prep.mode === 'patient' ? (prep.hn || '-') : '-';

  const preparer = prep.user_pha_id || prep.prepared_by;
  const pkgSize = formula.package_size ? ` (${formula.package_size})` : '';
  const fullName = `${prep.formula_name}${pkgSize} (${prep.qty} ขวด)`;
  
  return `<div class="lb"><div class="row"><span>ชื่อยา:</span><strong style="max-width:65%">${fullName}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${prep.concentration || '-'}</strong></div><div class="row"><span>ผู้ป่วย:</span><strong style="max-width:65%">${pn}${hnVal !== '-' ? ' (' + hnVal + ')' : ''}</strong></div><div class="row"><span>Lot No.:</span><span>${prep.lot_no}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${dateStr}</span></div><div class="row" style="color:#000;font-weight:700"><span>วันหมดอายุ:</span><span>${expStr}</span></div><div class="row"><span>วิธีใช้:</span><span>ใช้ยาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${preparer} | ${prep.location}</div>`;
};

const getIngredientsHtml = (str: string | null, qty: number = 1) => {
  if (!str) return '-';
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
      return `<ul style="margin:0;padding-left:20px">${parsed.map((p: any) => `<li>${p.name} ${p.amount ? `(${multiplyAmount(p.amount, qty)})` : ''}</li>`).join('')}</ul>`;
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
  const expStr = fmtDate(prep.expiry_date);
  const hospitalLogo = resolvePath('/logo/mophlogo.png');
  
  const ingHtml = getIngredientsHtml(formula.ingredients, prep.qty);
  const metHtml = getMethodHtml(formula.method);
  
  const storage = formula.storage?.trim() || 'เก็บในตู้เย็น 2-8°C';
  const pkgSize = formula.package_size || '-';

  return `
  <div style="padding:16px;font-size:13px;line-height:1.8">
    <table style="width:100%;border-collapse:collapse;border:1px solid #000;margin-bottom:16px;">
      <tr>
        <td style="width:120px;border-right:1px solid #000;text-align:center;padding:10px 8px;vertical-align:middle;">
           <div><img src="${hospitalLogo}" alt="Hospital Logo" style="height:58px;object-fit:contain;display:block;margin:0 auto 10px auto;" /></div>
           <div style="font-size:22px;font-weight:bold;line-height:1.05;letter-spacing:0.5px;">${formula.code || ''}</div>
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
  const expStr = fmtDate(prep.expiry_date);
  const drugName = (formula.short_name?.trim() || prep.formula_name) + (formula.package_size ? ` (${formula.package_size})` : '');
  const qty = prep.qty;
  const totalPages = Math.ceil(qty / 3);
  const pages: string[] = [];

  for (let page = 0; page < totalPages; page++) {
    let labelsHtml = '';
    for (let i = 0; i < 3; i++) {
      const idx = page * 3 + i;
      if (idx >= qty) break;
      const preparer = prep.user_pha_id || prep.prepared_by;
      
      labelsHtml += `<div class="bl">
        <div class="bl-count">${idx + 1}/${qty}</div>
        <div class="bl-name">${drugName}</div>
        <div class="bl-half-row">
          <div class="bl-half"><span class="bl-label">Mfg:</span><span>${mfgStr}</span></div>
          <div class="bl-half"><span class="bl-label">Exp:</span><span>${expStr}</span></div>
        </div>
        <div class="bl-inline-row">
          <div class="bl-inline-item"><span class="bl-label">By:</span><span>${preparer}</span></div>
          <div class="bl-inline-item"><span class="bl-label">Lot:</span><span>${prep.lot_no}</span></div>
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

export const generatePrepStickersHtml = (prep: Prep, formula: Formula): string => {
  const ingredients = formula.ingredients ? JSON.parse(formula.ingredients) : [];
  
  let shortPrepHtml = '';
  if (formula.short_prep) {
     shortPrepHtml = `
      <div class="pp">
        <div class="lb" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">วิธีการเตรียมอย่างย่อ</div>
             <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name} (${prep.qty} ขวด)</div>
            <div style="padding:0;font-size:10px;white-space:pre-wrap;flex-grow:1;">${formula.short_prep}</div>
             <div class="lf" style="margin-top:auto;">Lot: ${prep.lot_no}</div>
        </div>
      </div>
    `;
  }

  let ingredientsHtml = '';
  if (Array.isArray(ingredients) && ingredients.length > 0) {
    ingredientsHtml = `
      <div class="pp">
        <div class="lb" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">รายการส่วนประกอบ</div>
            <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name} (${formula.concentration}) (${prep.qty} ขวด)</div>
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
                    <td style="text-align:right;padding:2px;">${multiplyAmount(ing.amount, prep.qty)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
             <div class="lf" style="margin-top:auto;">Lot: ${prep.lot_no}</div>
        </div>
      </div>
    `;
  }

  return shortPrepHtml + ingredientsHtml;
};

export const printAllLabels = (patientHtml: string, bottleHtml: string, prepStickersHtml: string = '') => {
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
.bl{width:7cm;height:1.7cm;box-sizing:border-box;border:0.5px solid #ccc;display:flex;flex-direction:column;justify-content:space-between;position:relative;padding:1mm 2mm;font-family:'Sarabun',sans-serif;background:#fff}
.bl-name{font-weight:700;font-size:12px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:12mm}
.bl-count{font-size:8px;font-weight:700;line-height:1;position:absolute;top:1mm;right:2mm}
.bl-half-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-half{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-inline-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-inline-item{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-label{font-weight:700}

.bl-num{display:none} 
.bl-qr{display:none}
</style></head><body><div class="pp"><div class="lb">${patientHtml}</div></div>${prepStickersHtml}${bottleHtml}</body></html>`);
  w.document.close();
  w.onload = () => w.print();
};
