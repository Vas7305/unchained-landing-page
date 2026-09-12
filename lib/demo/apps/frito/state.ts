import { fail, ok, type DemoResult } from '@/lib/demo/service';
import {
  MIN_AGE,
  MIN_INTERESTS,
  MUTUAL_IDS,
  REPLIES,
  candidates,
  findCandidate,
  seededMatches,
  type DemoCandidate,
} from './data';

/**
 * Frito — onboarding, discovery, matches, conversation.
 *
 * ─── What makes this more than a card stack ───────────────────────────────
 * The deck is the visible part, but the product is the loop: a decision on a
 * card can create a match, a match creates a conversation, and the
 * conversation is where the app is actually used. So all four screens are
 * here and they feed each other — swiping right on somebody who already liked
 * you puts a real, openable conversation in the matches tab, which is the
 * moment the product is for.
 *
 * ─── Both directions are buttons ──────────────────────────────────────────
 * The real app is swipe-driven. A demo that is ONLY swipe-driven is unusable
 * with a keyboard and unusable with a screen reader, so the decision is a pair
 * of ordinary buttons that the arrow keys also drive (§19). The gesture is the
 * product's; the button is the honest way to show it in a page.
 */

export type Screen = 'onboarding' | 'descubrir' | 'matches' | 'chat';

export interface Profile {
  name: string;
  age: string;
  interests: string[];
}

export interface Message {
  /**
   * Stable identity, assigned when the message is appended.
   *
   * The list is append-only, so a render index would in fact be stable — but
   * only by accident of how the reducer happens to work today. Anything that
   * ever inserted or removed a message would corrupt the rendered list
   * silently. An id makes the invariant explicit.
   */
  id: string;
  from: 'me' | 'them';
  text: string;
}

export interface Match {
  candidateId: string;
  messages: Message[];
  /** How many canned replies have been used, so they advance in order. */
  replyIndex: number;
}

export interface State {
  scenarioId: string;
  screen: Screen;
  profile: Profile;
  errors: Partial<Record<keyof Profile, string>>;
  /** Index into `candidates`. Past the end means the deck is exhausted. */
  cursor: number;
  liked: string[];
  passed: string[];
  matches: Match[];
  /** The match whose conversation is open. */
  activeMatchId: string | null;
  draft: string;
  /** The candidate a "It's a match" celebration is showing for. */
  celebrating: string | null;
  /** True while a canned reply is pending, so the view can show a typing hint. */
  awaitingReply: boolean;
}

export function createInitialState(scenarioId: string): State {
  const active = scenarioId === 'activo';

  return {
    scenarioId,
    screen: active ? 'descubrir' : 'onboarding',
    profile: active
      ? { name: 'Alex', age: '28', interests: ['Música', 'Playa'] }
      : { name: '', age: '', interests: [] },
    errors: {},
    // The seeded conversations are with c1 and c5, so discovery starts after
    // them rather than offering profiles the visitor has already matched.
    cursor: active ? 2 : 0,
    liked: active ? [...seededMatches.map((m) => m.candidateId)] : [],
    passed: [],
    matches: active
      ? seededMatches.map((seed) => ({
          candidateId: seed.candidateId,
          messages: seed.messages.map((message, index) => ({
            ...message,
            id: `${seed.candidateId}-${index}`,
          })),
          replyIndex: 0,
        }))
      : [],
    activeMatchId: null,
    draft: '',
    celebrating: null,
    awaitingReply: false,
  };
}

export type Action =
  | { type: 'field'; name: 'name' | 'age'; value: string }
  | { type: 'toggleInterest'; interest: string }
  | { type: 'finishOnboarding' }
  | { type: 'onboardingFailed'; field: keyof Profile; message: string }
  | { type: 'decide'; liked: boolean }
  | { type: 'dismissCelebration' }
  | { type: 'goto'; screen: Screen }
  | { type: 'openChat'; candidateId: string }
  | { type: 'draft'; value: string }
  | { type: 'send' }
  | { type: 'receiveReply' };

