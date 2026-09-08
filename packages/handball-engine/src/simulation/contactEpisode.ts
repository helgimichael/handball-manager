/**
 * MATCH-EXPERIENCE-2.0 M19: ORGANIZED CONTACT RESOLUTION.
 *
 * A duel is one event, and it gets one answer.
 *
 * WHY IT MATTERS. Until now the engine asked, every twentieth of a second, "does
 * this contact cost the attack something?" -- and asked it again the next step,
 * and the next, while the same two men leaned on each other. That is not how a
 * duel works and it is not a rate the number could ever be right for: the same
 * physical event was priced once if it lasted a step and twenty times if it
 * lasted a second, so the parameter was really measuring duration. M18 made the
 * mismatch visible by defining contact properly. Real contact episodes are
 * short, so the inherited per-step chance produced roughly one organized free
 * throw in two thousand possessions, and 97% of every foul in a match still
 * came from the break.
 *
 * WHAT M19 DOES. It gives the duel an identity -- these two men, from this
 * moment -- and resolves it ONCE. Whether anything comes of it is decided from
 * what M18 already says about the situation: a defender who is set and goal-side
 * has no need to foul, two men converging shoulder to shoulder often produce
 * one, and a man who has been beaten and is recovering from behind is in the
 * position from which fouls are actually committed.
 *
 * WHAT IT DOES NOT DO. It does not decide what a foul is worth. It answers one
 * question -- did this episode produce illegal contact? -- and M10 still decides
 * independently whether that is a free throw or a 7 metre, and whether it was
 * worth two minutes. No rule logic lives here.
 */
import type { ContactContext, ContactPosture } from "./defensiveReach";
import type { PossessionRng } from "./possessionRng";

// ---------------------------------------------------------------------------
// Episode identity and lifecycle
// ---------------------------------------------------------------------------

/**
 * One duel: these two men, from this moment.
 *
 * Identity is the carrier and the defender actually in the contact. Nothing
 * else is needed -- a new carrier is a new situation by definition, and a new
 * defender arriving is a new duel even if the old one had only just ended.
 */
export type ContactEpisode = {
  readonly carrierId: string;
  readonly defenderId: string;
  /** Spatial clock at first contact. */
  readonly startedAt: number;
  /** Spatial clock at the most recent step in which the two were still in contact. */
  readonly lastContactAt: number;
  /**
   * The posture this episode was decided at, or null while it is still owed a
   * decision. Once it is set the duel is finished as far as resolution goes,
   * however long the two men stay together and however the situation develops.
   */
  readonly resolvedAt: ContactPosture | null;
};

/**
 * How long two players may lose contact and still be in the same duel.
 *
 * Bodies in a duel come apart and back together constantly, and the contact
 * test is evaluated on a twentieth-of-a-second grid. Without a little tolerance
 * a single frame of separation would end the episode and the next frame would
 * start a fresh one, which is the per-step lottery again wearing an episode's
 * clothes. Long enough to absorb the jostling; far too short to bridge a
 * defender being beaten, a pass away, and a different defender stepping up.
 */
export const EPISODE_BREAK_SECONDS = 0.4;

export type EpisodeStep = {
  /** The episode after this step, or null when there is no live duel. */
  readonly episode: ContactEpisode | null;
  /** True when this step began a NEW episode rather than continuing one. */
  readonly started: boolean;
};

/**
 * Advance the duel by one simulation step.
 *
 * Pure and total: the same episode, contact and clock always produce the same
 * result, and there is no clock here but the simulation's own.
 */
export function advanceEpisode(
  current: ContactEpisode | null,
  contact: ContactContext | null,
  carrierId: string,
  now: number,
): EpisodeStep {
  const live = current !== null && now - current.lastContactAt <= EPISODE_BREAK_SECONDS ? current : null;

  if (contact === null) {
    // Not in contact this step. The duel survives a brief separation and then
    // genuinely ends.
    return { episode: live, started: false };
  }

  if (live !== null && live.carrierId === carrierId && live.defenderId === contact.defenderId) {
    return { episode: { ...live, lastContactAt: now }, started: false };
  }

  return {
    episode: {
      carrierId,
      defenderId: contact.defenderId,
      startedAt: now,
      lastContactAt: now,
      resolvedAt: null,
    },
    started: true,
  };
}

/**
 * Whether this episode is still owed a decision.
 *
 * Exactly once per episode, and no exceptions. It is tempting to reopen a duel
 * when the defender ends up beaten -- that is where fouls really come from, and
 * it genuinely feels like a new situation. It is not one, and allowing it would
 * quietly undo the whole point of M19: the same two men, still together, would
 * get a second roll because the geometry between them drifted across a
 * threshold. That is the per-step lottery again, only slower and harder to see.
 *
 * A defender who is beaten and recovering DOES get his own decision -- when the
 * duel that produced it is a real one. The lifecycle already says what real
 * means: a genuine break of more than `EPISODE_BREAK_SECONDS`, a new carrier, or
 * a different defender arriving.
 */
export function episodeNeedsResolving(episode: ContactEpisode): boolean {
  return episode.resolvedAt === null;
}

