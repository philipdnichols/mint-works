import { useEffect, useRef } from 'react';
import type { GameLogEntry, Phase } from '../../types/game';

interface GameLogProps {
  log: ReadonlyArray<GameLogEntry>;
}

export function GameLog({ log }: GameLogProps) {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [log.length]);

  return (
    <section className="panel log">
      <h3>Game Log</h3>
      {log.length === 0 ? (
        <p className="muted">No events yet.</p>
      ) : (
        <div className="log__list" ref={listRef}>
          {log.map((entry) => (
            <div key={entry.id} className={`log__entry log__entry--${entry.kind}`}>
              <div className="log__meta">
                Round {entry.round} · {formatPhase(entry.phase)}
              </div>
              <div className="log__text">{entry.text}</div>
            </div>
          ))}
        </div>
      )}
    </section>
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
