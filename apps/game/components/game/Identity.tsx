import { NationFlag, nationName } from '@/components/game/NationFlag';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { COMPETITIONS, NATIONS, getClub, positionLabel, type PlayerMock } from '@/lib/game-data';
import type { CareerFixture, CareerState } from '@/lib/career/types';
import { averageRating } from '@/lib/career/types';
import { getCareerClubSquad, getCareerSquad } from '@/lib/career/careerWorld';
import { getLiveStandings } from '@/lib/career/standings';
import { isSelectableForMatch, resolveStatusLabel, type PlayerAvailability } from '@/lib/career/playerStatus';
import { playerAgeAtDate } from '@/lib/development/developmentIntegration';
import { squadEnergy } from '@/lib/career/management';
import { matchFitnessOf } from '@/lib/players/matchFitness';
import { SQUAD_STATUS_TIER_LABEL_SV } from '@/lib/career/squadStatus';
import { currentTeamRoles } from '@/lib/career/teamRoles';
import { ClubLink, PlayerLink } from '@/components/entityLinks';
import ClubCrest from '@/components/ClubCrest';
import FormDots from '@/components/FormDots';
import { ENVIRONMENTS } from '@/components/clubhq/environments';
import { svOrdinal } from "@/lib/format/ordinal";

export function clubColorVars(club?: { primaryColor?: string; secondaryColor?: string } | null): CSSProperties {
  if (!club) return {};
  return {
    "--club-primary": club.primaryColor || "#d4943a",
    "--club-secondary": club.secondaryColor || "#3b82f6",
  } as CSSProperties;
}

type PersonIdentity = Pick<PlayerMock, 'id' | 'firstName' | 'lastName' | 'position' | 'shirtNumber'> & {
  nationality?: string | null;
  clubId?: string;
};

const AVAILABILITY_LABEL: Record<PlayerAvailability,string> = {
  AVAILABLE: 'Tillgänglig',
  INJURED: 'Skadad',
  SUSPENDED: 'Avstängd',
  RECOVERING: 'Under återhämtning',
  LIMITED: 'Begränsad återgång',
  ON_PLACEMENT: 'Hos partnerklubb',
  NATIONAL_TEAM: 'Med landslaget'
};

export function playerAvailabilityLabel(career: CareerState, playerId: string) {
  return AVAILABILITY_LABEL[career.playerStatuses[playerId]?.availability ?? 'AVAILABLE'];
}

export function JerseyGlyph({
  number,
  position,
  primaryColor,
  secondaryColor,
  size = 38,
}: {
  number?: number | string | null;
  position?: string;
  primaryColor?: string;
  secondaryColor?: string;
  size?: number;
}) {
  const isGoalkeeper = position === "MV";
  const fill = isGoalkeeper ? (secondaryColor || "#0ea5e9") : (primaryColor || "var(--game-club-primary, #1f3556)");
  const trim = isGoalkeeper ? (primaryColor || "#e2e8f0") : (secondaryColor || "var(--game-jersey-line, #d4943a)");

  return (
    <span
      className="game-player-glyph"
      style={{ "--glyph-size": `${size}px`, color: fill, "--game-jersey-line": trim } as CSSProperties}
      aria-hidden="true"
    >
      <svg viewBox="0 0 160 176" fill="none">
        <path
          d="m48 17 20-8c5 12 19 12 24 0l20 8 40 35-25 33-16-11 5 90H44l5-90-16 11L8 52Z"
          fill="currentColor"
        />
        <path
          d="m48 17 20-8c5 12 19 12 24 0l20 8M49 74l-1-42m63 42 1-42M44 145h72"
          stroke="var(--game-jersey-line)"
          strokeWidth="3"
        />
        {number !== undefined && number !== null && (
          <text x="80" y="106" textAnchor="middle" className="game-jersey-number">
            {number}
          </text>
        )}
        {position && (
          <text x="80" y="135" textAnchor="middle" className="game-jersey-position">
            {position}
          </text>
        )}
      </svg>
    </span>
  );
}

export function PlayerGlyph({ player, size = 48 }: { player: PersonIdentity; size?: number }) {
  const club = player.clubId ? getClub(player.clubId) : undefined;
  return (
    <JerseyGlyph
      number={player.shirtNumber ?? `${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`}
      position={player.position}
      primaryColor={club?.primaryColor}
      size={size}
    />
  );
}

