import type { Prep, Formula } from '../types';
import { generateBatchSheetHtml, generateLabelHtml, generateBottleLabelsHtml, printAllLabels, printA4Html } from '../lib/print';
import { useFormulas } from '../hooks/useFormulas';
import Modal from './ui/Modal';

interface PrepDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prep: Prep | null;
}

export default function PrepDetailsModal({ isOpen, onClose, prep }: PrepDetailsModalProps) {
  const { formulas } = useFormulas();

  if (!isOpen || !prep) return null;

  const formula = formulas.find(f => f.id === prep.formula_id) || ({ 
    name: prep.formula_name, 
    concentration: prep.concentration || '', 
    package_size: '' 
  } as Formula);

  const batchSheetHtml = generateBatchSheetHtml(prep, formula);

  const handlePrintLabel = () => {
    const patientHtml = generateLabelHtml(prep, formula);
    const bottleHtml = generateBottleLabelsHtml(prep, formula);
    printAllLabels(patientHtml, bottleHtml);
  };

  const handlePrintBatchSheet = () => {
    printA4Html(batchSheetHtml);
  };

  return (
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
  );
}
