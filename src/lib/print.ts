import Swal from 'sweetalert2';
import { fmtDate, multiplyAmount, resolvePath } from './utils';
import { normalizeChemicalItems } from './chemicalItems';
import type { Prep, Formula } from '../types';

const formatLotDisplay = (lotNo: string | null | undefined) => String(lotNo ?? '').replace(/^LOT-/, '');

/* A single selectable/printable page — used to let the label-preview modal
   offer "select which pages to print" (empty selection = print everything). */
export type PrintPage = { id: string; label: string; html: string };

/* Shared print dispatch for both label doc builders — same dialog-only
   discipline for both (see Audit.md P0): always through webContents.print
   in Electron, window.print() dialog on the web/PWA build. Never silent. */
const dispatchLabelPrint = (
  doc: string,
  electronPrint: ((html: string) => Promise<{ ok: boolean; message?: string }>) | undefined,
  fallbackWindowFeatures: string,
) => {
  if (electronPrint) {
    void electronPrint(doc).then((res) => {
      if (!res.ok && res.message && !/cancel|ยกเลิก/i.test(res.message)) {
        void Swal.fire({
          icon: 'error',
          title: 'พิมพ์ฉลากไม่สำเร็จ',
          text: res.message,
        });
      }
    });
    return;
  }

  const w = window.open('', '_blank', fallbackWindowFeatures);
  if (!w) return;
  w.document.write(doc);
  w.document.close();
  w.onafterprint = () => w.close();
  w.onload = () => w.print();
};

export const printHtml = (html: string) => {
  const w = window.open('', '_blank', 'width=400,height=500');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:8.5cm 6cm;margin:0}body{font-family:'Sarabun',sans-serif;margin:0;padding:3mm 3mm 3mm 8mm;width:8.5cm;height:6cm;box-sizing:border-box;overflow:hidden}.lb{line-height:1.2;font-size:10px}.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onafterprint = () => w.close();
  w.onload = () => w.print();
};

export const printA4Html = (html: string) => {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(`<html><head><title>พิมพ์ Batch Sheet</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>@page{size:A4;margin:10mm}body{font-family:'Sarabun',sans-serif;margin:0;padding:0;box-sizing:border-box}</style></head><body>${html}</body></html>`);
  w.document.close();
  w.onafterprint = () => w.close();
  w.onload = () => w.print();
};

export const generateLabelHtml = (prep: Prep, formula: Formula) => {
  const dateStr = fmtDate(prep.date);
  const expStr = fmtDate(prep.expiry_date);
  const isPatient = prep.mode === 'patient';

  const preparer = prep.user_pha_id || prep.prepared_by;
  const pkgSize = formula.package_size ? ` (${formula.package_size})` : '';
  const fullName = `${prep.formula_name}${pkgSize} (${prep.qty} ขวด)`;

  const targetRow = isPatient
    ? (() => {
        const pn = prep.patient_name || '-';
        const hnVal = prep.hn || '-';
        const hnRow = hnVal !== '-' ? `<div class="row"><span>HN:</span><span>${hnVal}</span></div>` : '';
        return `<div class="row lb-highlight-row"><span>ผู้ป่วย:</span><strong class="lb-highlight-value">${pn}</strong></div>${hnRow}`;
      })()
    : `<div class="row lb-highlight-row"><span>Stock ไปที่:</span><strong class="lb-highlight-value">${prep.dest_room || prep.target || '-'}</strong></div>`;

  return `<div class="lb"><div class="row"><span>ชื่อยา:</span><strong style="max-width:65%">${fullName}</strong></div><div class="row"><span>ความเข้มข้น:</span><strong>${prep.concentration || '-'}</strong></div>${targetRow}<div class="row"><span>Lot No.:</span><span>${formatLotDisplay(prep.lot_no)}</span></div><div class="row"><span>วันที่เตรียม:</span><span>${dateStr}</span></div><div class="row" style="color:#000;font-weight:700"><span>วันหมดอายุ:</span><span>${expStr}</span></div><div class="row"><span>วิธีใช้:</span><span>ใช้ยาตามแพทย์สั่ง</span></div><div class="row"><span>การเก็บรักษา:</span><span>เก็บในตู้เย็น 2-8°C</span></div></div><div class="lf">ผู้เตรียม: ${preparer} | ${prep.location}</div>`;
};

