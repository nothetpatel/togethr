import { useState } from 'react';
import type { RoomIsland } from '../hooks/useRoomIsland';
import { placementProblem } from '../island/placement';
import { CATALOG, CATALOG_BY_KIND, refundFor, type ItemKind } from '../shared/catalog';
import type { RoomItem } from '../shared/types';

/** What the build dock is showing. */
export type BuildUi =
  | { mode: 'shop' }
  | { mode: 'place'; kind: ItemKind; rotation: number; at: [number, number] | null; moving?: RoomItem }
  | { mode: 'selected'; item: RoomItem };

/** Why the item in hand can't go where it is, or null if it can (or isn't anywhere yet). */
export function buildProblem(ui: BuildUi | null, items: RoomItem[]): string | null {
  if (ui?.mode !== 'place' || !ui.at) return null;
  return placementProblem(ui.kind, ui.at[0], ui.at[1], items, ui.moving?.id);
}

// Bottom-of-screen dock for building: browse the shop, place an item (it
// follows your pointer, or goes where you tap), or move/remove one you tapped.
export function BuildDock({
  ui,
  setUi,
  island,
}: {
  ui: BuildUi;
  setUi: (ui: BuildUi | null) => void;
  island: RoomIsland;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<string | null>, then: BuildUi | null) {
    setBusy(true);
    setError(null);
    const problem = await action();
    setBusy(false);
    if (problem) setError(problem);
    else setUi(then);
  }

  if (ui.mode === 'shop') {
    return (
      <section className="card build-dock" aria-label="Build">
        <div className="dock-head">
          <strong>Build</strong>
          <span className="muted small">🌱 {island.seeds} · Level {island.level}</span>
          <button className="icon close" aria-label="Close build mode" onClick={() => setUi(null)}>
            ×
          </button>
        </div>
        <div className="shop-row">
          {CATALOG.map((c) => {
            const locked = island.level < c.minLevel;
            const short = island.seeds < c.cost;
            return (
              <button
                key={c.kind}
                className={`shop-item ${locked ? 'locked' : ''}`}
                disabled={locked || short}
                onClick={() => {
                  setError(null);
                  setUi({ mode: 'place', kind: c.kind, rotation: 0, at: null });
                }}
                title={locked ? `Unlocks at level ${c.minLevel}` : short ? 'Not enough seeds yet' : `Place a ${c.name.toLowerCase()}`}
              >
                <span className="shop-emoji">{c.emoji}</span>
                <span className="shop-name">{c.name}</span>
                <span className="shop-cost">{locked ? `🔒 Lv ${c.minLevel}` : `🌱 ${c.cost}`}</span>
              </button>
            );
          })}
        </div>
        <p className="muted small">Tip: tap something you've built to move or remove it.</p>
      </section>
    );
  }

  if (ui.mode === 'selected') {
    const c = CATALOG_BY_KIND[ui.item.kind];
    return (
      <section className="card build-dock" aria-label={`${c.name} selected`}>
        <div className="dock-head">
          <strong>
            {c.emoji} {c.name}
          </strong>
        </div>
        <div className="dock-actions">
          <button
            onClick={() =>
              setUi({ mode: 'place', kind: ui.item.kind, rotation: ui.item.rotation, at: [ui.item.x, ui.item.z], moving: ui.item })
            }
          >
            Move
          </button>
          <button disabled={busy} onClick={() => run(() => island.remove(ui.item), { mode: 'shop' })}>
            Remove (+🌱 {refundFor(ui.item.kind)})
          </button>
          <button className="link" onClick={() => setUi({ mode: 'shop' })}>
            Back
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
    );
  }

  // Placing (or moving) an item.
  const c = CATALOG_BY_KIND[ui.kind];
  const problem = buildProblem(ui, island.items);
  const confirm = () => {
    if (!ui.at) return;
    const [x, z] = ui.at;
    return run(
      () => (ui.moving ? island.move(ui.moving, x, z, ui.rotation) : island.place(ui.kind, x, z, ui.rotation)),
      { mode: 'shop' },
    );
  };
  return (
    <section className="card build-dock" aria-label={`Placing ${c.name}`}>
      <div className="dock-head">
        <strong>
          {c.emoji} {ui.moving ? 'Moving' : 'Placing'} {c.name.toLowerCase()}
        </strong>
        {!ui.moving && <span className="muted small">🌱 {c.cost}</span>}
      </div>
      <p className="muted small">
        {!ui.at ? 'Tap a spot on the island.' : problem ?? 'Looks good! Tap elsewhere to adjust.'}
      </p>
      <div className="dock-actions">
        <button onClick={() => setUi({ ...ui, rotation: ui.rotation + Math.PI / 4 })} aria-label="Rotate">
          ⟳ Rotate
        </button>
        <button className="primary" disabled={!ui.at || !!problem || busy} onClick={confirm}>
          {busy ? 'Placing…' : ui.moving ? 'Move here' : 'Place'}
        </button>
        <button className="link" onClick={() => setUi({ mode: 'shop' })}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
