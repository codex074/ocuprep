import { useState } from 'react';
import type { Prep, Formula } from '../types';
import { buildLabelPrintDocumentFromPages, buildCompactLabelPrintDocumentFromPages, buildStandardLabelPages, buildCompactLabelPages, generateBatchSheetHtml, printLabelPages, printCompactLabelPages, printA4Html } from '../lib/print';
import type { PrintPage } from '../lib/print';
import { useFormulas } from '../hooks/useFormulas';
import Modal from './ui/Modal';

interface PrepDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: Prep | null;
}

export default function PrepDetailsModal({ isOpen, onClose, prep }: PrepDetailsModalProps) {
  const { formulas } = useFormulas();
  const [labelPreviewOpen, setLabelPreviewOpen] = useState(false);
  const [labelSize, setLabelSize] = useState<'standard' | 'compact'>('standard');
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());

  if (!isOpen || !prep) return null;

  const formula = formulas.find(f => f.id === prep.formula_id) || ({
    name: prep.formula_name,
    concentration: prep.concentration || '',
    package_size: ''
  } as Formula);

  const batchSheetHtml = generateBatchSheetHtml(prep, formula);

  const handlePrintLabel = () => {
    setLabelSize('standard');
    setSelectedPageIds(new Set());
    setLabelPreviewOpen(true);
  };

  const handleLabelSizeChange = (size: 'standard' | 'compact') => {
    setLabelSize(size);
    setSelectedPageIds(new Set());
  };

  const handleTogglePrintPage = (id: string) => {
    const next = new Set(selectedPageIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPageIds(next);
  };

  const pages: PrintPage[] = labelSize === 'compact'
    ? buildCompactLabelPages(prep, formula)
    : buildStandardLabelPages(prep, formula);
  const pagesToPrint = selectedPageIds.size === 0 ? pages : pages.filter((p) => selectedPageIds.has(p.id));

  const handleConfirmPrintLabel = () => {
    if (labelSize === 'compact') {
      printCompactLabelPages(pagesToPrint);
    } else {
      printLabelPages(pagesToPrint);
    }
  };

  const handlePrintBatchSheet = () => {
    printA4Html(batchSheetHtml);
  };

  const labelPrintDocument = labelSize === 'compact'
    ? buildCompactLabelPrintDocumentFromPages(pagesToPrint)
    : buildLabelPrintDocumentFromPages(pagesToPrint);
  const labelPreviewTitle = `ตัวอย่างก่อนพิมพ์ฉลากยา (${labelSize === 'compact' ? '75 × 35 มม.' : '8.5 × 6 ซม.'})`;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="รายละเอียดการเตรียมยา (Batch Sheet)"
      width="800px"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn btn-outline" onClick={onClose}>ปิด</button>
          <button className="btn btn-primary" onClick={handlePrintLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            พิมพ์สติกเกอร์
          </button>
          <button className="btn btn-primary" onClick={handlePrintBatchSheet} style={{ background: 'var(--text-primary)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            พิมพ์ Batch Sheet
          </button>
        </div>
      }
    >
      <div 
        style={{ 
          background: '#fff', 
          padding: '20px', 
          border: '1px solid #ccc',
          borderRadius: '8px',
          maxHeight: '60vh',
          overflowY: 'auto', 
          marginBottom: '0' 
        }}
        dangerouslySetInnerHTML={{ __html: batchSheetHtml }}
      />
    </Modal>
    <Modal
      isOpen={labelPreviewOpen}
      onClose={() => setLabelPreviewOpen(false)}
      title={labelPreviewTitle}
      width="760px"
      footer={
        <>
          <button className="btn btn-outline" onClick={() => setLabelPreviewOpen(false)}>ปิด</button>
          <button className="btn btn-primary" onClick={handleConfirmPrintLabel}>
            {selectedPageIds.size > 0 ? `พิมพ์ (${selectedPageIds.size} หน้า)` : 'พิมพ์'}
          </button>
        </>
      }
    >
      <div className="label-print-preview">
        <div className="toggle-group label-size-toggle">
          <div className={`toggle-option standard${labelSize === 'standard' ? ' active' : ''}`} onClick={() => handleLabelSizeChange('standard')}>
            มาตรฐาน (8.5 × 6 ซม.)
          </div>
          <div className={`toggle-option compact${labelSize === 'compact' ? ' active' : ''}`} onClick={() => handleLabelSizeChange('compact')}>
            IPD ขนาดเล็ก (75 × 35 มม.)
          </div>
        </div>
        <div className="label-page-select">
          {pages.map((page) => (
            <label key={page.id} className="label-page-select-item">
              <input
                type="checkbox"
                checked={selectedPageIds.has(page.id)}
                onChange={() => handleTogglePrintPage(page.id)}
              />
              <span>{page.label}</span>
            </label>
          ))}
        </div>
        <p className="label-page-select-hint">
          {selectedPageIds.size === 0 ? 'ไม่ได้เลือกหน้า — จะพิมพ์ทุกหน้าด้านล่าง' : `เลือกพิมพ์ ${selectedPageIds.size} จาก ${pages.length} หน้า`}
        </p>
        <p>ตัวอย่างนี้ใช้ HTML และ CSS ชุดเดียวกับงานพิมพ์จริง แต่ทิศทางกระดาษสุดท้ายยังขึ้นกับ driver ของเครื่องพิมพ์</p>
        <iframe title="ตัวอย่างฉลากก่อนพิมพ์" srcDoc={labelPrintDocument} />
      </div>
    </Modal>
    </>
  );
}
