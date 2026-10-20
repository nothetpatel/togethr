import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AvatarPreview } from '../island/AvatarPreview';
import { savePlayer } from '../lib/supabase';
import { errorMessage } from '../lib/rooms';
import { ANIMAL_EMOJI, ANIMAL_LABEL, AVATAR_COLORS } from '../shared/animals';
import { ANIMALS, type Animal, type Player } from '../shared/types';

// Pick a name, an animal and a scarf colour, with a live 3D preview. Used for
// first-time setup ("create") and from the "Edit avatar" buttons ("edit").
export function AvatarCreator({
  client,
  initial,
  mode,
  onSaved,
  onCancel,
}: {
  client: SupabaseClient;
  initial?: Player | null;
  mode: 'create' | 'edit';
  onSaved: (p: Player) => void;
  onCancel?: () => void;
}) {
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [animal, setAnimal] = useState<Animal>(initial?.avatar.animal ?? 'cat');
  const [color, setColor] = useState(initial?.avatar.color ?? AVATAR_COLORS[0].hex);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = nickname.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await savePlayer(client, name, { animal, color }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <form className="card avatar-creator" onSubmit={submit}>
        {mode === 'create' ? (
          <>
            <h1>Welcome to Togethr</h1>
            <p className="muted">Make your buddy to walk around the island.</p>
          </>
        ) : (
          <h1>Your avatar</h1>
        )}

        <AvatarPreview avatar={{ animal, color }} />

        <label className="field">
          <span>Your name</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="e.g. Het"
            autoFocus={mode === 'create'}
          />
        </label>

        <fieldset className="animal-picker">
          <legend>Your animal</legend>
          {ANIMALS.map((a) => (
            <button
              key={a}
              type="button"
              className={`animal-chip ${a === animal ? 'selected' : ''}`}
              aria-pressed={a === animal}
              onClick={() => setAnimal(a)}
            >
              <span className="emoji">{ANIMAL_EMOJI[a]}</span>
              {ANIMAL_LABEL[a]}
            </button>
          ))}
        </fieldset>

        <fieldset className="color-picker">
          <legend>Scarf colour</legend>
          {AVATAR_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              className={`swatch ${c.hex === color ? 'selected' : ''}`}
              style={{ background: c.hex }}
              aria-label={c.name}
              aria-pressed={c.hex === color}
              title={c.name}
              onClick={() => setColor(c.hex)}
            />
          ))}
        </fieldset>

        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={!name || busy}>
          {busy ? 'Saving…' : mode === 'create' ? 'Continue' : 'Save'}
        </button>
        {onCancel && (
          <button type="button" className="link" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </form>
    </div>
  );
}