export function PlayerCell({
  player,
  jerseyNumber,
  children,
}: {
  player: PersonIdentity;
  jerseyNumber?: number;
  children?: ReactNode;
}) {
  const club = player.clubId ? getClub(player.clubId) : undefined;
  const resolvedNumber = jerseyNumber ?? player.shirtNumber;
  return (
    <span className="game-player-cell">
      <JerseyGlyph
        number={resolvedNumber ?? `${player.firstName[0] ?? ''}${player.lastName[0] ?? ''}`}
        position={player.position}
        primaryColor={club?.primaryColor}
        size={34}
      />
      <span>
        <span className="hm-with-flag">
          <PlayerLink playerId={player.id} stopPropagation>
            {player.firstName} {player.lastName}
          </PlayerLink>
          {player.nationality && player.nationality !== 'UNK' && <NationFlag code={player.nationality} />}
        </span>
        <small>
          {player.position}
          {resolvedNumber !== null && resolvedNumber !== undefined ? ` · #${resolvedNumber}` : ''}
        </small>
        {children}
      </span>
    </span>
  );
}

export function RankIndicator({ position, label }: { position: number | string; label?: string }) {
  return (
    <span className="game-rank">
      <strong>{position}</strong>
      {label && <small>{label}</small>}
    </span>
  );
}

export function PlayerHero({ player, career, children }: { player: PlayerMock; career: CareerState; children?: ReactNode }) {
  const stats = career.playerSeasonStats[player.id];
  const own = player.clubId === career.playerClubId;
  const club = player.clubId ? getClub(player.clubId) : undefined;
  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, career.gameDate);
  const nationality =
    NATIONS.find((n) => n.code === player.nationality)?.name ??
    nationName(player.nationality) ??
    (player.nationality === 'UNK' || !player.nationality ? 'Nationalitet okänd' : player.nationality);
  const tier = career.playerSquadStatus[player.id];
  const status =
    player.clubId === 'retired'
      ? 'Pensionerad'
      : !player.clubId
      ? 'Kontraktslös'
      : own
      ? playerAvailabilityLabel(career, player.id)
      : resolveStatusLabel(career.playerStatuses, player);
  const tierLabel = own && tier ? SQUAD_STATUS_TIER_LABEL_SV[tier] : null;
  const roles = own ? currentTeamRoles(career) : null;
  const isCaptain = roles?.captainId === player.id;
  const isViceCaptain = roles?.viceCaptainId === player.id;
  const sevenMeterIndex = roles ? roles.penaltyTakers.indexOf(player.id) : -1;

  return (
    <header className="game-player-hero xp-photo-hero" data-own={own} data-player-id={player.id} style={{ ...clubColorVars(club), ...ENVIRONMENTS["dressing-room"].backdropStyle }}>
      <div className="game-player-portrait">
        <PlayerGlyph player={player} size={220} />
        <span className="game-portrait-initials">
          {player.firstName[0]}
          {player.lastName[0]}
        </span>
      </div>
      <div className="game-player-identity">
        <div className="game-overline">
          {positionLabel(player.position)}
          {player.secondaryPosition ? ` / ${positionLabel(player.secondaryPosition)}` : ''}{' '}
          <span>#{player.shirtNumber ?? '—'}</span>
        </div>
        <p className="game-player-firstname">{player.firstName}</p>
        <h1>{player.lastName}</h1>
        <div className="game-person-facts">
          <span>{age !== null ? `${age} år` : 'Ålder okänd'}</span>
          <span className="hm-with-flag">
            <NationFlag code={player.nationality} />
            {nationality}
          </span>
          {club ? (
            <ClubLink clubId={club.id}>{club.name}</ClubLink>
          ) : (
            <span>{player.clubId === 'retired' ? 'Avslutad spelarkarriär' : 'Fri agent'}</span>
          )}
        </div>
        <div className="game-person-status">
          <span className="game-status-chip">{status}</span>
          {tierLabel && tierLabel !== status && <span>{tierLabel}</span>}
          {isCaptain && <span className="hm-badge" data-tone="accent">Lagkapten (K)</span>}
          {isViceCaptain && <span className="hm-badge" data-tone="info">Vicekapten (VK)</span>}
          {sevenMeterIndex >= 0 && (
            <span className="hm-badge" data-tone="good">
              7m #{sevenMeterIndex + 1}
            </span>
          )}
          {career.playerContracts[player.id] && <span>Avtal till {career.playerContracts[player.id].contractEndDate}</span>}
        </div>
        {children}
      </div>
      <div className="game-player-season">
        <span className="game-overline">Säsong {career.seasonId}</span>
        <div className="game-hero-stats">
          <div>
            <strong>{stats?.appearances ?? 0}</strong>
            <small>Matcher</small>
          </div>
          <div>
            <strong>{player.position === 'MV' ? stats?.saves ?? 0 : stats?.goals ?? 0}</strong>
            <small>{player.position === 'MV' ? 'Räddningar' : 'Mål'}</small>
          </div>
          <div>
            <strong>{stats?.appearances ? averageRating(stats).toFixed(1) : '—'}</strong>
            <small>Snittbetyg</small>
          </div>
        </div>
        {own && (
          <div className="game-condition">
            <span>
              Energi <strong>{Math.round(squadEnergy(career, player))}%</strong> · Matchträning{' '}
              <strong>{Math.round(matchFitnessOf(career, player.id))}%</strong>
            </span>
            <meter
              min="0"
              max="100"
              value={squadEnergy(career, player)}
              aria-label={`${player.firstName} ${player.lastName}: energi`}
            />
          </div>
        )}
      </div>
    </header>
  );
}

