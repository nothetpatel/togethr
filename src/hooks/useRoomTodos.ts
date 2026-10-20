import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Todo } from '../shared/types';
import { useLiveTable } from './useLiveTable';

export interface RoomTodos {
  /** Everyone's to-dos in the room, oldest first. */
  todos: Todo[];
  add: (text: string) => Promise<void>;
  toggle: (todo: Todo) => void;
  remove: (todo: Todo) => void;
  error: string | null;
}

/**
 * The room's to-do lists, kept live. Your own changes show immediately and
 * are rolled back if the server refuses them. Row-level security means you
 * can only change your own.
 */
export function useRoomTodos(client: SupabaseClient | null, roomId: string | null, myId: string | null): RoomTodos {
  const { rows: todos, apply, error, setError } = useLiveTable<Todo>(client, 'todos', roomId);

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
    [client, roomId, myId, apply, setError],
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
    [client, apply, setError],
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
    [client, apply, setError],
  );

  return { todos, add, toggle, remove, error };
}
