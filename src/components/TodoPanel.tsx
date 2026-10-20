import { useState, type FormEvent } from 'react';
import type { RoomTodos } from '../hooks/useRoomTodos';
import type { MemberWithProfile } from '../lib/rooms';
import { ANIMAL_EMOJI } from '../shared/animals';
import type { Todo } from '../shared/types';

export function progressOf(todos: Todo[]): { done: number; total: number } {
  return { done: todos.filter((t) => t.done).length, total: todos.length };
}

// Right-hand panel: your list (editable) first, then everyone else's
// (read-only) with a progress bar each. On phones it's a bottom sheet.
export function TodoPanel({
  meId,
  members,
  onlineIds,
  todos: { todos, add, toggle, remove, error },
}: {
  meId: string;
  members: MemberWithProfile[];
  onlineIds: string[];
  todos: RoomTodos;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const ordered = [...members].sort((a, b) => Number(b.player_id === meId) - Number(a.player_id === meId));
  const mine = progressOf(todos.filter((t) => t.player_id === meId));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || adding) return;
    setAdding(true);
    await add(text);
    setDraft('');
    setAdding(false);
  }

  return (
    <aside className={`card todo-panel ${open ? 'open' : ''}`} aria-label="To-do lists">
      <button type="button" className="todo-sheet-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>To-dos</span>
        <span className="muted">
          {mine.done}/{mine.total} done
        </span>
        <span aria-hidden>{open ? '▾' : '▴'}</span>
      </button>

      <div className="todo-body">
        {ordered.map((m) => {
          const isMe = m.player_id === meId;
          const items = todos.filter((t) => t.player_id === m.player_id);
          const { done, total } = progressOf(items);
          return (
            <section
              key={m.player_id}
              className={`todo-section ${isMe || onlineIds.includes(m.player_id) ? '' : 'away'}`}
              data-member={m.nickname}
            >
              <header>
                <span className="emoji">{ANIMAL_EMOJI[m.avatar.animal] ?? '🐾'}</span>
                <strong>{isMe ? 'Your list' : m.nickname}</strong>
                <span className="muted small">
                  {done}/{total}
                </span>
              </header>
              <div className="progress" aria-hidden>
                <div style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
              </div>

              {isMe && (
                <form className="todo-add" onSubmit={submit}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Add a task…"
                    aria-label="New task"
                    maxLength={200}
                  />
                  <button type="submit" disabled={!draft.trim() || adding} aria-label="Add task">
                    +
                  </button>
                </form>
              )}

              <ul className="todos">
                {items.map((t) => (
                  <li key={t.id} className={t.done ? 'done' : ''}>
                    {isMe ? (
                      <>
                        <label>
                          <input type="checkbox" checked={t.done} onChange={() => toggle(t)} />
                          <span>{t.text}</span>
                        </label>
                        <button type="button" className="icon" onClick={() => remove(t)} aria-label={`Delete ${t.text}`}>
                          ×
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`check ${t.done ? 'on' : ''}`} aria-label={t.done ? 'Done' : 'Not done'} />
                        <span>{t.text}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {items.length === 0 && (
                <p className="muted small">{isMe ? 'Nothing yet. Add your first task!' : 'No tasks yet.'}</p>
              )}
            </section>
          );
        })}
        {error && <p className="error">{error}</p>}
      </div>
    </aside>
  );
}
