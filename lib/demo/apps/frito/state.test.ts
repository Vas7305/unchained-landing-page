import { describe, expect, it } from 'vitest';
import { MUTUAL_IDS, REPLIES, candidates, seededMatches } from './data';
import {
  activeMatch,
  completeOnboarding,
  createInitialState,
  currentCandidate,
  deckExhausted,
  matchProfiles,
  reducer,
  sharedInterests,
  unreadCount,
  validateProfile,
  type Action,
  type State,
} from './state';

function run(state: State, ...actions: Action[]): State {
  return actions.reduce(reducer, state);
}

describe('onboarding', () => {
  it('starts on the profile step for a new user', () => {
    const state = createInitialState('registro');
    expect(state.screen).toBe('onboarding');
    expect(state.profile.name).toBe('');
    expect(state.matches).toEqual([]);
  });

  it('skips onboarding in the active scenario and seeds conversations', () => {
    const state = createInitialState('activo');
    expect(state.screen).toBe('descubrir');
    expect(state.matches).toHaveLength(seededMatches.length);
    expect(state.matches[0].messages.length).toBeGreaterThan(0);
  });

  it('refuses anyone under eighteen', () => {
    const young = { name: 'Alex', age: '16', interests: ['Música', 'Playa'] };
    expect(validateProfile(young).age).toBeTruthy();

    const ok = { ...young, age: '18' };
    expect(validateProfile(ok).age).toBeUndefined();
  });

  it('requires a name and at least two interests', () => {
    expect(validateProfile({ name: '', age: '25', interests: [] }).name)
      .toBeTruthy();
    expect(
      validateProfile({ name: 'Alex', age: '25', interests: ['Música'] })
        .interests,
    ).toBeTruthy();
  });

  it('lets a complete profile through to discovery', () => {
    const state = run(
      createInitialState('registro'),
      { type: 'field', name: 'name', value: 'Alex' },
      { type: 'field', name: 'age', value: '28' },
      { type: 'toggleInterest', interest: 'Música' },
      { type: 'toggleInterest', interest: 'Cine' },
    );

    expect(completeOnboarding(state).ok).toBe(true);
    expect(run(state, { type: 'finishOnboarding' }).screen).toBe('descubrir');
  });

  it('toggles an interest off again', () => {
    const state = run(
      createInitialState('registro'),
      { type: 'toggleInterest', interest: 'Playa' },
      { type: 'toggleInterest', interest: 'Playa' },
    );
    expect(state.profile.interests).toEqual([]);
  });
});

describe('discovery', () => {
  const ready = (): State =>
    run(
      createInitialState('registro'),
      { type: 'field', name: 'name', value: 'Alex' },
      { type: 'field', name: 'age', value: '28' },
      { type: 'toggleInterest', interest: 'Playa' },
      { type: 'toggleInterest', interest: 'Café' },
      { type: 'finishOnboarding' },
    );

  it('advances the deck on every decision', () => {
    const first = currentCandidate(ready());
    const after = run(ready(), { type: 'decide', liked: false });

    expect(after.cursor).toBe(1);
    expect(after.passed).toEqual([first?.id]);
    expect(currentCandidate(after)?.id).not.toBe(first?.id);
  });

  it('creates a match when the like is mutual, and not otherwise', () => {
    // c1 is on the mutual list and is first in the deck.
    const liked = run(ready(), { type: 'decide', liked: true });
    expect(MUTUAL_IDS).toContain(candidates[0].id);
    expect(liked.matches).toHaveLength(1);
    expect(liked.celebrating).toBe(candidates[0].id);

    // c2 is not, so liking it adds nothing to the matches list.
    const second = run(liked, { type: 'dismissCelebration' }, {
      type: 'decide',
      liked: true,
    });
    expect(second.matches).toHaveLength(1);
    expect(second.celebrating).toBeNull();
  });

  it('never matches on a pass', () => {
    const passed = run(ready(), { type: 'decide', liked: false });
    expect(passed.matches).toHaveLength(0);
    expect(passed.celebrating).toBeNull();
  });

  it('highlights interests in common', () => {
    const state = ready();
    const shared = sharedInterests(state, candidates[0]);
    // The visitor picked Playa and Café; c1 has Arte, Playa, Café.
    expect(shared.sort()).toEqual(['Café', 'Playa']);
  });

  it('runs out of profiles at the end of the deck', () => {
    let state = ready();
    for (let i = 0; i < candidates.length; i++) {
      state = run(state, { type: 'decide', liked: false });
    }

    expect(deckExhausted(state)).toBe(true);
    expect(currentCandidate(state)).toBeUndefined();
    // And a decision past the end changes nothing.
    expect(run(state, { type: 'decide', liked: true })).toEqual(state);
  });
});

