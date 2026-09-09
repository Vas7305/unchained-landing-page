/**
 * Frito demo fixtures.
 *
 * ─── Invented people, and obviously so ────────────────────────────────────
 * A dating app is the sharpest case for §7. Nobody in this file exists: the
 * names are common Cuban first names with an initial, the ages are round, the
 * biographies are two lines of nothing in particular, and there are no
 * photographs anywhere in the demo — the cards carry generated marks, not
 * faces. Using stock portraits of real people as dating profiles would be
 * putting strangers on our website as if they were looking for a partner, and
 * no amount of "it's only a demo" makes that acceptable.
 *
 * The conversations are equally synthetic: the replies are a fixed script,
 * short and unremarkable, so the demo shows that messaging works without
 * inventing a personality for someone who does not exist.
 */

export interface DemoCandidate {
  id: string;
  name: string;
  age: number;
  city: string;
  bio: string;
  interests: readonly string[];
  /** How far away, in km. Fixed per profile. */
  distance: number;
}

export const interests = [
  'Música',
  'Playa',
  'Cine',
  'Cocinar',
  'Deporte',
  'Bailar',
  'Viajar',
  'Leer',
  'Arte',
  'Café',
] as const;

export const candidates: readonly DemoCandidate[] = [
  {
    id: 'c1',
    name: 'Dayana R.',
    age: 27,
    city: 'La Habana',
    bio: 'Trabajo en un estudio de diseño. Los domingos son de malecón y helado.',
    interests: ['Arte', 'Playa', 'Café'],
    distance: 3,
  },
  {
    id: 'c2',
    name: 'Yosvani P.',
    age: 31,
    city: 'La Habana',
    bio: 'Cocino mejor de lo que bailo, y bailo bastante bien.',
    interests: ['Cocinar', 'Bailar', 'Música'],
    distance: 5,
  },
  {
    id: 'c3',
    name: 'Claudia M.',
    age: 24,
    city: 'Marianao',
    bio: 'Estudio arquitectura. Colecciono entradas de cine.',
    interests: ['Cine', 'Leer', 'Arte'],
    distance: 8,
  },
  {
    id: 'c4',
    name: 'Reinier G.',
    age: 29,
    city: 'Playa',
    bio: 'Corro por la mañana y busco a alguien que me acompañe.',
    interests: ['Deporte', 'Playa', 'Viajar'],
    distance: 11,
  },
  {
    id: 'c5',
    name: 'Amanda L.',
    age: 26,
    city: 'Vedado',
    bio: 'Profesora de música. Toco tres, canto ninguno.',
    interests: ['Música', 'Café', 'Leer'],
    distance: 2,
  },
  {
    id: 'c6',
    name: 'Osmany D.',
    age: 33,
    city: 'Centro Habana',
    bio: 'Fotografío la ciudad. Siempre me falta luz y me sobra tiempo.',
    interests: ['Arte', 'Viajar', 'Cine'],
    distance: 4,
  },
  {
    id: 'c7',
    name: 'Lisandra V.',
    age: 28,
    city: 'La Habana',
    bio: 'Enfermera. Me gusta la playa temprano y dormir tarde.',
    interests: ['Playa', 'Bailar', 'Cocinar'],
    distance: 6,
  },
  {
    id: 'c8',
    name: 'Ernesto B.',
    age: 30,
    city: 'Habana del Este',
    bio: 'Reparo bicicletas. Si te gusta pedalear, ya tenemos plan.',
    interests: ['Deporte', 'Viajar', 'Música'],
    distance: 14,
  },
];

/**
 * The profiles that have already liked you.
 *
 * Fixed, so "swipe right and get a match" happens on purpose the first time
 * anyone tries the demo, and happens again for the next person. A random one
 * in three would leave some visitors never seeing the feature the app is for.
 */
export const MUTUAL_IDS: readonly string[] = ['c1', 'c4', 'c5'];

/** The two conversations the `activo` scenario starts with. */
export const seededMatches: readonly {
  candidateId: string;
  messages: readonly { from: 'me' | 'them'; text: string }[];
}[] = [
  {
    candidateId: 'c1',
    messages: [
      { from: 'them', text: '¡Hola! Vi que también te gusta el café ☕' },
      { from: 'me', text: 'Jaja sí, demasiado. ¿Conoces algún sitio bueno?' },
      { from: 'them', text: 'Uno en Obispo. ¿Te va el sábado?' },
    ],
  },
  {
    candidateId: 'c5',
    messages: [{ from: 'them', text: 'Hola 👋 ¿qué tal el fin de semana?' }],
  },
];

/**
 * Canned replies, used in order.
 *
 * Deliberately bland and short: the demo needs to show that a conversation
 * flows, not to write dialogue for a person who does not exist.
 */
export const REPLIES: readonly string[] = [
  '¡Me parece bien! 😄',
  'Cuéntame más, me interesa.',
  'Jaja, buena esa.',
  'Perfecto, ¿te va bien el fin de semana?',
  'Genial. Te escribo luego 👌',
];

export const MIN_AGE = 18;
export const MIN_INTERESTS = 2;

export function findCandidate(id: string): DemoCandidate | undefined {
  return candidates.find((candidate) => candidate.id === id);
}
