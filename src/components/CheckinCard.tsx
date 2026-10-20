import { useState, type FormEvent } from 'react';
import type { Outcome, SessionCheckins } from '../hooks/useSessionCheckins';
import { OUTCOME_BONUS } from '../shared/catalog';
import type { TimerState, Todo } from '../shared/types';

// Under the timer: set a goal for this focus round, and afterwards say how it
// went. Checking in is what earns seeds for the room's jar.
export function CheckinCard({
  timer,
  myId,
  myTodos,
  sessions: { checkins, setGoal, setResult },
}: {
  timer: TimerState | null;
  myId: string;
  myTodos: Todo[];
  sessions: SessionCheckins;
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [skipped, setSkipped] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = checkins.filter((c) => c.player_id === myId);
  const toReview = [...mine].reverse().find((c) => c.outcome === null && c.seeds_awarded > 0);
  const current = timer ? mine.find((c) => c.session_id === timer.session_id) : undefined;

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setError(null);
    const problem = await action();
    setBusy(false);
    if (problem) setError(problem);
    return !problem;
  }

  async function submitGoal(e: FormEvent) {
    e.preventDefault();
    const goal = draft.trim();
    if (goal && (await run(() => setGoal(goal, null)))) {
      setDraft('');
      setEditing(false);
    }
  }

  // A finished round waiting for "how did it go?"
  if (toReview) {
    const answer = (outcome: Outcome) => run(() => setResult(toReview, outcome));
    return (
      <section className="card checkin-card result" aria-label="How did the round go?">
        <p className="checkin-title">
          Round done! <span className="seed-pop">🌱 +{toReview.seeds_awarded}</span>
        </p>
        <p className="muted small">
          Did you finish <strong>“{toReview.goal}”</strong>?
        </p>
        <div className="checkin-outcomes">
          <button disabled={busy} onClick={() => answer('done')}>
            ✅ Done <span className="muted small">+{OUTCOME_BONUS.done}</span>
          </button>
          <button disabled={busy} onClick={() => answer('partly')}>
            🙂 Partly <span className="muted small">+{OUTCOME_BONUS.partly}</span>
          </button>
          <button disabled={busy} onClick={() => answer('not')}>
            Not yet
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  // Goals are for a round that's under way (before Start it's just clutter).
  if (!timer || timer.phase !== 'focus' || timer.status === 'idle') return null;

  if (current && !editing) {
    return (
      <section className="card checkin-card compact" aria-label="Your goal">
        <span className="checkin-goal" data-testid="my-goal">
          🎯 {current.goal}
        </span>
        <button className="link" onClick={() => setEditing(true)}>
          Change
        </button>
      </section>
    );
  }

  if (skipped === timer.session_id && !editing) return null;

  const suggestions = myTodos.filter((t) => !t.done).slice(0, 4);
  return (
    <section className="card checkin-card" aria-label="Set a goal for this round">
      <p className="checkin-title">What will you do this round?</p>
      <p className="muted small">Check in to earn 🌱 seeds for your island.</p>
      {suggestions.length > 0 && (
        <div className="goal-chips">
          {suggestions.map((t) => (
            <button
              key={t.id}
              className="goal-chip"
              disabled={busy}
              onClick={async () => (await run(() => setGoal(t.text, t.id))) && setEditing(false)}
            >
              {t.text}
            </button>
          ))}
        </div>
      )}
      <form className="todo-add" onSubmit={submitGoal}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Chapter 4 notes"
          aria-label="Goal for this round"
          maxLength={120}
        />
        <button type="submit" disabled={!draft.trim() || busy}>
          Set
        </button>
      </form>
      <button
        className="link align-start"
        onClick={() => {
          setSkipped(timer.session_id);
          setEditing(false);
        }}
      >
        {editing ? 'Cancel' : 'Not this round'}
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
