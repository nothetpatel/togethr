import { useState } from 'react';

// Three quick tips the first time someone is in a room. Shown once per
// browser (remembered in localStorage).

const SEEN_KEY = 'togethr.tipsSeen';

const TIPS = [
  { icon: '🐾', title: 'This is your island', text: 'Tap anywhere to walk around. Tap a friend’s animal to send them a ❤️.' },
  { icon: '🎯', title: 'Focus together', text: 'When the timer starts, set a goal. Everyone sits round the campfire until the break.' },
  { icon: '🌱', title: 'Grow it together', text: 'Finished rounds earn seeds for your shared jar. Spend them with 🔨 Build.' },
];

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function RoomTips() {
  const [step, setStep] = useState(() => (alreadySeen() ? -1 : 0));
  if (step < 0) return null;

  const done = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // storage blocked; the tips just show again next visit
    }
    setStep(-1);
  };
  const tip = TIPS[step];
  const last = step === TIPS.length - 1;

  return (
    <section className="card room-tips" aria-label="Tips" aria-live="polite">
      <span className="tip-icon">{tip.icon}</span>
      <div className="tip-body">
        <strong>{tip.title}</strong>
        <p className="muted small">{tip.text}</p>
        <div className="tip-actions">
          <span className="tip-dots" aria-label={`Tip ${step + 1} of ${TIPS.length}`}>
            {TIPS.map((_, i) => (
              <span key={i} className={i === step ? 'on' : ''} />
            ))}
          </span>
          {!last && (
            <button className="link" onClick={done}>
              Skip
            </button>
          )}
          <button className="primary" onClick={() => (last ? done() : setStep(step + 1))}>
            {last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </section>
  );
}