/** Record that the episode has been decided, and at which posture. */
export function markResolved(episode: ContactEpisode, posture: ContactPosture): ContactEpisode {
  return { ...episode, resolvedAt: posture };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * What the duel came to.
 *
 * Deliberately three outcomes and not two. Most contact in handball produces
 * nothing at all -- the attacker absorbs it and plays on -- and a resolver that
 * had to choose between "foul" and "turnover" would have to invent one of them
 * every time two men met.
 */
export type ContactResolution = "NOTHING" | "DEFENCE_WINS_BALL" | "ILLEGAL_CONTACT";

/**
 * What each kind of contact tends to become.
 *
 * These come from what the postures MEAN, not from a target foul count.
 *
 * CLEANLY_CONTAINED is a defender who got there first and is set in front of
 * the man. He does not need to foul, and mostly he does not: the attacker meets
 * a wall and passes off. He also rarely takes the ball, because a set defender
 * in a 6:0 is stopping a drive, not stealing.
 *
 * LEGAL_CONTACT is the real duel -- both men arriving at the same place at the
 * same time, shoulder against shoulder. It is the highest base of the three,
 * because it is the contact in which there is actually something to hold.
 *
 * BEATEN is lower than it looks like it should be, and the reason is worth
 * writing down. Being beaten is not itself a foul and usually costs nothing:
 * the man goes past, the defender turns and recovers, and the attack carries on
 * into the next pass. Measured over the bench, four out of five organized
 * contact episodes are this -- a defender a fraction behind the carrier's line
 * as he moves across the front of the defence. Pricing that as the desperate
 * hold from behind produced 27 organized fouls a match, which is not handball.
 * What makes a beaten defender foul is not being beaten; it is being beaten
 * WHILE arriving hard and WITHOUT cover, and both of those are multipliers
 * below rather than part of this number.
 *
 * His chance of cleanly WINNING the ball is near zero for the same reason. From
 * behind a man there is no legal way to take it off him -- that is precisely why
 * the foul is the thing he does instead. It is not zero only because a carrier
 * can still lose it against a trailing defender's hand.
 */
const POSTURE_OUTCOMES: Readonly<Record<ContactPosture, { readonly illegal: number; readonly ballWon: number }>> = Object.freeze({
  CLEANLY_CONTAINED: { illegal: 0.04, ballWon: 0.05 },
  LEGAL_CONTACT: { illegal: 0.14, ballWon: 0.06 },
  BEATEN: { illegal: 0.12, ballWon: 0.008 },
});

/** Neutral defending rating: at 10 a defender is exactly the posture's own numbers. */
const DEFAULT_RATING = 10;
/** Each point of defending buys this much less fouling... */
const RATING_ILLEGAL_SCALE = 0.03;
/** ...and this much more chance of simply taking the ball. */
const RATING_BALL_WON_SCALE = 0.05;

/**
 * The closing speed at which a convergence is a full-blooded collision.
 *
 * Two players arriving at each other at three metres a second are a contact in
 * every sense; the same two drifting together at a walking pace are adjacent.
 * The posture says what KIND of situation it is, this says how much of one it
 * is -- and without it every brush along the front of the defence is priced as
 * a challenge.
 */
const FULL_CONVERGENCE_SPEED = 3.0;
/** Even the gentlest contact is still contact, so intensity never reaches zero. */
const MINIMUM_INTENSITY = 0.25;

/** A defender with cover behind him need not make the desperate challenge... */
const COVERED_ILLEGAL_SCALE = 0.7;
/** ...and one who is the last man between the ball and the goal leans on it harder. */
const EXPOSED_ILLEGAL_SCALE = 1.15;

/**
 * Resolve one contact episode.
 *
 * Called exactly once per episode (twice only on a one-way escalation into
 * BEATEN), from the ordinary possession RNG stream, so the whole thing stays
 * deterministic under a seed.
 *
 * Posture is never a verdict here: every posture can produce every outcome. It
 * changes how likely each one is, which is the whole of what a posture means.
 */
export function resolveContactEpisode(contact: ContactContext, defending: number, rng: PossessionRng): ContactResolution {
  const base = POSTURE_OUTCOMES[contact.posture];
  const rating = defending - DEFAULT_RATING;
  const intensity = MINIMUM_INTENSITY + (1 - MINIMUM_INTENSITY) * Math.min(1, contact.closingSpeed / FULL_CONVERGENCE_SPEED);
  const cover = contact.helpArrives ? COVERED_ILLEGAL_SCALE : EXPOSED_ILLEGAL_SCALE;

  const illegal = Math.max(0, base.illegal * intensity * cover * (1 - rating * RATING_ILLEGAL_SCALE));
  // A ball is won by reading the man, not by running into him, so the clean win
  // is deliberately not scaled by how hard the two arrived.
  const ballWon = Math.max(0, base.ballWon * (1 + rating * RATING_BALL_WON_SCALE));

  if (rng.chance(illegal)) return "ILLEGAL_CONTACT";
  if (rng.chance(ballWon)) return "DEFENCE_WINS_BALL";
  return "NOTHING";
}
