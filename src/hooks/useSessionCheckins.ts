import { useCallback } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionCheckin } from '../shared/types';
import { errorMessage } from '../lib/rooms';
import { useLiveTable } from './useLiveTable';

export type Outcome = NonNullable<SessionCheckin['outcome']>;

export interface SessionCheckins {
  /** Everyone's check-ins in the room, oldest first. */
  checkins: SessionCheckin[];
  /** Set or change your goal for the current focus round. Resolves to an error message or null. */
  setGoal: (goal: string, todoId: string | null) => Promise<string | null>;
  /** Say how a finished round went. Resolves to an error message or null. */
  setResult: (checkin: SessionCheckin, outcome: Outcome) => Promise<string | null>;
}

/** Goals for focus rounds and how they went, live for the whole room. */
export function useSessionCheckins(client: SupabaseClient | null, roomId: string | null): SessionCheckins {
  const { rows: checkins, apply } = useLiveTable<SessionCheckin>(client, 'session_checkins', roomId);

  const setGoal = useCallback(
    async (goal: string, todoId: string | null) => {
      if (!client || !roomId) return 'Not in a room';
      const { data, error } = await client.rpc('checkin_set_goal', { p_room: roomId, p_goal: goal, p_todo: todoId });
      if (error) return errorMessage(error);
      apply((data as SessionCheckin).id, data as SessionCheckin);
      return null;
    },
    [client, roomId, apply],
  );

  const setResult = useCallback(
    async (checkin: SessionCheckin, outcome: Outcome) => {
      if (!client) return 'Not in a room';
      apply(checkin.id, { ...checkin, outcome });
      const { data, error } = await client.rpc('checkin_result', { p_checkin: checkin.id, p_outcome: outcome });
      if (error) {
        apply(checkin.id, checkin);
        return errorMessage(error);
      }
      apply((data as SessionCheckin).id, data as SessionCheckin);
      return null;
    },
    [client, apply],
  );

  return { checkins, setGoal, setResult };
}
