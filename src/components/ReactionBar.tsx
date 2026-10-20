import { REACTIONS } from '../hooks/useRoomLive';

// Pops up after tapping someone's animal: pick a reaction to float above them.
export function ReactionBar({
  name,
  onSend,
  onClose,
}: {
  name: string;
  onSend: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="card reaction-bar" aria-label={`Send ${name} a reaction`}>
      <span className="muted small">Send {name}</span>
      <div className="reaction-choices">
        {REACTIONS.map((emoji) => (
          <button key={emoji} className="reaction-choice" onClick={() => onSend(emoji)} aria-label={`Send ${emoji}`}>
            {emoji}
          </button>
        ))}
      </div>
      <button className="icon close" onClick={onClose} aria-label="Close">
        ×
      </button>
    </section>
  );
}
