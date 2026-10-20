import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Row {
  id: string;
  created_at: string;
}

export interface LiveTable<T extends Row> {
  /** The room's rows, oldest first. */
  rows: T[];
  /** Adds/updates (`row`) or removes (`null`) one row locally, e.g. optimistically. */
  apply: (id: string, row: T | null) => void;
  error: string | null;
  setError: (message: string | null) => void;
}

function upsert<T extends Row>(list: T[], row: T): T[] {
  const i = list.findIndex((r) => r.id === row.id);
  if (i === -1) return [...list, row].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const next = list.slice();
  next[i] = row;
  return next;
}

/**
 * A room's rows from one table, kept live with Postgres changes (row-level
 * security limits both the load and the events to rooms you're in). Empty
 * while `roomId` is null.
 */
export function useLiveTable<T extends Row>(
  client: SupabaseClient | null,
  table: string,
  roomId: string | null,
): LiveTable<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  // While a full load is in flight, remember changes that arrive meanwhile and
  // re-apply them on top of its result, which may predate them.
  const changesDuringLoad = useRef<Map<string, T | null> | null>(null);

  const apply = useCallback((id: string, row: T | null) => {
    changesDuringLoad.current?.set(id, row);
    setRows((list) => (row ? upsert(list, row) : list.filter((r) => r.id !== id)));
  }, []);

  const refetch = useCallback(async () => {
    if (!client || !roomId) return;
    changesDuringLoad.current = new Map();
    const { data, error } = await client.from(table).select().eq('room_id', roomId).order('created_at');
    const changes = changesDuringLoad.current;
    changesDuringLoad.current = null;
    if (error) {
      setError(error.message);
      return;
    }
    let list = data as T[];
    for (const [id, row] of changes) list = row ? upsert(list, row) : list.filter((r) => r.id !== id);
    setRows(list);
  }, [client, table, roomId]);

  useEffect(() => {
    setRows([]);
    if (!client || !roomId) return;
    const channel = client
      .channel(`${table}:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        ({ new: row }) => apply((row as T).id, row as T),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table, filter: `room_id=eq.${roomId}` },
        ({ new: row }) => apply((row as T).id, row as T),
      )
      // DELETE events can't be filtered and only carry the id; ids are unique, so just drop it.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, ({ old }) => {
        const id = (old as { id?: string }).id;
        if (id) apply(id, null);
      })
      // Load once live, so nothing that happens while connecting is missed.
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch();
      });
    return () => {
      client.removeChannel(channel);
    };
  }, [client, table, roomId, refetch, apply]);

  return { rows, apply, error, setError };
}
