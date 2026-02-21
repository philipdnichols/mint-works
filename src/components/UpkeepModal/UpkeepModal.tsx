import { useEffect, useRef, useState } from 'react';
import type { GameLogEntry, Phase } from '../../types/game';

interface UpkeepModalProps {
  entries: ReadonlyArray<GameLogEntry>;
  open: boolean;
  title: string;
  onClose: () => void;
}

export function UpkeepModal({ entries, open, title, onClose }: UpkeepModalProps) {
  const [visibleCount, setVisibleCount] = useState(entries.length);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    if (entries.length === 0) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
  }, [entries.length, open]);

  useEffect(() => {
    if (!open) return;
    if (visibleCount >= entries.length) return;

    timerRef.current = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, entries.length));
    }, 350);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [entries.length, open, visibleCount]);

  if (!open) return null;

  const visibleEntries = entries.slice(0, visibleCount);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${title} recap`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal__header">
          <div>
            <h3 className="modal__title">{title}</h3>
            <p className="modal__subtitle">A quick recap of what resolved in upkeep.</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal__body">
          {entries.length === 0 ? (
            <p className="muted">No upkeep events recorded.</p>
          ) : (
            <ol className="modal__list">
              {visibleEntries.map((entry, index) => (
                <li key={entry.id} className={`modal__item modal__item--${entry.kind}`}>
                  <div className="modal__meta">
                    Step {index + 1} · Round {entry.round} · {formatPhase(entry.phase)}
                  </div>
                  <div className="modal__text">{entry.text}</div>
                </li>
              ))}
            </ol>
          )}
          {entries.length > 0 && (
            <div className="modal__progress">
              Showing {visibleCount} of {entries.length} step{entries.length === 1 ? '' : 's'}.
            </div>
          )}
        </div>
        <footer className="modal__footer">
          <button type="button" className="modal__button" onClick={onClose}>
            Continue
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatPhase(phase: Phase): string {
  switch (phase) {
    case 'development':
      return 'Development';
    case 'upkeep':
      return 'Upkeep';
    case 'scoring':
      return 'Scoring';
    default:
      return phase;
  }
}
