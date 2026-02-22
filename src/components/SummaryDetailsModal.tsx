import type { Prep } from '../types';
import { fmtShort, fmtTime } from '../lib/utils';
import Modal from './ui/Modal';

interface SummaryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  formulaName: string | null;
  preps: Prep[];
}

export default function SummaryDetailsModal({ isOpen, onClose, formulaName, preps }: SummaryDetailsModalProps) {
  if (!isOpen || !formulaName) return null;

  // Filter preps sequentially based on the selected formula name
  const filteredPreps = preps.filter(p => p.formula_name === formulaName);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`ประวัติการเตรียม: ${formulaName}`}>
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
            <tr>
              <th style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#475569' }}>วันที่</th>
              <th style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#475569' }}>ผู้เตรียม</th>
              <th style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#475569' }}>จำนวน</th>
              <th style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', fontSize: '13px', fontWeight: 600, color: '#475569' }}>ประเภท</th>
            </tr>
          </thead>
          <tbody>
            {filteredPreps.length > 0 ? (
              filteredPreps.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{fmtShort(p.date)}</div>
                    {p.created_at && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtTime(p.created_at)}</div>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px' }}>{p.prepared_by}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 500 }}>{p.qty}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge-tag ${p.mode === 'patient' ? 'blue' : 'teal'}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                      {p.mode === 'patient' ? 'เฉพาะราย' : 'Stock'}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>ไม่มีรายการเตรียมยาสำหรับสูตรนี้</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
