import { useEffect, useRef, useState } from 'react';
import type { GameLogEntry, Phase } from '../../types/game';

interface GameLogProps {
  log: ReadonlyArray<GameLogEntry>;
  onPlaybackChange?: (active: boolean) => void;
}

export function GameLog({ log, onPlaybackChange }: GameLogProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(log.length);
  const [playbackActive, setPlaybackActive] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (log.length < visibleCount) {
      setVisibleCount(log.length);
      setPlaybackActive(false);
      return;
    }

    if (log.length === visibleCount) {
      if (playbackActive) setPlaybackActive(false);
      return;
    }

    const newEntries = log.slice(visibleCount);
    const shouldAnimate = newEntries.every((entry) => entry.kind === 'ai');

    if (!shouldAnimate) {
      setVisibleCount(log.length);
      setPlaybackActive(false);
      return;
    }

    if (!playbackActive) {
      setPlaybackActive(true);
    }
  }, [log, playbackActive, visibleCount]);

  useEffect(() => {
    if (!playbackActive) return;
    if (visibleCount >= log.length) {
      setPlaybackActive(false);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, log.length));
    }, 500);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [log.length, playbackActive, visibleCount]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: playbackActive ? 'smooth' : 'auto', block: 'end' });
  }, [playbackActive, visibleCount]);

  useEffect(() => {
    onPlaybackChange?.(playbackActive);
  }, [onPlaybackChange, playbackActive]);

  const visibleLog = log.slice(0, visibleCount);

  return (
    <section className="panel log">
      <h3>Game Log</h3>
      {playbackActive && <div className="log__status">Playing AI turn...</div>}
      {log.length === 0 ? (
        <p className="muted">No events yet.</p>
      ) : (
        <div className="log__list">
          {visibleLog.map((entry) => (
            <div key={entry.id} className={`log__entry log__entry--${entry.kind}`}>
              <div className="log__meta">
                Round {entry.round} · {formatPhase(entry.phase)}
              </div>
              <div className="log__text">{entry.text}</div>
            </div>
          ))}
          <div ref={endRef} />
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
