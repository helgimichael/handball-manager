'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CareerFixture, CareerState } from '@/lib/career/types';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { ensurePostMatchPress } from '@/lib/media/postMatchPress';
import { delegatePress, skipPress } from '@/lib/media/press';

export function PostMatchPressBanner({
  fixture,
  result,
  career,
  updateCareer,
}: {
  fixture: CareerFixture;
  result: FastMatchResult;
  career: CareerState;
  updateCareer: (fn: (c: CareerState) => CareerState) => void;
}) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const pressId = `press:post:${fixture.id}`;
  const press = career.media?.press?.[pressId];

  useEffect(() => {
    if (!press && (fixture.homeClubId === career.playerClubId || fixture.awayClubId === career.playerClubId)) {
      updateCareer(c => ensurePostMatchPress(c, fixture, result));
    }
  }, [fixture.id, press, career.playerClubId]);

  if (!press) return null;

  function handleDelegate() {
    try {
      updateCareer(c => delegatePress(c, pressId, () => {}));
      setFeedback('Assisterande tränaren tog presskonferensen och gav lugna, diplomatiska svar.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Kunde inte delegera till assisterande.');
    }
  }

  function handleSkip() {
    try {
      updateCareer(c => skipPress(c, pressId, () => {}));
      setFeedback('Du valde att inte möta pressen efter matchen.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Kunde inte hoppa över presskonferensen.');
    }
  }

  return (
    <section className="hm-panel hm-post-match-press" aria-label="Pressrum och intervjuer" style={{ marginTop: 12 }}>
      <div className="hm-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 'var(--hm-text-lg)' }}>🎤</span>
          <div>
            <strong className="hm-panel-title">Möt pressen · Intervjuer efter matchen</strong>
            <div className="hm-text-muted" style={{ fontSize: 'var(--hm-text-xs)' }}>
              Pressrummet är öppet. Journalisterna väntar på dina kommentarer.
            </div>
          </div>
        </div>
        <span
          className="hm-status"
          data-tone={press.status === 'OPEN' ? 'warning' : press.status === 'ANSWERED' ? 'ok' : 'neutral'}
        >
          {press.status === 'OPEN'
            ? `Väntar (${press.questions.length} frågor)`
            : press.status === 'ANSWERED'
            ? 'Genomförd'
            : press.status === 'DELEGATED'
            ? 'Delegerad'
            : 'Avböjd'}
        </span>
      </div>

      <div className="hm-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {feedback && (
          <div className="hm-notice" role="status" style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--hm-surface-3)' }}>
            {feedback}
          </div>
        )}

        {press.status === 'OPEN' ? (
          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: 'var(--hm-text-sm)' }}>
              Resultatet blev <strong>{result.homeGoals}–{result.awayGoals}</strong>. Tidningarna vill ställa frågor om matchens avgörande skeden, taktik och prestationer.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="hm-btn hm-btn-primary"
                onClick={() => router.push(`/career/media/press/${encodeURIComponent(pressId)}`)}
              >
                🎤 Svara personligen →
              </button>
              <button
                type="button"
                className="hm-btn"
                onClick={handleDelegate}
                title="Låt assisterande tränaren svara diplomatiskt"
              >
                📋 Delegera till assisterande
              </button>
              <button
                type="button"
                className="hm-btn"
                onClick={handleSkip}
                title="Hoppa över intervjun och lämna arenan direkt"
              >
                ⏭️ Hoppa över intervjun
              </button>
            </div>
          </div>
        ) : press.status === 'ANSWERED' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 'var(--hm-text-sm)' }}>
                Presskonferensen är avslutad och dina svar har publicerats i media.
              </p>
            </div>
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => router.push(`/career/media/press/${encodeURIComponent(pressId)}`)}
            >
              Läs citat & referat →
            </button>
          </div>
        ) : press.status === 'DELEGATED' ? (
          <p style={{ margin: 0, fontSize: 'var(--hm-text-sm)' }}>
            Assisterande tränaren skötte presskonferensen och representerade klubben diplomatiskt.
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--hm-text-sm)', color: 'var(--hm-text-muted)' }}>
            Presskonferensen avböjdes.
          </p>
        )}
      </div>
    </section>
  );
}

