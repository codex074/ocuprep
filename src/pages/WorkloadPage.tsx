import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { usePreps } from '../hooks/usePreps';
import { useFormulas } from '../hooks/useFormulas';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function getMonthRange(ym: string): [string, string] {
  const [y, m] = ym.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end   = new Date(y, m, 0);
  const fmt = (d: Date) => d.toLocaleDateString('en-CA');
  return [fmt(start), fmt(end)];
}

function fmtThaiDay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtThaiMonthYear(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' })
    .format(new Date(y, m - 1, 1));
}

// Build list of past N months (value: YYYY-MM)
function buildMonthOptions(n = 24) {
  const list: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toLocaleDateString('en-CA').slice(0, 7); // YYYY-MM
    list.push({ value, label: fmtThaiMonthYear(value) });
  }
  return list;
}

// ──────────────────────────────────────────────
// Time-slot config
// นอกเวลา = เสาร์/อาทิตย์ หรือ วันธรรมดาก่อน 08:00 / หลัง 16:30 น.
// ──────────────────────────────────────────────
type SlotKey = 'morning' | 'afternoon' | 'overtime';

const SLOTS: { key: SlotKey; label: string; range: string; color: string; bg: string }[] = [
  { key: 'morning',   label: 'เช้า',     range: 'จ–ศ  08:00–12:00 น.',        color: '#d97706', bg: '#fef3c7' },
  { key: 'afternoon', label: 'บ่าย',     range: 'จ–ศ  12:00–16:30 น.',        color: '#2563eb', bg: '#dbeafe' },
  { key: 'overtime',  label: 'นอกเวลา', range: 'เสาร์/อาทิตย์ หรือ >16:30 น.', color: '#ef4444', bg: '#fee2e2' },
];