/* ── Compact IPD label (75mm x 35mm) ──
   Separate content/document/print path from the standard 8.5×6cm label —
   see buildCompactLabelPages, buildCompactLabelPrintDocumentFromPages and
   printCompactLabelPages below. Kept fully isolated (own class names, own
   document builder) so nothing here can affect the validated standard-label
   path. */
export const generateCompactLabelHtml = (prep: Prep, formula: Formula) => {
  const mfgStr = fmtDate(prep.date);
  const expStr = fmtDate(prep.expiry_date);
  const isPatient = prep.mode === 'patient';
  const preparer = prep.user_pha_id || prep.prepared_by;
  const pkgSize = formula.package_size ? ` (${formula.package_size})` : '';
  const fullName = `${prep.formula_name}${pkgSize}`;

  const targetRow = isPatient
    ? (() => {
        const pn = prep.patient_name || '-';
        const hnVal = prep.hn || '-';
        return `<div class="cl-highlight-row"><strong class="cl-highlight-value">${pn}</strong>${hnVal !== '-' ? `<span class="cl-hn">HN ${hnVal}</span>` : ''}</div>`;
      })()
    : `<div class="cl-highlight-row"><span class="cl-label">Stock:</span><strong class="cl-highlight-value">${prep.dest_room || prep.target || '-'}</strong></div>`;

  return `<div class="cl"><div class="cl-name">${fullName}</div>${targetRow}<div class="cl-row"><span>Mfg: ${mfgStr}</span><span class="cl-exp">Exp: ${expStr}</span></div><div class="cl-row"><span>Lot: ${formatLotDisplay(prep.lot_no)}</span></div></div><div class="cl-footer">${preparer} | ${prep.location}</div>`;
};

/* Bottle-wrap labels for the compact IPD doc — reuses the standard .bl label's
   exact dimensions (6.5cm x 1.7cm) unchanged, but paginated 1 label per page
   (instead of 3) since the compact page (7.5×3.5cm) is smaller than the
   standard 8.5×6cm page. CSS for .bl* is duplicated into
   wrapCompactLabelDocument's own stylesheet below rather than shared,
   to keep the compact document fully self-contained/isolated. */
export const generateCompactBottleLabelPages = (
  prep: Prep,
  formula: Formula,
): PrintPage[] => {
  const mfgStr = fmtDate(prep.date);
  const expStr = fmtDate(prep.expiry_date);
  const baseName = formula.short_name?.trim() || prep.formula_name;
  const packageSize = formula.package_size?.trim();
  const concentration = (prep.concentration || formula.concentration || '').trim();
  const drugName = packageSize && concentration
    ? `${baseName} - ${packageSize} (${concentration})`
    : packageSize
      ? `${baseName} - ${packageSize}`
      : concentration
        ? `${baseName} (${concentration})`
        : baseName;
  const qty = prep.qty;
  const preparer = prep.user_pha_id || prep.prepared_by;
  const isPatient = prep.mode === 'patient';
  const patientLine = isPatient
    ? `<div class="bl-patient"><span class="bl-label">HN:</span><span>${prep.hn || '-'}</span><span class="bl-patient-name">${prep.patient_name || '-'}</span></div>`
    : '';
  const pages: PrintPage[] = [];

  for (let idx = 0; idx < qty; idx++) {
    pages.push({
      id: `bottle-${idx}`,
      label: `ฉลากติดขวด (ขวดที่ ${idx + 1}/${qty})`,
      html: `<div class="cbp"><div class="bl${isPatient ? ' bl-patient-mode' : ''}">
      <div class="bl-count">${idx + 1}/${qty}</div>
      ${patientLine}
      <div class="bl-name">${drugName}</div>
      <div class="bl-half-row">
        <div class="bl-half"><span class="bl-label">Mfg:</span><span>${mfgStr}</span></div>
        <div class="bl-half"><span class="bl-label">Exp:</span><span>${expStr}</span></div>
      </div>
      <div class="bl-inline-row">
        <div class="bl-inline-item"><span class="bl-label">By:</span><span>${preparer}</span></div>
        <div class="bl-inline-item"><span class="bl-label">Lot:</span><span>${formatLotDisplay(prep.lot_no)}</span></div>
      </div>
    </div></div>`,
    });
  }
  return pages;
};