describe('conversation', () => {
  it('sends a message and receives the scripted reply in order', () => {
    let state = run(createInitialState('activo'), {
      type: 'openChat',
      candidateId: 'c5',
    });

    const before = activeMatch(state)?.messages.length ?? 0;

    state = run(state, { type: 'draft', value: 'Hola, ¿qué tal?' }, { type: 'send' });
    expect(activeMatch(state)?.messages).toHaveLength(before + 1);
    expect(state.draft).toBe('');
    expect(state.awaitingReply).toBe(true);

    state = run(state, { type: 'receiveReply' });
    const messages = activeMatch(state)?.messages ?? [];
    expect(messages).toHaveLength(before + 2);
    expect(messages[messages.length - 1].from).toBe('them');
    expect(messages[messages.length - 1].text).toBe(REPLIES[0]);
    // Ids are unique, which is what makes them usable as React keys.
    expect(new Set(messages.map((m) => m.id)).size).toBe(messages.length);
    expect(state.awaitingReply).toBe(false);

    // The next reply is the next line of the script, not the same one.
    state = run(
      state,
      { type: 'draft', value: 'Genial' },
      { type: 'send' },
      { type: 'receiveReply' },
    );
    const after = activeMatch(state)?.messages ?? [];
    expect(after[after.length - 1].text).toBe(REPLIES[1]);
  });

  it('ignores an empty message', () => {
    const state = run(
      createInitialState('activo'),
      { type: 'openChat', candidateId: 'c5' },
      { type: 'draft', value: '   ' },
      { type: 'send' },
    );

    expect(activeMatch(state)?.messages).toHaveLength(1);
    expect(state.awaitingReply).toBe(false);
  });

  it('opens a conversation straight from a new match', () => {
    const state = run(
      createInitialState('activo'),
      { type: 'decide', liked: true },
    );

    // c3 is not mutual, so nothing was created — take a mutual one instead.
    const mutual = run(createInitialState('registro'), {
      type: 'decide',
      liked: true,
    });
    expect(mutual.celebrating).not.toBeNull();

    const chat = run(mutual, {
      type: 'openChat',
      candidateId: mutual.celebrating as string,
    });
    expect(chat.screen).toBe('chat');
    expect(chat.celebrating).toBeNull();
    expect(activeMatch(chat)?.messages).toEqual([]);
    expect(state.screen).toBe('descubrir');
  });

  it('counts conversations waiting on a reply', () => {
    const state = createInitialState('activo');
    // Both seeded conversations end with a message from the other person, so
    // both are waiting on the visitor.
    expect(matchProfiles(state)).toHaveLength(2);
    expect(unreadCount(state)).toBe(2);

    // Answering one takes it off the count; the other still waits.
    const answered = run(
      state,
      { type: 'openChat', candidateId: 'c5' },
      { type: 'draft', value: 'Todo bien, ¿y tú?' },
      { type: 'send' },
    );
    expect(unreadCount(answered)).toBe(1);

    // A brand-new match with no messages at all also counts as waiting.
    const withNew = run(createInitialState('registro'), {
      type: 'decide',
      liked: true,
    });
    expect(withNew.matches[0].messages).toEqual([]);
    expect(unreadCount(withNew)).toBe(1);
  });
});

describe('reset', () => {
  it('returns each scenario to its own starting position', () => {
    const used = run(
      createInitialState('activo'),
      { type: 'decide', liked: true },
      { type: 'openChat', candidateId: 'c5' },
      { type: 'draft', value: 'hola' },
      { type: 'send' },
    );

    expect(used.matches.some((m) => m.messages.length > 1)).toBe(true);

    const fresh = createInitialState('activo');
    expect(fresh.screen).toBe('descubrir');
    expect(fresh.activeMatchId).toBeNull();
    expect(fresh.draft).toBe('');
    expect(fresh).toEqual(createInitialState('activo'));

    // And the seeded conversations were copied, not shared: mutating one run
    // must not have changed the fixture the next run starts from.
    expect(fresh.matches[1].messages).toHaveLength(
      seededMatches[1].messages.length,
    );

    const newUser = createInitialState('registro');
    expect(newUser.screen).toBe('onboarding');
    expect(newUser.matches).toEqual([]);
  });
});