function classifySlot(created_at?: string): SlotKey {
  if (!created_at) return 'overtime'; // ไม่มีเวลาจัดเป็นนอกเวลา
  const d   = new Date(created_at);
  const dow = d.getDay();              // 0 = อาทิตย์, 6 = เสาร์
  const min = d.getHours() * 60 + d.getMinutes();

  // เสาร์ / อาทิตย์ → นอกเวลาทั้งวัน
  if (dow === 0 || dow === 6) return 'overtime';

  // วันธรรมดา
  if (min >= 8 * 60 && min < 12 * 60)       return 'morning';   // 08:00–12:00
  if (min >= 12 * 60 && min < 16 * 60 + 30) return 'afternoon'; // 12:00–16:30
  return 'overtime';                                              // ก่อน 08:00 หรือ หลัง 16:30
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────
export default function WorkloadPage() {
  const now = new Date();
  const defaultMonth = now.toLocaleDateString('en-CA').slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [showAllDays, setShowAllDays]     = useState(false);

  const [start, end] = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const { preps, loading, refreshing, fetchPreps } = usePreps(start, end);
  const { formulas } = useFormulas();

  const priceMap = useMemo(
    () => Object.fromEntries(formulas.map(f => [f.id, f.price ?? 0])),
    [formulas],
  );

  // ── Per-day aggregation ───────────────────
  const dailyRows = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // index preps by date
    const byDate: Record<string, typeof preps> = {};
    preps.forEach(p => { (byDate[p.date] ??= []).push(p); });

    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${selectedMonth}-${String(i + 1).padStart(2, '0')}`;
      const dayPreps = byDate[date] ?? [];
      const slots: Record<SlotKey, number> = { morning: 0, afternoon: 0, overtime: 0 };
      let totalQty   = 0;
      let totalValue = 0;

      dayPreps.forEach(p => {
        slots[classifySlot(p.created_at)]++;
        totalQty   += p.qty;
        totalValue += (priceMap[p.formula_id] ?? 0) * p.qty;
      });

      return { date, ...slots, totalPreps: dayPreps.length, totalQty, totalValue };
    });
  }, [preps, selectedMonth, priceMap]);

  // ── Summary ───────────────────────────────
  const summary = useMemo(() => {
    const activeDays = dailyRows.filter(d => d.totalPreps > 0);
    const totalPreps = preps.length;
    const totalQty   = preps.reduce((s, p) => s + p.qty, 0);
    const totalValue = preps.reduce((s, p) => s + (priceMap[p.formula_id] ?? 0) * p.qty, 0);
    const avgPerDay  = activeDays.length > 0
      ? (totalPreps / activeDays.length).toFixed(1) : '0';
    const busiestDay = activeDays.reduce<typeof dailyRows[0] | null>(
      (best, d) => (!best || d.totalPreps > best.totalPreps) ? d : best, null,
    );
    const slotTotals = SLOTS.reduce((acc, s) => {
      acc[s.key] = dailyRows.reduce((n, d) => n + d[s.key], 0);
      return acc;
    }, {} as Record<SlotKey, number>);
    return { totalPreps, totalQty, totalValue, avgPerDay, busiestDay, slotTotals };
  }, [dailyRows, preps, priceMap]);

  const maxPreps = Math.max(...dailyRows.map(d => d.totalPreps), 1);
  const displayRows = showAllDays ? dailyRows : dailyRows.filter(d => d.totalPreps > 0);
  const monthOptions = useMemo(() => buildMonthOptions(24), []);

  // ── Export ────────────────────────────────
  const handleExport = () => {
    const rows = displayRows.map(d => ({
      'วันที่':                   d.date,
      'เช้า (จ-ศ 08:00-12:00)': d.morning   || 0,
      'บ่าย (จ-ศ 12:00-16:30)': d.afternoon || 0,
      'นอกเวลา (เสาร์/อาทิตย์ หรือ >16:30)': d.overtime || 0,
      'รายการรวม':               d.totalPreps,
      'จำนวนขวด':                d.totalQty,
      'มูลค่า (บาท)':            parseFloat(d.totalValue.toFixed(2)),
    }));
    rows.push({
      'วันที่':                   'รวมทั้งเดือน',
      'เช้า (จ-ศ 08:00-12:00)': summary.slotTotals.morning,
      'บ่าย (จ-ศ 12:00-16:30)': summary.slotTotals.afternoon,
      'นอกเวลา (เสาร์/อาทิตย์ หรือ >16:30)': summary.slotTotals.overtime,
      'รายการรวม':               summary.totalPreps,
      'จำนวนขวด':                summary.totalQty,
      'มูลค่า (บาท)':            parseFloat(summary.totalValue.toFixed(2)),
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Workload');
    XLSX.writeFile(wb, `workload-${selectedMonth}.xlsx`);
  };

  const thaiMonthYear = fmtThaiMonthYear(selectedMonth);

  // ──────────────────────────────────────────
  return (
    <div className="page-section">

      {/* ── Toolbar ── */}
      <div className="page-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            เดือน:
          </label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{
              padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)',
              fontSize: '14px', fontFamily: 'var(--font-body)', background: '#fff',
              color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
            }}
          >
            {monthOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <RefreshButton refreshing={refreshing} onClick={() => fetchPreps(true)} />

        <button
          className="btn btn-sm btn-outline"
          onClick={handleExport}
          disabled={summary.totalPreps === 0}
          style={{ marginLeft: 'auto' }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </button>
      </div>

      {loading ? (
        <LoadingState
          title="กำลังโหลดข้อมูล Workload"
          description={`ดึงข้อมูลการผลิตเดือน ${thaiMonthYear}`}
        />
      ) : (
        <>
          {/* ── Summary stats ── */}
          <div className="stats-grid" style={{ marginBottom: '20px' }}>
            {/* รายการทั้งหมด */}
            <div className="stat-card">
              <div className="stat-icon blue">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </div>
              <div className="stat-info"><h4>{summary.totalPreps}</h4><p>รายการทั้งหมด</p></div>
            </div>

            {/* ขวดทั้งหมด */}
            <div className="stat-card">
              <div className="stat-icon green">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div className="stat-info"><h4>{summary.totalQty}</h4><p>จำนวนขวดทั้งหมด</p></div>
            </div>

            {/* เฉลี่ยต่อวัน */}
            <div className="stat-card">
              <div className="stat-icon amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <div className="stat-info"><h4>{summary.avgPerDay}</h4><p>เฉลี่ย/วันที่ผลิต</p></div>
            </div>

            {/* วันที่ยุ่งที่สุด */}
            <div className="stat-card">
              <div className="stat-icon purple">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div className="stat-info">
                {summary.busiestDay ? (
                  <>
                    <h4 style={{ fontSize: '18px' }}>{summary.busiestDay.totalPreps} รายการ</h4>
                    <p>วันที่ยุ่งที่สุด ({fmtThaiDay(summary.busiestDay.date)})</p>
                  </>
                ) : (
                  <><h4>—</h4><p>วันที่ยุ่งที่สุด</p></>
                )}
              </div>
            </div>

            {/* มูลค่ารวม */}
            <div className="stat-card">
              <div className="stat-icon teal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="stat-info">
                <h4 style={{ fontSize: '17px' }}>
                  ฿{summary.totalValue.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
                <p>มูลค่ายาที่ผลิต</p>
              </div>
            </div>
          </div>

          {/* ── Time-slot proportion bars ── */}
          {summary.totalPreps > 0 && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <div className="card-header">
                <h3>สัดส่วนตามช่วงเวลา — {thaiMonthYear}</h3>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                  {SLOTS.map(slot => {
                    const count = summary.slotTotals[slot.key];
                    const pct   = summary.totalPreps > 0
                      ? Math.round((count / summary.totalPreps) * 100) : 0;
                    return (
                      <div key={slot.key} style={{ flex: '1 1 140px', minWidth: '120px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>
                            {slot.label}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px' }}>
                              {slot.range}
                            </span>
                          </span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: slot.color }}>{count}</span>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: '99px', height: '10px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: slot.color, borderRadius: '99px',
                            transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                          }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {pct}% ของทั้งหมด
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stacked single bar overview */}
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    ภาพรวมสัดส่วน
                  </div>
                  <div style={{ display: 'flex', borderRadius: '99px', overflow: 'hidden', height: '16px', background: '#f1f5f9' }}>
                    {SLOTS.map(slot => {
                      const pct = summary.totalPreps > 0
                        ? (summary.slotTotals[slot.key] / summary.totalPreps) * 100 : 0;
                      return pct > 0 ? (
                        <div
                          key={slot.key}
                          style={{ width: `${pct}%`, background: slot.color, transition: 'width 0.6s' }}
                          title={`${slot.label}: ${summary.slotTotals[slot.key]} รายการ (${Math.round(pct)}%)`}
                        />
                      ) : null;
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {SLOTS.map(slot => (
                      <div key={slot.key} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: slot.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{slot.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Daily breakdown table ── */}
          <div className="card">
            <div className="card-header">
              <h3>รายละเอียดรายวัน — {thaiMonthYear}</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {showAllDays
                    ? `แสดงทุกวัน (${dailyRows.length} วัน)`
                    : `แสดงเฉพาะวันที่มีข้อมูล (${displayRows.length} วัน)`}
                </span>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => setShowAllDays(v => !v)}
                >
                  {showAllDays ? 'เฉพาะวันที่ผลิต' : 'แสดงทุกวัน'}
                </button>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {displayRows.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  ไม่มีข้อมูลการผลิตในเดือนนี้
                </p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '120px' }}>วันที่</th>
                        <th style={{ textAlign: 'center', color: '#d97706' }}>
                          เช้า<br />
                          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>08:00–12:00</span>
                        </th>
                        <th style={{ textAlign: 'center', color: '#2563eb' }}>
                          บ่าย<br />
                          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>12:00–16:30</span>
                        </th>
                        <th style={{ textAlign: 'center', color: '#ef4444' }}>
                          นอกเวลา<br />
                          <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>เสาร์/อาทิตย์ หรือ {'>'} 16:30</span>
                        </th>
                        <th style={{ textAlign: 'center' }}>รวม (รายการ)</th>
                        <th style={{ textAlign: 'center' }}>ขวด</th>
                        <th style={{ minWidth: '120px' }}>สัดส่วน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayRows.map(d => {
                        const barWidth = (d.totalPreps / maxPreps) * 100;
                        const isEmpty  = d.totalPreps === 0;
                        return (
                          <tr
                            key={d.date}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: isEmpty ? '#fafafa' : 'transparent',
                            }}
                          >
                            <td style={{ fontSize: '13px', fontFamily: 'var(--font-mono)' }}>
                              {fmtThaiDay(d.date)}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: d.morning   > 0 ? 600 : 400, color: d.morning   > 0 ? '#d97706' : 'var(--text-muted)' }}>
                              {d.morning   > 0 ? d.morning   : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: d.afternoon > 0 ? 600 : 400, color: d.afternoon > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                              {d.afternoon > 0 ? d.afternoon : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: d.overtime  > 0 ? 600 : 400, color: d.overtime  > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                              {d.overtime  > 0 ? d.overtime  : '—'}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 700, color: isEmpty ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                              {isEmpty ? '—' : d.totalPreps}
                            </td>
                            <td style={{ textAlign: 'center', color: isEmpty ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                              {isEmpty ? '—' : d.totalQty}
                            </td>

                            {/* Stacked bar */}
                            <td>
                              {!isEmpty && (
                                <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', height: '14px', width: `${Math.max(barWidth, 4)}%`, background: '#f1f5f9' }}>
                                  {SLOTS.map(slot => {
                                    const segPct = (d[slot.key] / d.totalPreps) * 100;
                                    return segPct > 0 ? (
                                      <div
                                        key={slot.key}
                                        style={{ width: `${segPct}%`, background: slot.color }}
                                        title={`${slot.label}: ${d[slot.key]} รายการ`}
                                      />
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Footer totals */}
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, borderTop: '2px solid #e2e8f0' }}>
                        <td style={{ fontSize: '13px' }}>รวมทั้งเดือน</td>
                        <td style={{ textAlign: 'center', color: '#d97706' }}>{summary.slotTotals.morning   || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#2563eb' }}>{summary.slotTotals.afternoon || '—'}</td>
                        <td style={{ textAlign: 'center', color: '#ef4444' }}>{summary.slotTotals.overtime  || '—'}</td>
                        <td style={{ textAlign: 'center' }}>{summary.totalPreps}</td>
                        <td style={{ textAlign: 'center' }}>{summary.totalQty}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
