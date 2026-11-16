'use client';
/**
 * MDY-02l (A) -- the continuous 2D court as the Match Center's "Plan" view: players as numbered circles in the
 * clubs' own colours, the ball, and optional trails (the last seconds of recorded positions). Moved here from
 * ProductionMatchView so live play and archive replay share one renderer. Reads the frame buffer only.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchFrame, MatchPerson, ProductionMatchSession } from '@/lib/career/productionMatch';
import { frameAt } from '@/lib/career/matchFrames';
import { playbackTick } from '@/lib/career/matchPlayback';
import { inkOn, matchColors } from '@/lib/matchday/matchday';

/** View options owned by the Match Center's Plan tab (trails on/off), read by whichever court renders inside it. */
export const PlanOptions = createContext<{ trails: boolean }>({ trails: false });
/** Trail length: three seconds of match time (50 ms ticks). */
export const TRAIL_TICKS = 60;

/** Recorded frames in the trail window ending at `tick` (ascending). Never extrapolates past the buffer. */
export function trailFrames(frames: readonly MatchFrame[], tick: number, span = TRAIL_TICKS): MatchFrame[] {
    const out: MatchFrame[] = [];
    for (let i = frames.length - 1; i >= 0; i--) {
        const t = frames[i][0];
        if (t > tick) continue;
        if (t < tick - span) break;
        out.push(frames[i]);
    }
    return out.reverse();
}

// HM-ALPHA3-M09 (E3): the clubs' own colours on the court -- readable on the floor, never two similar kits.
export function Court({ frame, people, colors = { home: '#4da5ef', away: '#ef775f' }, trail = [] }: { frame: MatchFrame; people: MatchPerson[]; colors?: { home: string; away: string }; trail?: readonly MatchFrame[] }) {
    const paths = useMemo(() => {
        if (trail.length < 2) return [];
        const byPerson = new Map<number, string[]>();
        for (const f of trail) for (let at = 7; at + 2 < f.length; at += 3) {
            const list = byPerson.get(f[at]) ?? [];
            list.push(`${4000 - f[at + 2]},${f[at + 1]}`);
            byPerson.set(f[at], list);
        }
        return [...byPerson.entries()].filter(([, pts]) => pts.length > 1).map(([index, pts]) => ({ index, points: pts.join(' ') }));
    }, [trail]);
    return <svg data-render-tick={frame[0]} viewBox="-150 -100 4300 2200" aria-label="Handbollsplan med matchens spelare och boll" style={{ width: '100%', maxHeight: '64vh', minHeight: 240 }}>
        <g transform="matrix(0 1 -1 0 4000 0)">
            <rect x="0" y="0" width="2000" height="4000" rx="10" fill="#173e51" stroke="#d2e7ee" strokeWidth="8" />
            <g fill="none" stroke="#d2e7ee" strokeWidth="7">
                <path d="M0 2000 H2000" /><circle cx="1000" cy="2000" r="200" />
                <path d="M250 0 A600 600 0 0 0 850 600 H1150 A600 600 0 0 0 1750 0 M250 4000 A600 600 0 0 1 850 3400 H1150 A600 600 0 0 1 1750 4000" />
                <path strokeDasharray="25 20" d="M0 0 A1000 900 0 0 0 2000 0 M0 4000 A1000 900 0 0 1 2000 4000" />
                <path d="M850 0 V-90 H1150 V0 M850 4000 V4090 H1150 V4000 M900 700 H1100 M900 3300 H1100" />
            </g>
        </g>
        {paths.length > 0 && <g className="mc-plan-trails" fill="none" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" opacity=".55">
            {paths.map(p => { const person = people[p.index]; return person ? <polyline key={person.id} points={p.points} stroke={person.team === 'HOME' ? colors.home : colors.away} /> : null; })}
        </g>}
        {Array.from({ length: Math.floor((frame.length - 7) / 3) }, (_, n) => {
            const at = 7 + n * 3, person = people[frame[at]];
            if (!person) return null;
            return <g key={person.id} transform={`translate(${4000 - frame[at + 2]} ${frame[at + 1]})`}><circle r="43" fill={person.team === 'HOME' ? colors.home : colors.away} stroke={person.role === 'GK' ? '#ffe6a0' : '#fff'} strokeWidth="7" /><text textAnchor="middle" dominantBaseline="central" fill={inkOn(person.team === 'HOME' ? colors.home : colors.away)} fontSize="35" fontWeight="700">{person.number}</text><title>{person.name}</title></g>;
        })}
        <circle cx={4000 - frame[6]} cy={frame[5]} r="20" fill="#ffdc5b" stroke="#182c38" strokeWidth="5" />
    </svg>;
}

/** A display may trail the engine, but never extrapolates beyond its buffer. */
export function LiveCourt({ session, playing, speed }: { session: ProductionMatchSession; playing: boolean; speed: number }) {
    const latest = useRef(session);
    useEffect(() => { latest.current = session; }, [session]);
    const cursor = useRef(session.core.tick), [tick, setTick] = useState(session.core.tick);
    const { trails } = useContext(PlanOptions);
    useEffect(() => {
        if (!playing) return;
        let request = 0, last: number | null = null;
        const render = (now: number) => {
            const elapsed = last === null || document.hidden ? 0 : now - last; last = now;
            cursor.current = playbackTick(cursor.current, elapsed, speed, latest.current.core.tick);
            setTick(cursor.current); request = requestAnimationFrame(render);
        };
        request = requestAnimationFrame(render); return () => cancelAnimationFrame(request);
    }, [playing, speed]);
    return <Court frame={frameAt(session.frames, tick)} people={session.people} colors={matchColors(session.fixture.homeClubId, session.fixture.awayClubId)} trail={trails ? trailFrames(session.frames, tick) : undefined} />;
}

/** The static court used while the match is being auto-simulated to full time. */
export function SnapshotCourt({ frame, session }: { frame: MatchFrame; session: ProductionMatchSession }) {
    return <Court frame={frame} people={session.people} colors={matchColors(session.fixture.homeClubId, session.fixture.awayClubId)} />;
}