/* Short-prep-method and ingredients pages for the compact IPD doc — same
   content/structure as generatePrepStickerPages, resized onto the 7.5×3.5cm
   compact page. Long content still simply clips (overflow:hidden), matching
   the existing standard-page behavior for oversized short_prep/ingredient
   lists — not a new limitation introduced here. */
export const generateCompactPrepStickerPages = (prep: Prep, formula: Formula): PrintPage[] => {
  const ingredients = formula.ingredients ? JSON.parse(formula.ingredients) : [];
  const pages: PrintPage[] = [];

  if (formula.short_prep) {
    pages.push({
      id: 'short-prep',
      label: 'วิธีเตรียมอย่างย่อ',
      html: `
      <div class="cpp">
        <div class="cl" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:2px;font-size:10px;">วิธีการเตรียมอย่างย่อ</div>
             <div style="text-align:center;margin-bottom:2px;font-size:8px;">${formula.name} (${prep.qty} ขวด)</div>
            <div style="padding:0;font-size:8px;white-space:pre-wrap;flex-grow:1;overflow:hidden;">${formula.short_prep}</div>
             <div class="cl-footer" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
        </div>
      </div>
    `,
    });
  }

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    pages.push({
      id: 'ingredients',
      label: 'รายการส่วนประกอบ',
      html: `
      <div class="cpp">
        <div class="cl" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:2px;font-size:10px;">รายการส่วนประกอบ</div>
            <div style="text-align:center;margin-bottom:2px;font-size:8px;">${formula.name} (${formula.concentration}) (${prep.qty} ขวด)</div>
            <table style="width:100%;border-collapse:collapse;font-size:8px;">
              <thead>
                <tr style="border-bottom:1px solid #000;">
                  <th style="text-align:left;padding:1px;">รายการ</th>
                  <th style="text-align:right;padding:1px;">ปริมาณ</th>
                </tr>
              </thead>
              <tbody>
                ${ingredients.map((ing: any) => `
                  <tr style="border-bottom:1px solid #ddd;">
                    <td style="padding:1px;">${ing.name}</td>
                    <td style="text-align:right;padding:1px;">${multiplyAmount(ing.amount, prep.qty)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
             <div class="cl-footer" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
        </div>
      </div>
    `,
    });
  }

  return pages;
};

/* Full compact (75×35mm) print job: main label + short-prep/ingredients +
   bottle labels, in print order. Each entry is independently selectable in
   the label-preview modal's page checklist. */
export const buildCompactLabelPages = (prep: Prep, formula: Formula): PrintPage[] => [
  { id: 'label', label: 'ฉลากยา', html: `<div class="cpp">${generateCompactLabelHtml(prep, formula)}</div>` },
  ...generateCompactPrepStickerPages(prep, formula),
  ...generateCompactBottleLabelPages(prep, formula),
];

const wrapCompactLabelDocument = (
  bodyHtml: string,
  options: { title?: string } = {},
) => `<html><head><title>${options.title ?? 'พิมพ์ฉลาก'}</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>
@page{size:7.5cm 3.5cm;margin:0}
body{font-family:'Sarabun',sans-serif;margin:0;padding:0}
body>*:last-child{page-break-after:auto}
.cpp{padding:2mm 3mm;width:7.5cm;height:3.5cm;box-sizing:border-box;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;justify-content:space-between}
.cl{line-height:1.2;font-size:10px;width:100%}
.cl-name{font-weight:700;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.cl-highlight-row{display:flex;align-items:baseline;gap:4px;margin-bottom:2px}
.cl-highlight-value{font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%}
.cl-hn{font-size:9px;color:#000}
.cl-label{font-size:10px;font-weight:700}
.cl-row{display:flex;justify-content:space-between;gap:6px;font-size:9px}
.cl-exp{font-weight:700}
.cl-footer{border-top:1px solid #000;margin-top:2px;padding-top:2px;font-size:8px;text-align:center;color:#000;width:100%}
/* Bottle-wrap label page — same 6.5cm x 1.7cm .bl box as the standard label,
   1 per page, centered on the 7.5×3.5cm compact page. */
.cbp{width:7.5cm;height:3.5cm;box-sizing:border-box;overflow:hidden;page-break-after:always;display:flex;align-items:center;justify-content:center}
.bl{width:6.5cm;height:1.7cm;box-sizing:border-box;border:0.5px solid #ccc;display:flex;flex-direction:column;justify-content:space-between;position:relative;padding:1mm 2mm;font-family:'Sarabun',sans-serif;background:#fff}
.bl-name{font-weight:700;font-size:12px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8mm}
.bl-count{font-size:8px;font-weight:700;line-height:1;position:absolute;top:1mm;right:2mm}
.bl-half-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-half{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-inline-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-inline-item{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-label{font-weight:700}
.bl-patient{font-size:9px;line-height:1.1;display:flex;gap:1.5mm;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8mm}
.bl-patient .bl-patient-name{flex:1;overflow:hidden;text-overflow:ellipsis}
.bl-patient-mode .bl-name{font-size:10.5px;padding-right:0}
.bl-patient-mode .bl-half-row,.bl-patient-mode .bl-inline-row{font-size:8.5px;line-height:1.1}
@media screen{
  html{background:#e2e8f0}
  body{width:7.5cm;margin:16px auto;background:transparent}
  .cpp,.cbp{margin:0 0 16px;box-shadow:0 2px 10px rgba(15,23,42,.2);background:#fff}
}
</style></head><body>${bodyHtml}</body></html>`;

export const buildCompactLabelPrintDocumentFromPages = (
  pages: PrintPage[],
  options: { title?: string } = {},
) => wrapCompactLabelDocument(pages.map((p) => p.html).join(''), options);

/* Prints the given compact-doc pages — pass a subset to print only selected
   pages from the preview's checklist, or the full buildCompactLabelPages()
   result to print everything (the default when nothing is selected). */
export const printCompactLabelPages = (pages: PrintPage[]) => {
  const doc = buildCompactLabelPrintDocumentFromPages(pages);
  // The pageSize/landscape pairing this sends through window.electronAPI is
  // derived by the same convention as the validated 8.5×6cm case but has NOT
  // been physically validated on a real printer yet — see Audit.md PRN-6.
  dispatchLabelPrint(doc, window.electronAPI?.printCompactLabel, 'width=500,height=350');
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
  const chemicalItems = normalizeChemicalItems(prep.chemical_items, prep.chemical_lot_no, prep.chemical_expiry_date);
  const chemicalItemsHtml = chemicalItems.length > 0
    ? `<table style="width:100%;border-collapse:collapse;margin-top:6px;">
        <thead>
          <tr>
            <th style="border:1px solid #ddd;padding:4px;text-align:left;">สารเคมี</th>
            <th style="border:1px solid #ddd;padding:4px;text-align:left;">Lot No.</th>
            <th style="border:1px solid #ddd;padding:4px;text-align:left;">Exp.</th>
          </tr>
        </thead>
        <tbody>
          ${chemicalItems.map((item) => `
            <tr>
              <td style="border:1px solid #ddd;padding:4px;">${item.name || '-'}</td>
              <td style="border:1px solid #ddd;padding:4px;">${item.lot_no || '-'}</td>
              <td style="border:1px solid #ddd;padding:4px;">${item.expiry_date ? fmtDate(item.expiry_date) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '-';
  
  const ingHtml = getIngredientsHtml(formula.ingredients, prep.qty);
  const metHtml = getMethodHtml(formula.method);
  
  const storage = formula.storage?.trim() || 'เก็บในตู้เย็น 2-8°C';
  const pkgSize = formula.package_size || '-';

  const patientInfoHtml = prep.mode === 'patient'
    ? `<div><strong>ชื่อผู้ป่วย:</strong> ${prep.patient_name || '-'}</div>
      <div><strong>HN:</strong> ${prep.hn || '-'}</div>`
    : `<div style="grid-column: span 2;"><strong>ห้องที่นำไป Stock:</strong> ${prep.dest_room || '-'}</div>`;

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
      ${patientInfoHtml}
      <div><strong>ความเข้มข้น:</strong> ${formula.concentration || '-'}</div>
      <div><strong>ขนาดบรรจุ:</strong> ${pkgSize}</div>
      <div><strong>Lot No.:</strong> ${formatLotDisplay(prep.lot_no)}</div>
      <div><strong>จำนวน:</strong> ${prep.qty} ขวด</div>
      <div><strong>วันที่ผลิต:</strong> ${dateStr}</div>
      <div><strong>วันหมดอายุ:</strong> ${expStr}</div>
      <div style="grid-column: span 2;"><strong>สารเคมีที่ใช้เตรียม:</strong> ${chemicalItemsHtml}</div>
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
        <strong style="display:block;margin-bottom:8px;">ผู้เตรียม</strong>
        <div style="border-bottom:1px solid #999;height:50px"></div>
        <div style="margin-top:8px;">( ${prep.prepared_by || '-'} )</div>
        <div style="color:#666;font-size:11px;margin-top:4px;">วันที่: ____/____/____</div>
      </div>
      <div style="text-align:center;padding:0 20px;">
        <strong style="display:block;margin-bottom:8px;">ผู้ตรวจสอบ</strong>
        <div style="border-bottom:1px solid #999;height:50px"></div>
        <div style="margin-top:8px;">( ........................... )</div>
        <div style="color:#666;font-size:11px;margin-top:4px;">วันที่: ____/____/____</div>
      </div>
    </div>
  </div>`;
};

/* ── Bottle Labels (ฉลากติดขวดยา) — 3 per 6×8.5cm page ── */

export const generateBottleLabelPages = (
  prep: Prep,
  formula: Formula,
): PrintPage[] => {
  const mfgStr = fmtDate(prep.date);
  const expStr = fmtDate(prep.expiry_date);
  const baseName = formula.short_name?.trim() || prep.formula_name;
  const packageSize = formula.package_size?.trim();
  const concentration = (prep.concentration || formula.concentration || '').trim();
  const drugName = packageSize && concentration
    ? `${baseName} - ${packageSize} (${concentration})`
    : packageSize
      ? `${baseName} - ${packageSize}`
      : concentration
        ? `${baseName} (${concentration})`
        : baseName;
  const qty = prep.qty;
  const totalPages = Math.ceil(qty / 3);
  const pages: PrintPage[] = [];

  for (let page = 0; page < totalPages; page++) {
    let labelsHtml = '';
    for (let i = 0; i < 3; i++) {
      const idx = page * 3 + i;
      if (idx >= qty) break;
      const preparer = prep.user_pha_id || prep.prepared_by;

      const isPatient = prep.mode === 'patient';
      const patientLine = isPatient
        ? `<div class="bl-patient"><span class="bl-label">HN:</span><span>${prep.hn || '-'}</span><span class="bl-patient-name">${prep.patient_name || '-'}</span></div>`
        : '';
      labelsHtml += `<div class="bl${isPatient ? ' bl-patient-mode' : ''}">
        <div class="bl-count">${idx + 1}/${qty}</div>
        ${patientLine}
        <div class="bl-name">${drugName}</div>
        <div class="bl-half-row">
          <div class="bl-half"><span class="bl-label">Mfg:</span><span>${mfgStr}</span></div>
          <div class="bl-half"><span class="bl-label">Exp:</span><span>${expStr}</span></div>
        </div>
        <div class="bl-inline-row">
          <div class="bl-inline-item"><span class="bl-label">By:</span><span>${preparer}</span></div>
          <div class="bl-inline-item"><span class="bl-label">Lot:</span><span>${formatLotDisplay(prep.lot_no)}</span></div>
        </div>
      </div>`;
    }
    const startIdx = page * 3 + 1;
    const endIdx = Math.min((page + 1) * 3, qty);
    const rangeLabel = startIdx === endIdx ? `ขวดที่ ${startIdx}` : `ขวดที่ ${startIdx}-${endIdx}`;
    pages.push({
      id: `bottle-${page}`,
      label: `ฉลากติดขวด (${rangeLabel} จาก ${qty})`,
      html: `<div class="pp bottle-page"><div class="bottle-label-stack">${labelsHtml}</div></div>`,
    });
  }
  return pages;
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
             <div class="lf" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
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
             <div class="lf" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
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
             <div class="lf" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
        </div>
      </div>
    `;
  }

  return ingredientsHtml + methodHtml + shortPrepHtml;
};

export const generatePrepStickerPages = (prep: Prep, formula: Formula): PrintPage[] => {
  const ingredients = formula.ingredients ? JSON.parse(formula.ingredients) : [];
  const pages: PrintPage[] = [];

  if (formula.short_prep) {
    pages.push({
      id: 'short-prep',
      label: 'วิธีเตรียมอย่างย่อ',
      html: `
      <div class="pp">
        <div class="lb" style="height:100%;display:flex;flex-direction:column;">
            <div style="text-align:center;font-weight:bold;margin-bottom:5px;font-size:12px;">วิธีการเตรียมอย่างย่อ</div>
             <div style="text-align:center;margin-bottom:5px;font-size:10px;">${formula.name} (${prep.qty} ขวด)</div>
            <div style="padding:0;font-size:10px;white-space:pre-wrap;flex-grow:1;">${formula.short_prep}</div>
             <div class="lf" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
        </div>
      </div>
    `,
    });
  }

  if (Array.isArray(ingredients) && ingredients.length > 0) {
    pages.push({
      id: 'ingredients',
      label: 'รายการส่วนประกอบ',
      html: `
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
             <div class="lf" style="margin-top:auto;">Lot: ${formatLotDisplay(prep.lot_no)}</div>
        </div>
      </div>
    `,
    });
  }

  return pages;
};

/* Full standard (8.5×6cm) print job: main label + short-prep/ingredients +
   bottle labels, in print order. Each entry is independently selectable in
   the label-preview modal's page checklist. */
export const buildStandardLabelPages = (prep: Prep, formula: Formula): PrintPage[] => [
  { id: 'label', label: 'ฉลากยา', html: `<div class="pp"><div class="lb">${generateLabelHtml(prep, formula)}</div></div>` },
  ...generatePrepStickerPages(prep, formula),
  ...generateBottleLabelPages(prep, formula),
];

const wrapLabelDocument = (
  bodyHtml: string,
  options: { title?: string } = {},
) => `<html><head><title>${options.title ?? 'พิมพ์ฉลาก'}</title><link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet"><style>
@page{size:8.5cm 6cm;margin:0}
body{font-family:'Sarabun',sans-serif;margin:0;padding:0}
/* Avoid a trailing blank page after the last label */
body>*:last-child{page-break-after:auto}
/* Patient label page */
.pp{padding:8mm 3mm 3mm 3mm;width:8.5cm;height:6cm;box-sizing:border-box;overflow:hidden;page-break-after:always;display:flex;flex-direction:column;}
.lb{line-height:1.2;font-size:10px;width:100%;}
.lb .row{display:flex;justify-content:space-between;margin-bottom:2px;align-items:baseline}
.lb span,.lb strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lb-highlight-row{align-items:center;margin-top:1px;margin-bottom:3px}
.lb-highlight-row span{font-size:11px;font-weight:700}
.lb-highlight-value{font-size:16px;font-weight:800;max-width:68%}
.lf{border-top:1px solid #000;margin-top:4px;padding-top:2px;font-size:8px;text-align:center;color:#000;width:100%;}
/* Bottle label pages use the same pp page container as pages 1–3.
   Keeping one page structure prevents Chromium/printer drivers from assigning
   a different orientation to this final page. */
.pp.bottle-page{padding:8mm 2mm 0 2mm}
.bottle-label-stack{width:100%;display:flex;flex-direction:column;gap:0;justify-content:flex-start;align-items:center}
/* .bl size: 6.5cm x 1.7cm */
.bl{width:6.5cm;height:1.7cm;box-sizing:border-box;border:0.5px solid #ccc;display:flex;flex-direction:column;justify-content:space-between;position:relative;padding:1mm 2mm;font-family:'Sarabun',sans-serif;background:#fff}
.bl-name{font-weight:700;font-size:12px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8mm}
.bl-count{font-size:8px;font-weight:700;line-height:1;position:absolute;top:1mm;right:2mm}
.bl-half-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-half{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-inline-row{display:grid;grid-template-columns:1fr 1fr;gap:2mm;font-size:10px;line-height:1.15}
.bl-inline-item{display:flex;align-items:center;gap:1mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-label{font-weight:700}
.bl-patient{font-size:9px;line-height:1.1;display:flex;gap:1.5mm;align-items:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:8mm}
.bl-patient .bl-patient-name{flex:1;overflow:hidden;text-overflow:ellipsis}
.bl-patient-mode .bl-name{font-size:10.5px;padding-right:0}
.bl-patient-mode .bl-half-row,.bl-patient-mode .bl-inline-row{font-size:8.5px;line-height:1.1}

.bl-num{display:none}
.bl-qr{display:none}
@media screen{
  html{background:#e2e8f0}
  body{width:8.5cm;margin:16px auto;background:transparent}
  .pp{margin:0 0 16px;box-shadow:0 2px 10px rgba(15,23,42,.2);background:#fff}
}
</style></head><body>${bodyHtml}</body></html>`;

export const buildLabelPrintDocumentFromPages = (
  pages: PrintPage[],
  options: { title?: string } = {},
) => wrapLabelDocument(pages.map((p) => p.html).join(''), options);

/* Prints the given standard-doc pages — pass a subset to print only selected
   pages from the preview's checklist, or the full buildStandardLabelPages()
   result to print everything (the default when nothing is selected).
   In the Electron desktop app, prints with a page size locked from the
   program (8.5×6cm) so the output no longer depends on each machine's
   printer default — this stops both the "skipping several blank stickers"
   problem and the 90°-rotated output on strict driver builds (see Audit.md
   P0). Always goes through the print dialog — silent printing was removed
   on 2026-07-13 because it rotated every label on the ZD230 fleet. Falls
   back to the browser print window on the web/PWA build (no electronAPI). */
export const printLabelPages = (pages: PrintPage[]) => {
  const doc = buildLabelPrintDocumentFromPages(pages);
  dispatchLabelPrint(doc, window.electronAPI?.printLabels, 'width=600,height=400');
};
