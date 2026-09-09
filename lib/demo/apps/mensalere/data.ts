/**
 * Mensalere demo fixtures.
 *
 * A directory of psychology professionals and the diary behind each of them.
 *
 * ─── The care taken here is not decorative ────────────────────────────────
 * This product is about mental health, so the fixtures are held to a higher
 * bar than "obviously fake". Every professional is invented, with an invented
 * registration number in an obviously non-real format; nothing in the demo
 * offers advice, diagnoses anything, or presents a clinical claim. The
 * "motivo de consulta" the visitor can type is never stored, never sent, and
 * never echoed anywhere but the screen they typed it on — which is the same
 * property the real product needs and a good thing for a demo to demonstrate.
 *
 * Fees in cents.
 */

export const specialties = [
  'Anxiety & stress',
  'Depression',
  'Couples therapy',
  'Adolescents',
  'Trauma & grief',
  'Adult ADHD',
] as const;

export const languagesOffered = ['English', 'Spanish', 'Catalan'] as const;

export type Modality = 'online' | 'presencial';

export interface DemoProfessional {
  id: string;
  name: string;
  /** Invented registration, in a format no college actually issues. */
  licence: string;
  headline: string;
  specialties: readonly string[];
  languages: readonly string[];
  modalities: readonly Modality[];
  /** Session fee in cents. */
  fee: number;
  years: number;
  approach: string;
  city: string;
}

export const professionals: readonly DemoProfessional[] = [
  {
    id: 'e-ferran',
    name: 'Elena Ferrán',
    licence: 'DEMO-1042',
    headline: 'Clinical psychologist · Anxiety & stress',
    specialties: ['Anxiety & stress', 'Adult ADHD'],
    languages: ['Spanish', 'Catalan'],
    modalities: ['online', 'presencial'],
    fee: 6_000,
    years: 12,
    approach:
      'Cognitive behavioural therapy and regulation techniques, with goals reviewed every four sessions.',
    city: 'Barcelona',
  },
  {
    id: 'm-iribarne',
    name: 'Marcos Iribarne',
    licence: 'DEMO-2277',
    headline: 'Psychologist · Couples therapy',
    specialties: ['Couples therapy'],
    languages: ['Spanish'],
    modalities: ['online'],
    fee: 7_500,
    years: 15,
    approach:
      'Joint 60-minute sessions focused on communication patterns and concrete agreements.',
    city: 'Madrid',
  },
  {
    id: 'n-bastos',
    name: 'Nuria Bastos',
    licence: 'DEMO-3391',
    headline: 'Child & adolescent psychologist',
    specialties: ['Adolescents', 'Anxiety & stress'],
    languages: ['English', 'Spanish'],
    modalities: ['presencial'],
    fee: 6_500,
    years: 9,
    approach:
      'Support for adolescents and their families, including follow-up sessions with guardians.',
    city: 'Valencia',
  },
  {
    id: 't-vega',
    name: 'Tomás Vega',
    licence: 'DEMO-4108',
    headline: 'Clinical psychologist · Mood',
    specialties: ['Depression', 'Anxiety & stress'],
    languages: ['Spanish'],
    modalities: ['online'],
    fee: 5_500,
    years: 7,
    approach:
      'A behavioural approach with between-session tasks and simple progress measurement.',
    city: 'Sevilla',
  },
  {
    id: 'c-nieto',
    name: 'Carla Nieto',
    licence: 'DEMO-5560',
    headline: 'Psychologist · Trauma & grief',
    specialties: ['Trauma & grief', 'Depression'],
    languages: ['English', 'Spanish'],
    modalities: ['online', 'presencial'],
    fee: 8_000,
    years: 18,
    approach:
      'Trauma-focused therapy, paced by the person rather than by the calendar.',
    city: 'Bilbao',
  },
  {
    id: 'a-puig',
    name: 'Andrés Puig',
    licence: 'DEMO-6634',
    headline: 'Psychologist · Adult ADHD',
    specialties: ['Adult ADHD'],
    languages: ['Spanish', 'Catalan'],
    modalities: ['online'],
    fee: 6_000,
    years: 6,
    approach:
      'Assessment, psychoeducation and organisation strategies fitted to each routine.',
    city: 'Barcelona',
  },
];

/** Consultation slots offered each day. */
export const SLOT_TIMES = ['09:00', '11:00', '13:00', '16:00', '18:00', '20:00'] as const;

/** How many days ahead the diary is shown. */
export const DIARY_DAYS = 5;

/** Session length, in minutes. Shown so the fee has a unit. */
export const SESSION_MINUTES = 50;

/**
 * The slot that is taken between selection and confirmation.
 *
 * Same reasoning as the salon demo: every diary product has this race, and it
 * is worth showing once, deterministically, with a working recovery.
 */
export const CONTESTED = { professionalId: 't-vega', dayOffset: 1, time: '16:00' };

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export interface DemoSlot {
  time: string;
  available: boolean;
}

/** A professional's day, identical on every render. */
export function slotsFor(
  professionalId: string,
  dayOffset: number,
  blocked: readonly string[] = [],
): DemoSlot[] {
  return SLOT_TIMES.map((time) => ({
    time,
    available:
      hash(`${professionalId}:${dayOffset}:${time}`) % 10 >= 4 &&
      !blocked.includes(slotKey(professionalId, dayOffset, time)),
  }));
}

export function slotKey(
  professionalId: string,
  dayOffset: number,
  time: string,
): string {
  return `${professionalId}|${dayOffset}|${time}`;
}

export function findProfessional(id: string): DemoProfessional | undefined {
  return professionals.find((person) => person.id === id);
}
