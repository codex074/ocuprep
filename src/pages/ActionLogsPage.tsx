import { useEffect, useMemo, useState } from 'react';
import { useActionLogs } from '../hooks/useActionLogs';
import LoadingState from '../components/ui/LoadingState';
import RefreshButton from '../components/ui/RefreshButton';

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionBadgeTone(action: string) {
  if (action === 'create') return 'green';
  if (action === 'delete') return 'red';
  return 'blue';
}

function entityBadgeTone(entity: string) {
  if (entity === 'users') return 'purple';
  if (entity === 'formulas') return 'teal';
  return 'amber';
}

function actionLabel(action: string) {
  if (action === 'create') return 'เพิ่ม';
  if (action === 'delete') return 'ลบ';
  return 'แก้ไข';
}

function entityLabel(entity: string) {
  if (entity === 'users') return 'ผู้ใช้';
  if (entity === 'formulas') return 'สูตรยา';
  return 'รายการผลิต';
}

export default function ActionLogsPage() {
  const { logs, loading, refreshing, fetchLogs } = useActionLogs();
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const normalizedSearch = search.trim().toLowerCase();

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter && log.action !== actionFilter) return false;
      if (entityFilter && log.entity_type !== entityFilter) return false;

      if (!normalizedSearch) return true;

      const haystacks = [
        log.actor_name,
        log.actor_pha_id,
        log.entity_label,
        log.summary,
        ...log.changes.flatMap((change) => [change.field, change.before ?? '', change.after ?? '']),
      ];

      return haystacks.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
    });
  }, [logs, actionFilter, entityFilter, normalizedSearch]);

  useEffect(() => {
    setPage(1);
    setExpandedIds(new Set());
  }, [search, actionFilter, entityFilter]);

  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="page-section">
      <div className="action-logs-toolbar">
        <div>
          <h3 className="action-logs-title">ประวัติการใช้งานระบบ</h3>
          <p className="action-logs-subtitle">
            เก็บรายการย้อนหลัง 3 เดือน และลบอัตโนมัติ
            {normalizedSearch || actionFilter || entityFilter ? ` • พบ ${filteredLogs.length} รายการ` : ` • หน้า ${safePage} จาก ${totalPages}`}
          </p>
        </div>
        <div className="page-actions" style={{ marginBottom: 0 }}>
          <RefreshButton refreshing={refreshing} onClick={() => fetchLogs(true)} />
        </div>
      </div>

      {loading ? (
        <LoadingState title="กำลังโหลด action log" description="ระบบกำลังดึงประวัติการเพิ่ม แก้ไข และลบข้อมูล" />
      ) : (
        <div className="card">
          <div className="card-body">
            <div className="action-logs-filters">
              <div className="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหาผู้ใช้, รายการ, รายละเอียดที่แก้ไข..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select className="form-select" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
                <option value="">ทุก action</option>
                <option value="create">เพิ่ม</option>
                <option value="update">แก้ไข</option>
                <option value="delete">ลบ</option>
              </select>

              <select className="form-select" value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}>
                <option value="">ทุกประเภทข้อมูล</option>
                <option value="users">ผู้ใช้</option>
                <option value="formulas">สูตรยา</option>
                <option value="preps">รายการผลิต</option>
              </select>
            </div>

            <div className="action-logs-list">
              {filteredLogs.length === 0 ? (
                <div className="action-log-empty">
                  {normalizedSearch || actionFilter || entityFilter ? 'ไม่พบ action log ที่ตรงกับตัวกรอง' : 'ยังไม่มี action log'}
                </div>
              ) : (
                visibleLogs.map((log) => (
                  <div key={log.id} className="action-log-card">
                    <div className="action-log-head">
                      <div className="action-log-head-left">
                        <div className="action-log-summary-row">
                          <div className="action-log-summary">{log.summary}</div>
                          <button
                            type="button"
                            className="action-log-toggle"
                            onClick={() => toggleExpanded(log.id)}
                          >
                            {expandedIds.has(log.id) ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}
                          </button>
                        </div>
                        <div className="action-log-meta">
                          <span className={`badge-tag ${actionBadgeTone(log.action)}`}>{actionLabel(log.action)}</span>
                          <span className={`badge-tag ${entityBadgeTone(log.entity_type)}`}>{entityLabel(log.entity_type)}</span>
                          <span className="action-log-chip">#{log.entity_id}</span>
                          <span className="action-log-chip">{log.entity_label}</span>
                        </div>
                      </div>
                      <div className="action-log-time">{formatDateTime(log.created_at)}</div>
                    </div>

                    <div className="action-log-actor">
                      โดย <strong>{log.actor_name}</strong> ({log.actor_pha_id || 'ไม่มี username'})
                    </div>

                    {expandedIds.has(log.id) && log.changes.length > 0 && (
                      <div className="action-log-changes">
                        {log.changes.map((change, index) => (
                          <div key={`${log.id}-${change.field}-${index}`} className="action-log-change-row">
                            <div className="action-log-field">{change.field}</div>
                            <div className="action-log-values">
                              <span className="action-log-before">{change.before ?? '-'}</span>
                              <span className="action-log-arrow">→</span>
                              <span className="action-log-after">{change.after ?? '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {filteredLogs.length > 0 && (
              <div className="action-logs-pagination">
                <div className="action-logs-pagination-text">
                  หน้า {safePage} / {totalPages} • แสดง {startIndex + 1}-{startIndex + visibleLogs.length} จาก {filteredLogs.length} รายการ
                </div>
                <div className="action-logs-pagination-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={safePage <= 1}
                  >
                    ← ก่อนหน้า
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={safePage >= totalPages}
                  >
                    ถัดไป →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