export function ClubHero({ clubId, career, children }: { clubId: string; career: CareerState; children?: ReactNode }) {
  const club = getClub(clubId);
  if (!club) return null;
  const table = club.competitionId === career.competitionId ? getLiveStandings(career) : [];
  const row = table.find((r) => r.clubId === clubId);
  return (
    <header className="game-club-hero xp-photo-hero" style={{ ...clubColorVars(club), ...ENVIRONMENTS["arena-club"].backdropStyle }}>
      <div className="game-club-mark">
        <ClubCrest shortName={club.shortName} primaryColor={club.primaryColor} clubId={club.id} size={112} />
      </div>
      <div className="game-club-heading">
        <div className="game-overline">
          {clubId === career.playerClubId ? 'Din klubb' : 'Klubben i handbollsvärlden'} · {career.seasonId}
        </div>
        <h1>{club.name}</h1>
        <div className="game-person-facts">
          <Link href={`/career/competitions/${club.competitionId}`}>
            {COMPETITIONS.find((c) => c.id === club.competitionId)?.name ?? 'Tävling'}
          </Link>
          {club.city && <span>{club.city}</span>}
          {club.founded && <span>Grundad {club.founded}</span>}
        </div>
        <div className="game-club-form">
          <span>Senaste fem</span>
          <FormDots results={career.clubForm[clubId] ?? []} />
        </div>
        {children}
      </div>
      <div className="game-club-record">
        {row ? (
          <>
            <RankIndicator position={row.played > 0 ? table.indexOf(row) + 1 : '—'} label="i ligan" />
            <div>
              <strong>{row.points}</strong>
              <span>poäng · {row.played} matcher</span>
            </div>
          </>
        ) : (
          <div>
            <strong>{getCareerClubSquad(career, clubId).length}</strong>
            <span>spelare i karriären</span>
          </div>
        )}
      </div>
    </header>
  );
}

export function CompetitionHero({
  competitionId,
  career,
  children,
}: {
  competitionId: string;
  career: CareerState;
  children?: ReactNode;
}) {
  const competition = COMPETITIONS.find((c) => c.id === competitionId);
  if (!competition) return null;
  const own = competitionId === career.competitionId;
  const fixtures = career.fixtures.filter((f) => f.competitionId === competitionId && f.type === 'LEAGUE');
  const next = [...fixtures].filter((f) => !career.results[f.id]).sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <header className="game-competition-hero">
      <div className="game-league-emblem" aria-hidden="true">
        <svg viewBox="0 0 80 100">
          <path d="M18 10h44v35L40 74 18 45Z" fill="none" stroke="currentColor" strokeWidth="3" />
          <path
            d="M18 20H6v16c0 13 8 20 20 20m36-36h12v16c0 13-8 20-20 20M40 74v15m-14 4h28"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle cx="40" cy="34" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
      <div>
        <div className="game-overline">
          {NATIONS.find((n) => n.code === competition.nation)?.name ?? competition.nation} · Säsong {career.seasonId}
        </div>
        <h1>{competition.name}</h1>
        <p>
          {own
            ? `${fixtures.filter((f) => career.results[f.id]).length} av ${fixtures.length} ligamatcher spelade${
                next ? ` · Nästa ligaomgång ${next.round}` : ''
              }`
            : 'Klubbar och spelare i handbollsvärlden'}
        </p>
        {children}
      </div>
      <div className="game-league-round">
        <span>{own && next ? 'NÄSTA OMGÅNG' : 'SÄSONG'}</span>
        <strong>{own && next ? String(next.round).padStart(2, '0') : career.seasonId.split('/')[0]}</strong>
      </div>
    </header>
  );
}

export function Scoreboard({
  homeClubId,
  awayClubId,
  homeScore,
  awayScore,
  label,
  children,
}: {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
  label: string;
  children?: ReactNode;
}) {
  const home = getClub(homeClubId);
  const away = getClub(awayClubId);
  return (
    <header className="game-scoreboard">
      <div className="game-scoreboard-top">
        <span className="game-overline">{label}</span>
        {children}
      </div>
      <div className="game-scoreboard-teams">
        <div>
          <ClubCrest shortName={home?.shortName ?? 'H'} primaryColor={home?.primaryColor ?? ''} clubId={home?.id} size={64} />
          <ClubLink clubId={homeClubId}>{home?.shortName ?? homeClubId}</ClubLink>
        </div>
        <strong className="game-live-score">
          {homeScore}
          <span>:</span>
          {awayScore}
        </strong>
        <div>
          <ClubCrest shortName={away?.shortName ?? 'B'} primaryColor={away?.primaryColor ?? ''} clubId={away?.id} size={64} />
          <ClubLink clubId={away?.id ?? awayClubId}>{away?.shortName ?? awayClubId}</ClubLink>
        </div>
      </div>
    </header>
  );
}