/** The next message id for a conversation. Monotonic within the match. */
function nextMessageId(match: Match): string {
  return `${match.candidateId}-${match.messages.length}`;
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'field': {
      const errors = { ...state.errors };
      delete errors[action.name];
      return {
        ...state,
        profile: { ...state.profile, [action.name]: action.value },
        errors,
      };
    }

    case 'toggleInterest': {
      const errors = { ...state.errors };
      delete errors.interests;
      const has = state.profile.interests.includes(action.interest);
      return {
        ...state,
        errors,
        profile: {
          ...state.profile,
          interests: has
            ? state.profile.interests.filter((i) => i !== action.interest)
            : [...state.profile.interests, action.interest],
        },
      };
    }

    case 'finishOnboarding':
      return { ...state, screen: 'descubrir', errors: {} };

    case 'onboardingFailed':
      return {
        ...state,
        errors: { ...state.errors, [action.field]: action.message },
      };

    case 'decide': {
      const candidate = currentCandidate(state);
      if (!candidate) return state;

      const mutual = action.liked && MUTUAL_IDS.includes(candidate.id);

      return {
        ...state,
        cursor: state.cursor + 1,
        liked: action.liked ? [...state.liked, candidate.id] : state.liked,
        passed: action.liked ? state.passed : [...state.passed, candidate.id],
        matches: mutual
          ? [
              ...state.matches,
              { candidateId: candidate.id, messages: [], replyIndex: 0 },
            ]
          : state.matches,
        celebrating: mutual ? candidate.id : null,
      };
    }

    case 'dismissCelebration':
      return { ...state, celebrating: null };

    case 'goto':
      return {
        ...state,
        screen: action.screen,
        activeMatchId: action.screen === 'chat' ? state.activeMatchId : null,
      };

    case 'openChat':
      return {
        ...state,
        screen: 'chat',
        activeMatchId: action.candidateId,
        celebrating: null,
        draft: '',
      };

    case 'draft':
      return { ...state, draft: action.value };

    case 'send': {
      const text = state.draft.trim();
      if (!text || !state.activeMatchId) return state;

      return {
        ...state,
        draft: '',
        awaitingReply: true,
        matches: state.matches.map((match) =>
          match.candidateId === state.activeMatchId
            ? {
                ...match,
                messages: [
                  ...match.messages,
                  { id: nextMessageId(match), from: 'me' as const, text },
                ],
              }
            : match,
        ),
      };
    }

    case 'receiveReply': {
      if (!state.activeMatchId) return { ...state, awaitingReply: false };

      return {
        ...state,
        awaitingReply: false,
        matches: state.matches.map((match) => {
          if (match.candidateId !== state.activeMatchId) return match;
          const reply = REPLIES[match.replyIndex % REPLIES.length];
          return {
            ...match,
            replyIndex: match.replyIndex + 1,
            messages: [
              ...match.messages,
              { id: nextMessageId(match), from: 'them' as const, text: reply },
            ],
          };
        }),
      };
    }

    default:
      return state;
  }
}

/* ── Selectors ─────────────────────────────────────────────────────────── */

export function currentCandidate(state: State): DemoCandidate | undefined {
  return candidates[state.cursor];
}

export function deckExhausted(state: State): boolean {
  return state.cursor >= candidates.length;
}

export function activeMatch(state: State): Match | undefined {
  return state.matches.find((m) => m.candidateId === state.activeMatchId);
}

export function matchProfiles(state: State): (DemoCandidate & { match: Match })[] {
  return state.matches.flatMap((match) => {
    const candidate = findCandidate(match.candidateId);
    return candidate ? [{ ...candidate, match }] : [];
  });
}

/** Interests the visitor and a candidate have in common. */
export function sharedInterests(
  state: State,
  candidate: DemoCandidate,
): string[] {
  const mine = new Set(state.profile.interests);
  return candidate.interests.filter((interest) => mine.has(interest));
}

export function unreadCount(state: State): number {
  // A conversation nobody has replied to yet is the one worth pointing at.
  return state.matches.filter(
    (match) =>
      match.messages.length === 0 ||
      match.messages[match.messages.length - 1].from === 'them',
  ).length;
}

/* ── Decisions ─────────────────────────────────────────────────────────── */

export function validateProfile(
  profile: Profile,
): Partial<Record<keyof Profile, string>> {
  const errors: Partial<Record<keyof Profile, string>> = {};

  if (profile.name.trim().length < 2) {
    errors.name = 'Escribe tu nombre.';
  }

  const age = Number(profile.age);
  if (!Number.isInteger(age) || age < MIN_AGE || age > 99) {
    errors.age = `Tienes que tener al menos ${MIN_AGE} años para usar Frito.`;
  }

  if (profile.interests.length < MIN_INTERESTS) {
    errors.interests = `Elige al menos ${MIN_INTERESTS} intereses.`;
  }

  return errors;
}

export function completeOnboarding(state: State): DemoResult<true> {
  const errors = validateProfile(state.profile);
  const firstBad = (Object.keys(errors) as (keyof Profile)[])[0];

  if (firstBad) {
    return fail('invalid', errors[firstBad] as string, firstBad);
  }

  return ok(true);
}
