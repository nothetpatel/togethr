import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { savePlayer } from '../lib/supabase';
import { errorMessage } from '../lib/rooms';
import { ANIMAL_EMOJI, ANIMAL_LABEL } from '../shared/animals';
import { ANIMALS, type Animal, type Player } from '../shared/types';

// First-run screen: a name and an animal. Phase 5 replaces the animal chips
// with the 3D avatar creator.
export function ProfileSetup({ client, onSaved }: { client: SupabaseClient; onSaved: (p: Player) => void }) {
  const [nickname, setNickname] = useState('');
  const [animal, setAnimal] = useState<Animal>('cat');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = nickname.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await savePlayer(client, name, { animal, color: '#ffb5c8' }));
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <form className="card" onSubmit={submit}>
        <h1>Welcome to Togethr</h1>
        <p className="muted">Pick a name and a buddy to walk around the island.</p>

        <label className="field">
          <span>Your name</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={24}
            placeholder="e.g. Het"
            autoFocus
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

        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={!name || busy}>
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