export function MatchHero({
  career,
  fixture,
  result,
  context,
  children,
  compact = false,
}: {
  career: CareerState;
  fixture: CareerFixture;
  result?: FastMatchResult;
  context?: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  const table = getLiveStandings(career);
  const home = getClub(fixture.homeClubId);
  const away = getClub(fixture.awayClubId);
  const competition = COMPETITIONS.find((c) => c.id === fixture.competitionId);
  const resultLabel = result
    ? result.homeGoals === result.awayGoals
      ? 'OAVGJORT'
      : `${(result.homeGoals > result.awayGoals ? home : away)?.shortName ?? 'Laget'} vinner`
    : 'NÄSTA AVKAST';
  return (
    <section className="game-match-hero xp-photo-hero" style={ENVIRONMENTS["arena-matchday"].backdropStyle} data-compact={compact} data-played={!!result} aria-label={result ? 'Matchresultat' : 'Nästa match'}>
      <div className="game-match-top">
        <span className="game-overline">{context ?? resultLabel}</span>
        <span>
          {fixture.type === 'LEAGUE' ? competition?.name : fixture.type === 'CUP' ? 'Cupmatch' : 'Träningsmatch'} ·{' '}
          {fixture.type === 'LEAGUE' ? `Omgång ${fixture.round}` : fixture.date}
        </span>
      </div>
      <div className="game-match-teams">
        {[home, away].map((club, index) => (
          <div className="game-match-team" key={index} data-managed={club?.id === career.playerClubId}>
            <ClubCrest
              shortName={club?.shortName ?? '?'}
              primaryColor={club?.primaryColor ?? ''}
              clubId={club?.id}
              size={compact ? 64 : 104}
            />
            <div>
              <small>{index === 0 ? 'HEMMA' : 'BORTA'}</small>
              <ClubLink clubId={index === 0 ? fixture.homeClubId : fixture.awayClubId}>{club?.shortName ?? 'Klubb'}</ClubLink>
              <div className="game-match-team-state">
                {fixture.competitionId === career.competitionId &&
                  (table.find((r) => r.clubId === club?.id)?.played ?? 0) > 0 && (
                    <span>{svOrdinal(table.findIndex((r) => r.clubId === club?.id) + 1)} i ligan</span>
                  )}
                <FormDots results={career.clubForm[club?.id ?? ''] ?? []} />
              </div>
            </div>
          </div>
        ))}
        <div className="game-match-centre">
          {result ? (
            <strong>
              {result.homeGoals}
              <span>–</span>
              {result.awayGoals}
            </strong>
          ) : (
            <strong>VS</strong>
          )}
          <span>{new Date(`${fixture.date}T12:00:00Z`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
        </div>
      </div>
      <div className="game-match-bottom">
        <span>{result ? resultLabel : fixture.date === career.gameDate ? 'MATCHDAG · Idag' : `Spelas ${fixture.date}`}</span>
        <div className="hm-actions">{children}</div>
      </div>
    </section>
  );
}

export function SquadDepth({ career }: { career: CareerState }) {
  const squad = getCareerSquad(career);
  return (
    <section className="game-depth" aria-label="Truppens positionsdjup">
      <header>
        <span className="game-overline">SJU POSITIONER. ETT LAG.</span>
        <h2>Truppens balans</h2>
        <span>Primär position · tillgängliga / totalt</span>
      </header>
      <div className="game-depth-positions">
        {(['V6', 'V9', 'M9', 'M6', 'H9', 'H6', 'MV'] as const).map((position) => {
          const players = squad.filter((p) => p.position === position);
          const available = players.filter((p) => isSelectableForMatch(career.playerStatuses, p.id));
          return (
            <div className="game-depth-position" key={position} data-thin={available.length < 2}>
              <div>
                <strong>{position}</strong>
                <span>
                  {available.length}
                  <small> / {players.length}</small>
                </span>
              </div>
              <small>{positionLabel(position)}</small>
              {players.slice(0, 3).map((p) => (
                <PlayerLink key={p.id} playerId={p.id}>
                  <span className={isSelectableForMatch(career.playerStatuses, p.id) ? 'game-available-dot' : 'game-unavailable-dot'} />
                  {p.lastName}
                </PlayerLink>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
