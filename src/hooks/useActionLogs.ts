import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { getCachedResource, loadCachedResource } from '../lib/resourceCache';
import type { ActionLog, ActionLogChange } from '../types';

const ACTION_LOGS_CACHE_KEY = 'action-logs';

function toActionLogChange(raw: unknown): ActionLogChange | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  return {
    field: String(record.field ?? ''),
    before: record.before != null ? String(record.before) : undefined,
    after: record.after != null ? String(record.after) : undefined,
  };
}

function toActionLog(raw: Record<string, unknown>): ActionLog {
  return {
    id: Number(raw.id),
    action: (raw.action as ActionLog['action']) ?? 'update',
    entity_type: (raw.entity_type as ActionLog['entity_type']) ?? 'preps',
    entity_id: Number(raw.entity_id),
    entity_label: String(raw.entity_label ?? ''),
    actor_user_id: raw.actor_user_id != null ? Number(raw.actor_user_id) : undefined,
    actor_name: String(raw.actor_name ?? ''),
    actor_pha_id: String(raw.actor_pha_id ?? ''),
    summary: String(raw.summary ?? ''),
    changes: Array.isArray(raw.changes)
      ? raw.changes.map(toActionLogChange).filter((entry): entry is ActionLogChange => entry != null)
      : [],
    created_at: String(raw.created_at ?? ''),
  };
}

export function useActionLogs() {
  const [logs, setLogs] = useState<ActionLog[]>(() => getCachedResource<ActionLog[]>(ACTION_LOGS_CACHE_KEY) ?? []);
  const [loading, setLoading] = useState(logs.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else if (logs.length === 0) setLoading(true);

    try {
      const mapped = await loadCachedResource(ACTION_LOGS_CACHE_KEY, async () => {
        const data = await api.getActionLogs();
        return data.map((entry) => toActionLog(entry as Record<string, unknown>));
      }, { force });
      setLogs(mapped);
    } catch (error) {
      console.error('fetchActionLogs error', error);
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logs.length]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return {
    logs,
    loading,
    refreshing,
    fetchLogs,
  };
}
