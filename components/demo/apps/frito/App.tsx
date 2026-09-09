'use client';

import {
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type RefObject,
} from 'react';
import {
  ArrowLeft,
  Flame,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import DemoButton from '@/components/demo/ui/DemoButton';
import DemoModal from '@/components/demo/ui/DemoModal';
import DemoStatus from '@/components/demo/ui/DemoStatus';
import { DemoInput } from '@/components/demo/ui/DemoField';
import { DemoArtwork, DemoAvatar } from '@/components/demo/ui/DemoArtwork';
import { DEMO_LATENCY, simulate } from '@/lib/demo/service';
import { track } from '@/lib/analytics';
import type { DemoAppProps } from '@/lib/demo/types';
import {
  MIN_INTERESTS,
  findCandidate,
  interests as allInterests,
} from '@/lib/demo/apps/frito/data';
import {
  activeMatch,
  completeOnboarding,
  createInitialState,
  currentCandidate,
  matchProfiles,
  reducer,
  sharedInterests,
  unreadCount,
  type Action,
  type Profile,
  type State,
} from '@/lib/demo/apps/frito/state';

/**
 * Frito — the app, in a phone.
 *
 * Discovery is a card with two buttons rather than a drag gesture. That is
 * deliberate: the product swipes, but a demo that can only be swiped excludes
 * keyboard and screen-reader users entirely, and a portfolio piece that cannot
 * be operated is not a demonstration (§19). ← and → drive the same two
 * decisions.
 */


/**
 * One component per screen.
 *
 * Onboarding, discovery, the match list and a conversation share nothing but
 * the reducer, so each is its own component and owns the condition that used
 * to wrap it.
 */
interface ScreenProps {
  state: State;
  dispatch: Dispatch<Action>;
}

function OnboardingScreen({ state, dispatch, onFinish }: ScreenProps & { onFinish: () => void }) {
  if (state.screen !== 'onboarding') return null;

  const chosen = new Set(state.profile.interests);

  return (
    <form
      className='p-4 flex flex-col gap-4'
      onSubmit={(event) => {
        event.preventDefault();
        void onFinish();
      }}
    >
      <div>
        <h1 className='text-lg font-extrabold tracking-tight'>
          Crea tu perfil
        </h1>
        <p className='text-xs text-[var(--d-muted)] mt-1'>
          Dos datos y lo que te gusta. Nada más.
        </p>
      </div>

      <DemoInput
        label='Nombre'
        autoComplete='off'
        value={state.profile.name}
        error={state.errors.name}
        onChange={(event) =>
          dispatch({ type: 'field', name: 'name', value: event.target.value })
        }
      />
      <DemoInput
        label='Edad'
        inputMode='numeric'
        autoComplete='off'
        value={state.profile.age}
        error={state.errors.age}
        onChange={(event) =>
          dispatch({ type: 'field', name: 'age', value: event.target.value })
        }
      />

      <fieldset>
        <legend className='text-xs font-medium text-[var(--d-muted)] mb-2'>
          Intereses (mínimo {MIN_INTERESTS})
        </legend>
        <div className='flex flex-wrap gap-2'>
          {/* Membership is a set, not a scan: the list is rebuilt on every
              keystroke in the form above it. */}
          {allInterests.map((interest) => {
            const on = chosen.has(interest);
            return (
              <button
                key={interest}
                type='button'
                onClick={() => dispatch({ type: 'toggleInterest', interest })}
                aria-pressed={on}
                style={{ borderRadius: '9999px' }}
                className={
                  'px-3 min-h-9 text-xs font-medium border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)] ' +
                  (on
                    ? 'bg-[var(--d-accent)] border-[var(--d-accent)] text-[var(--d-accent-fg)]'
                    : 'border-[var(--d-border)] text-[var(--d-muted)]')
                }
              >
                {interest}
              </button>
            );
          })}
        </div>
        {state.errors.interests && (
          <p className='text-[11px] font-medium text-[var(--d-danger)] mt-2'>
            {state.errors.interests}
          </p>
        )}
      </fieldset>

      <DemoButton type='submit' block size='lg'>
        Empezar
      </DemoButton>
    </form>
  );
}

function DiscoveryScreen({ state, dispatch, onDecide }: ScreenProps & { onDecide: (liked: boolean) => void }) {
  if (state.screen !== 'descubrir') return null;

  const candidate = currentCandidate(state);
  // Computed once per card, and as a set: the chips below ask about
  // membership once each.
  const sharedWithCandidate = new Set(
    candidate ? sharedInterests(state, candidate) : [],
  );

  return (
    <div className='p-4 h-full flex flex-col'>
      {candidate ? (
        <>
          <article
            style={{ borderRadius: 'var(--d-radius)' }}
            className='relative flex-1 min-h-0 overflow-hidden border border-[var(--d-border)]'
          >
            <div className='absolute inset-0'>
              <DemoArtwork seed={candidate.id} />
            </div>
            <div className='absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent'>
              <h2 className='text-lg font-extrabold text-white'>
                {candidate.name}, {candidate.age}
              </h2>
              <p className='text-[11px] text-white/70 flex items-center gap-1 mt-0.5'>
                <MapPin size={11} aria-hidden='true' />
                {candidate.city} · a {candidate.distance} km
              </p>
              <p className='text-xs text-white/90 mt-2 leading-relaxed'>
                {candidate.bio}
              </p>
              <ul className='flex flex-wrap gap-1.5 mt-2.5'>
                {candidate.interests.map((interest) => {
                  const shared = sharedWithCandidate.has(interest);
                  return (
                    <li
                      key={interest}
                      className={
                        'text-[10px] px-2 py-0.5 rounded-full ' +
                        (shared
                          ? 'bg-[var(--d-accent)] text-[var(--d-accent-fg)] font-semibold'
                          : 'bg-white/15 text-white/85')
                      }
                    >
                      {shared && '★ '}
                      {interest}
                    </li>
                  );
                })}
              </ul>
            </div>
          </article>

          <div className='flex items-center justify-center gap-6 pt-4 shrink-0'>
            <button
              type='button'
              onClick={() => onDecide(false)}
              aria-label={`Pasar de ${candidate.name}`}
              className='w-14 h-14 grid place-items-center rounded-full border-2 border-[var(--d-border)] text-[var(--d-muted)] hover:text-[var(--d-fg)] hover:border-[var(--d-fg)] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
            >
              <X size={24} aria-hidden='true' />
            </button>
            <button
              type='button'
              onClick={() => onDecide(true)}
              aria-label={`Me gusta ${candidate.name}`}
              className='w-16 h-16 grid place-items-center rounded-full bg-[var(--d-accent)] text-[var(--d-accent-fg)] hover:brightness-110 transition-[filter] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
            >
              <Heart size={26} aria-hidden='true' className='fill-current' />
            </button>
          </div>

          <p className='text-center text-[10px] text-[var(--d-muted)] pt-2 shrink-0'>
            También puedes usar ← y →
          </p>
        </>
      ) : (
        <div className='h-full flex flex-col items-center justify-center gap-3 text-center'>
          <Sparkles size={26} className='text-[var(--d-accent)]' aria-hidden='true' />
          <p className='text-sm font-semibold'>No quedan perfiles cerca</p>
          <p className='text-xs text-[var(--d-muted)] max-w-[16rem]'>
            Has visto a todo el mundo en tu zona. Vuelve más tarde o revisa
            tus mensajes.
          </p>
          <DemoButton
            variant='secondary'
            onClick={() => dispatch({ type: 'goto', screen: 'matches' })}
          >
            Ver mensajes
          </DemoButton>
        </div>
      )}
    </div>
  );
}

function MatchesScreen({ state, dispatch }: ScreenProps) {
  if (state.screen !== 'matches') return null;
  
  const matches = matchProfiles(state);

  return (
    <div className='p-4'>
      <h1 className='text-base font-extrabold tracking-tight mb-3'>
        Mensajes
      </h1>

      {matches.length === 0 ? (
        <div className='py-12 text-center flex flex-col items-center gap-3'>
          <MessageCircle size={24} className='text-[var(--d-muted)]' aria-hidden='true' />
          <p className='text-sm text-[var(--d-muted)] max-w-[16rem]'>
            Todavía no tienes matches. Sigue descubriendo perfiles.
          </p>
          <DemoButton
            variant='secondary'
            onClick={() => dispatch({ type: 'goto', screen: 'descubrir' })}
          >
            Descubrir
          </DemoButton>
        </div>
      ) : (
        <ul className='flex flex-col gap-1'>
          {matches.map((entry) => {
            const last = entry.match.messages[entry.match.messages.length - 1];
            return (
              <li key={entry.id}>
                <button
                  type='button'
                  onClick={() =>
                    dispatch({ type: 'openChat', candidateId: entry.id })
                  }
                  style={{ borderRadius: 'var(--d-radius)' }}
                  className='w-full text-left flex items-center gap-3 p-2.5 hover:bg-[var(--d-surface)] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
                >
                  <DemoAvatar name={entry.name} size={44} />
                  <span className='min-w-0 flex-1'>
                    <span className='block text-sm font-semibold'>
                      {entry.name}
                    </span>
                    <span className='block text-xs text-[var(--d-muted)] truncate'>
                      {last
                        ? `${last.from === 'me' ? 'Tú: ' : ''}${last.text}`
                        : '¡Habéis hecho match! Escríbele.'}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChatScreen({
  state,
  listEnd,
}: Pick<ScreenProps, 'state'> & {
  listEnd: RefObject<HTMLDivElement | null>;
}) {
  const match = activeMatch(state);
  const partner = state.activeMatchId
    ? findCandidate(state.activeMatchId)
    : undefined;
  if (state.screen !== 'chat' || !match || !partner) return null;

  return (
    <div className='p-4 flex flex-col gap-2'>
      {match.messages.length === 0 && (
        <p className='text-center text-xs text-[var(--d-muted)] py-6'>
          Habéis hecho match. Rompe el hielo.
        </p>
      )}

      {match.messages.map((message) => (
        <div
          key={message.id}
          className={
            'max-w-[80%] px-3 py-2 text-sm leading-snug ' +
            (message.from === 'me'
              ? 'self-end bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
              : 'self-start bg-[var(--d-surface-2)] text-[var(--d-fg)]')
          }
          style={{ borderRadius: 'var(--d-radius)' }}
        >
          {message.text}
        </div>
      ))}

      {state.awaitingReply && (
        <div
          className='self-start px-3 py-2 bg-[var(--d-surface-2)] text-[var(--d-muted)] text-sm'
          style={{ borderRadius: 'var(--d-radius)' }}
        >
          <span className='sr-only'>{partner.name} está escribiendo</span>
          <span aria-hidden='true'>· · ·</span>
        </div>
      )}

      <div ref={listEnd} />
    </div>
  );
}

export default function FritoDemo({ scenarioId }: DemoAppProps) {
  const [state, dispatch] = useReducer(reducer, scenarioId, createInitialState);
  const listEnd = useRef<HTMLDivElement>(null);

  // Only what the shell's own chrome and effects read — the top bar, the
  // scroll-into-view effect and the match celebration. Each screen derives
  // the rest itself.
  const candidate = currentCandidate(state);
  const match = activeMatch(state);
  const partner = state.activeMatchId
    ? findCandidate(state.activeMatchId)
    : undefined;

  // Arrow keys are the keyboard equivalent of the swipe.
  useEffect(() => {
    if (state.screen !== 'descubrir' || state.celebrating) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') dispatch({ type: 'decide', liked: true });
      if (event.key === 'ArrowLeft') dispatch({ type: 'decide', liked: false });
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.screen, state.celebrating]);

  // A reply arrives shortly after a message is sent.
  useEffect(() => {
    if (!state.awaitingReply) return;
    const timer = setTimeout(() => dispatch({ type: 'receiveReply' }), 1400);
    return () => clearTimeout(timer);
  }, [state.awaitingReply]);

  // Keep the newest message in view.
  useEffect(() => {
    if (state.screen !== 'chat') return;
    listEnd.current?.scrollIntoView({ block: 'end' });
  }, [state.screen, match?.messages.length, state.awaitingReply]);

  async function finishOnboarding() {
    const result = await simulate(
      () => completeOnboarding(state),
      DEMO_LATENCY.quick,
    );

    if (result.ok) {
      dispatch({ type: 'finishOnboarding' });
    } else {
      dispatch({
        type: 'onboardingFailed',
        field: (result.failure.field ?? 'name') as keyof Profile,
        message: result.failure.message,
      });
    }
  }

  function decide(liked: boolean) {
    dispatch({ type: 'decide', liked });
    if (liked && candidate) {
      track('demo_completed', { project: 'frito', workflow: 'discovery' });
    }
  }

  return (
    <div className='h-full flex flex-col'>
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className='shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--d-border)]'>
        {state.screen === 'chat' ? (
          <>
            <button
              type='button'
              onClick={() => dispatch({ type: 'goto', screen: 'matches' })}
              aria-label='Volver a mensajes'
              className='p-1.5 -ml-1.5 text-[var(--d-muted)] hover:text-[var(--d-fg)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
            >
              <ArrowLeft size={18} aria-hidden='true' />
            </button>
            {partner && <DemoAvatar name={partner.name} size={28} />}
            <p className='text-sm font-semibold truncate'>{partner?.name}</p>
          </>
        ) : (
          <>
            <Flame size={20} className='text-[var(--d-accent)]' aria-hidden='true' />
            <p className='text-base font-extrabold tracking-tight'>Frito</p>
          </>
        )}
      </header>

      <div className='flex-1 min-h-0 overflow-y-auto'>
        {/* ── Onboarding ────────────────────────────────────────────────── */}
        <OnboardingScreen state={state} dispatch={dispatch} onFinish={finishOnboarding} />

        {/* ── Discovery ─────────────────────────────────────────────────── */}
        <DiscoveryScreen state={state} dispatch={dispatch} onDecide={decide} />

        {/* ── Matches ───────────────────────────────────────────────────── */}
        <MatchesScreen state={state} dispatch={dispatch} />

        {/* ── Chat ──────────────────────────────────────────────────────── */}
        <ChatScreen state={state} listEnd={listEnd} />
      </div>

      {/* ── Composer ────────────────────────────────────────────────────── */}
      {state.screen === 'chat' && (
        <form
          className='shrink-0 p-3 border-t border-[var(--d-border)] flex items-center gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: 'send' });
          }}
        >
          <input
            value={state.draft}
            onChange={(event) =>
              dispatch({ type: 'draft', value: event.target.value })
            }
            placeholder='Escribe un mensaje'
            aria-label='Escribe un mensaje'
            style={{ borderRadius: '9999px' }}
            className='flex-1 min-w-0 px-4 min-h-11 text-sm bg-[var(--d-surface-2)] border border-[var(--d-border)] placeholder:text-[var(--d-muted)] focus-visible:outline-2 focus-visible:outline-[var(--d-ring)]'
          />
          <button
            type='submit'
            disabled={state.draft.trim() === ''}
            aria-label='Enviar'
            className='w-11 h-11 shrink-0 grid place-items-center rounded-full bg-[var(--d-accent)] text-[var(--d-accent-fg)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--d-ring)]'
          >
            <Send size={17} aria-hidden='true' />
          </button>
        </form>
      )}

      {/* ── Bottom navigation ───────────────────────────────────────────── */}
      {state.screen !== 'onboarding' && state.screen !== 'chat' && (
        <nav
          className='shrink-0 flex border-t border-[var(--d-border)]'
          aria-label='Navegación principal'
        >
          {(
            [
              { id: 'descubrir', label: 'Descubrir', Icon: Flame },
              { id: 'matches', label: 'Mensajes', Icon: MessageCircle },
            ] as const
          ).map(({ id, label, Icon }) => {
            const on = state.screen === id;
            const badge = id === 'matches' ? unreadCount(state) : 0;

            return (
              <button
                key={id}
                type='button'
                onClick={() => dispatch({ type: 'goto', screen: id })}
                aria-current={on ? 'page' : undefined}
                className={
                  'flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--d-ring)] ' +
                  (on ? 'text-[var(--d-accent)]' : 'text-[var(--d-muted)]')
                }
              >
                <span className='relative'>
                  <Icon size={19} aria-hidden='true' />
                  {badge > 0 && (
                    <span
                      aria-hidden='true'
                      className='absolute -top-1 -right-2 min-w-4 h-4 px-1 grid place-items-center text-[9px] font-bold rounded-full bg-[var(--d-accent)] text-[var(--d-accent-fg)]'
                    >
                      {badge}
                    </span>
                  )}
                </span>
                {label}
              </button>
            );
          })}
        </nav>
      )}

      {/* ── It's a match ────────────────────────────────────────────────── */}
      <DemoModal
        open={state.celebrating !== null}
        onClose={() => dispatch({ type: 'dismissCelebration' })}
        title='¡Es un match!'
        description={
          state.celebrating
            ? `A ${findCandidate(state.celebrating)?.name} también le gustas.`
            : undefined
        }
        labelClose='Cerrar'
        footer={
          <>
            <DemoButton
              block
              data-autofocus
              onClick={() =>
                state.celebrating &&
                dispatch({ type: 'openChat', candidateId: state.celebrating })
              }
            >
              Enviar mensaje
            </DemoButton>
            <DemoButton
              block
              variant='ghost'
              onClick={() => dispatch({ type: 'dismissCelebration' })}
            >
              Seguir descubriendo
            </DemoButton>
          </>
        }
      >
        {state.celebrating && (
          <div className='flex justify-center py-2'>
            <DemoAvatar
              name={findCandidate(state.celebrating)?.name ?? ''}
              size={72}
            />
          </div>
        )}
      </DemoModal>

      {/* Announced rather than only drawn. */}
      <DemoStatus tone='success'>
        {state.celebrating
          ? `Nuevo match con ${findCandidate(state.celebrating)?.name}`
          : null}
      </DemoStatus>
    </div>
  );
}
