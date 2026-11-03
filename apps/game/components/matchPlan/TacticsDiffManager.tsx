'use client';
import { useState } from 'react';
import type { PlayerMock } from '@/lib/game-data';
import type { MatchPlan } from '@/lib/matchPlan/types';
import {
  deriveTacticalDiff,
  assignDefenderSpecialist,
  removeDefenderSpecialist,
  clearAllExchanges,
  getZoneLabel,
  type TacticalDiff,
} from '@/lib/matchPlan/tacticsDiffWorkflow';
import { PlayerGlyph } from '@/components/game/Identity';
import { defenceSystemKey } from '@/lib/matchPlan/engineMatchPlan';

export function TacticsDiffManager({
  plan,
  squad,
  save,
  onSelectCourtMode,
}: {
  plan: MatchPlan;
  squad: readonly PlayerMock[];
  save: (edit: MatchPlan | ((current: MatchPlan) => MatchPlan)) => void;
  onSelectCourtMode?: (mode: any) => void;
}) {
  const diff: TacticalDiff = deriveTacticalDiff(plan, squad);
  const defKey = defenceSystemKey(plan);
  const starters = new Set(plan.attackStartingUnit.slots.map(s => s.playerId));
  const squadIds = new Set(plan.squad.players.map(p => p.playerId));
  const benchOutfield = squad.filter(p => squadIds.has(p.id) && !starters.has(p.id) && p.position !== 'MV');
  const attackOutfield = squad.filter(p => starters.has(p.id) && p.position !== 'MV');

  const [selectedAtkId, setSelectedAtkId] = useState<string>('');
  const [selectedDefId, setSelectedDefId] = useState<string>('');

  function handleCreatePair() {
    if (!selectedAtkId || !selectedDefId) return;
    save(current => ({
      ...current,
      substitutionPairs: [
        ...current.substitutionPairs.filter(p => p.attackPlayerId !== selectedAtkId && p.defencePlayerId !== selectedDefId),
        { attackPlayerId: selectedAtkId, defencePlayerId: selectedDefId },
      ],
    }));
    setSelectedAtkId('');
    setSelectedDefId('');
  }

  return (
    <div className="hm-tactics-diff-board" id="plan-exchanges">
      <header className="hm-diff-header">
        <div>
          <span className="hm-eyebrow">Försvarsbyten & Diff-analys</span>
          <h3>Anfall ↔ Försvar · Bytesöversikt</h3>
          <p className="hm-text-muted">
            Handboll tillåter obegränsat antal byten vid egen byteszon. Här ser du exakt vem som spelar båda vägar,
            och vem som byter vid bollinnehavsbyte.
          </p>
        </div>
        <div className="hm-actions">
          {diff.totalExchanges > 0 && (
            <button
              type="button"
              className="hm-btn hm-btn-sm"
              onClick={() => save(clearAllExchanges)}
            >
              Nollställ alla byten (spela båda vägar)
            </button>
          )}
        </div>
      </header>

      {/* 3-way Diff Columns */}
      <div className="hm-diff-grid">
        {/* Column 1: Both Ways */}
        <div className="hm-diff-col" data-tone="neutral">
          <div className="hm-diff-col-head">
            <span className="hm-diff-badge" data-tone="ok">⚔️ Båda vägar</span>
            <strong>{diff.twoWayPlayers.length} utespelare</strong>
            <small>Anfaller och försvarar</small>
          </div>
          <div className="hm-diff-player-list">
            {diff.twoWayPlayers.map(p => (
              <div key={p.id} className="hm-diff-player-chip">
                <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                <div>
                  <strong>{p.firstName} {p.lastName}</strong>
                  <small>{p.position} · {p.energy}% energi</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Attack Only */}
        <div className="hm-diff-col" data-tone="warning">
          <div className="hm-diff-col-head">
            <span className="hm-diff-badge" data-tone="warning">🏃 Endast anfall</span>
            <strong>{diff.attackOnlyPlayers.length} anfallare</strong>
            <small>Byts ut vid försvarsomställning</small>
          </div>
          <div className="hm-diff-player-list">
            {diff.attackOnlyPlayers.length === 0 ? (
              <p className="hm-diff-empty-note">Inga rena anfallare valda. Alla utespelare försvarar.</p>
            ) : (
              diff.attackOnlyPlayers.map(p => (
                <div key={p.id} className="hm-diff-player-chip" data-status="attack-only">
                  <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                  <div>
                    <strong>{p.firstName} {p.lastName}</strong>
                    <small>{p.position} · Byter till bänken</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Defence Only (Specialists) */}
        <div className="hm-diff-col" data-tone="info">
          <div className="hm-diff-col-head">
            <span className="hm-diff-badge" data-tone="info">🛡️ Endast försvar</span>
            <strong>{diff.defenceOnlyPlayers.length} specialister</strong>
            <small>Byts in från bänken vid försvar</small>
          </div>
          <div className="hm-diff-player-list">
            {diff.defenceOnlyPlayers.length === 0 ? (
              <p className="hm-diff-empty-note">Inga försvarsspecialister aktiva från bänken.</p>
            ) : (
              diff.defenceOnlyPlayers.map(p => (
                <div key={p.id} className="hm-diff-player-chip" data-status="defence-only">
                  <span className="hm-shirt-number">{p.shirtNumber ?? '—'}</span>
                  <div>
                    <strong>{p.firstName} {p.lastName}</strong>
                    <small>{p.position} · Försvarar på planen</small>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Pair Creator Section */}
      {benchOutfield.length > 0 && attackOutfield.length > 0 && (
        <div className="hm-panel" style={{ marginTop: 12, padding: 12, background: 'var(--hm-surface-2)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <strong style={{ fontSize: 'var(--hm-text-sm)' }}>Snabbkoppla bytespar</strong>
              <div className="hm-text-muted" style={{ fontSize: 'var(--hm-text-xs)' }}>
                Välj en startande anfallare och en bänkspelare för att skapa ett försvarsbyte med ett klick.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 'var(--hm-text-xs)' }}>
                Anfallare:
                <select
                  aria-label="Välj anfallare för byte"
                  value={selectedAtkId}
                  onChange={e => setSelectedAtkId(e.target.value)}
                  style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4 }}
                >
                  <option value="">-- Välj startspelare --</option>
                  {attackOutfield.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.shirtNumber ?? '—'} {p.lastName} ({p.position})
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ fontSize: 'var(--hm-text-xs)' }}>
                Försvarare (bänk):
                <select
                  aria-label="Välj försvarsspecialist från bänken"
                  value={selectedDefId}
                  onChange={e => setSelectedDefId(e.target.value)}
                  style={{ marginLeft: 4, padding: '4px 8px', borderRadius: 4 }}
                >
                  <option value="">-- Välj bänkspelare --</option>
                  {benchOutfield.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.shirtNumber ?? '—'} {p.lastName} ({p.position})
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="hm-btn hm-btn-sm hm-btn-primary"
                disabled={!selectedAtkId || !selectedDefId}
                onClick={handleCreatePair}
              >
                Koppla bytespar (⇄)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Substitution Pairs Section */}
      <div className="hm-exchange-pairs-box">
        <div className="hm-exchange-pairs-head">
          <div>
            <h4>Aktiva bytespar ({diff.activePairs.length})</h4>
            <span className="hm-text-muted">Parvis anfall–försvarsbyte vid bollinnehav</span>
          </div>
          <span className="hm-status" data-tone={diff.isBalanced ? 'ok' : 'warning'}>
            {diff.isBalanced ? 'Balanserad uppställning (6 anfall / 6 försvar)' : 'Obalanserat antal byten'}
          </span>
        </div>

        {diff.activePairs.length === 0 ? (
          <div className="hm-exchange-empty">
            <p>
              Inga försvarsbyten är konfigurerade. Hela startsjuan spelar både framåt och bakåt.
            </p>
            {benchOutfield.length > 0 && (
              <p className="hm-text-muted">
                Vill du spara energi på en anfallare? Välj ett par i snabbkopplingen ovan eller klicka på en spelare i taktiktavlan.
              </p>
            )}
          </div>
        ) : (
          <div className="hm-exchange-pair-grid">
            {diff.activePairs.map((pair) => (
              <div key={`${pair.attackPlayer.id}-${pair.defencePlayer.id}`} className="hm-exchange-card">
                <div className="hm-exchange-card-side">
                  <span className="hm-eyebrow">Anfaller</span>
                  <strong>{pair.attackPlayer.firstName} {pair.attackPlayer.lastName}</strong>
                  <small>{pair.attackPlayer.position} · #{pair.attackPlayer.shirtNumber ?? '—'}</small>
                </div>

                <div className="hm-exchange-card-arrow" title="Byter vid bollinnehav">
                  <span>⇄</span>
                  <small>{pair.defensiveZoneLabel}</small>
                </div>

                <div className="hm-exchange-card-side" data-side="defence">
                  <span className="hm-eyebrow">Försvarar</span>
                  <strong>{pair.defencePlayer.firstName} {pair.defencePlayer.lastName}</strong>
                  <small>{pair.defencePlayer.position} · #{pair.defencePlayer.shirtNumber ?? '—'}</small>
                </div>

                <div className="hm-exchange-card-actions">
                  <button
                    type="button"
                    className="hm-btn hm-btn-sm"
                    title="Avbryt detta byte och låt anfallaren försvara själv"
                    onClick={() => save(current => removeDefenderSpecialist(current, pair.defensiveZone))}
                  >
                    Ta bort byte
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
