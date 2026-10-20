import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Todo } from '../shared/types';

export interface RoomTodos {
  /** Everyone's to-dos in the room, oldest first. */
  todos: Todo[];
  add: (text: string) => Promise<void>;
  toggle: (todo: Todo) => void;
  remove: (todo: Todo) => void;
  error: string | null;
}

function upsert(list: Todo[], todo: Todo): Todo[] {
  const i = list.findIndex((t) => t.id === todo.id);
  if (i === -1) return [...list, todo].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const next = list.slice();
  next[i] = todo;
  return next;
}

/**
 * The room's to-do lists, kept live with Postgres changes. Your own changes
 * show immediately and are rolled back if the server refuses them. Row-level
 * security means you can only change your own.
 */
export function useRoomTodos(client: SupabaseClient | null, roomId: string | null, myId: string | null): RoomTodos {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);
  // While a full load is in flight, remember changes that arrive meanwhile and
  // re-apply them on top of its result, which may predate them.
  const changesDuringLoad = useRef<Map<string, Todo | null> | null>(null);

  /** Adds/updates (`row`) or removes (`null`) one to-do. */
  const apply = useCallback((id: string, row: Todo | null) => {
    changesDuringLoad.current?.set(id, row);
    setTodos((list) => (row ? upsert(list, row) : list.filter((t) => t.id !== id)));
  }, []);

  const refetch = useCallback(async () => {
    if (!client || !roomId) return;
    changesDuringLoad.current = new Map();
    const { data, error } = await client.from('todos').select().eq('room_id', roomId).order('created_at');
    const changes = changesDuringLoad.current;
    changesDuringLoad.current = null;
    if (error) {
      setError(error.message);
      return;
    }
    let list = data as Todo[];
    for (const [id, row] of changes) list = row ? upsert(list, row) : list.filter((t) => t.id !== id);
    setTodos(list);
  }, [client, roomId]);

  useEffect(() => {
    setTodos([]);
    if (!client || !roomId) return;
    const channel = client
      .channel(`todos:${roomId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'todos', filter: `room_id=eq.${roomId}` },
        ({ new: row }) => apply((row as Todo).id, row as Todo),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'todos', filter: `room_id=eq.${roomId}` },
        ({ new: row }) => apply((row as Todo).id, row as Todo),
      )
      // DELETE events can't be filtered and only carry the id; ids are unique, so just drop it.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'todos' }, ({ old }) => {
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
  }, [client, roomId, refetch, apply]);

  const add = useCallback(
    async (text: string) => {
      if (!client || !roomId || !myId) return;
      setError(null);
      const { data, error } = await client
        .from('todos')
        .insert({ room_id: roomId, player_id: myId, text })
        .select()
        .single();
      if (error) setError(error.message);
      else apply((data as Todo).id, data as Todo);
    },
    [client, roomId, myId, apply],
  );

  const toggle = useCallback(
    (todo: Todo) => {
      if (!client) return;
      setError(null);
      apply(todo.id, { ...todo, done: !todo.done });
      client
        .from('todos')
        .update({ done: !todo.done })
        .eq('id', todo.id)
        .then(({ error }) => {
          if (error) {
            setError(error.message);
            apply(todo.id, todo);
          }
        });
    },
    [client, apply],
  );

  const remove = useCallback(
    (todo: Todo) => {
      if (!client) return;
      setError(null);
      apply(todo.id, null);
      client
        .from('todos')
        .delete()
        .eq('id', todo.id)
        .then(({ error }) => {
          if (error) {
            setError(error.message);
            apply(todo.id, todo);
          }
        });
    },
    [client, apply],
  );

  return { todos, add, toggle, remove, error };
}
