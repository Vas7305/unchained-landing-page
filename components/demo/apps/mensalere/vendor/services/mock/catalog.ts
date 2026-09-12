import type { HelpCategory, HelpCategoryId, Psychologist, Service } from '../types';

/**
 * FICTIONAL DEVELOPMENT DATA (§58).
 *
 * Every professional below is invented for the frontend prototype. No licence,
 * registration number, credential, rating, review, patient count or outcome is
 * represented here, because none has been verified. Photography is deliberately
 * absent (§57): the UI renders a clearly non-photographic placeholder instead of
 * stock or AI-generated faces.
 */

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: 'anxiety-stress',
    label: 'Anxiety & Stress',
    description: 'Persistent worry, tension, panic or a sense of being overwhelmed.',
  },
  {
    id: 'relationships',
    label: 'Relationships',
    description: 'Difficulties with a partner, friends or people close to you.',
  },
  {
    id: 'self-esteem',
    label: 'Self-esteem',
    description: 'Self-criticism, confidence, and how you relate to yourself.',
  },
  {
    id: 'grief-loss',
    label: 'Grief & Loss',
    description: 'Living with the loss of someone or something that mattered.',
  },
  {
    id: 'family',
    label: 'Family',
    description: 'Family dynamics, parenting, and conversations that feel stuck.',
  },
  {
    id: 'work-burnout',
    label: 'Work & Burnout',
    description: 'Exhaustion, pressure, and the line between work and the rest of life.',
  },
  {
    id: 'sexuality',
    label: 'Sexuality',
    description: 'Identity, intimacy and sexual wellbeing, discussed respectfully.',
  },
  {
    id: 'compulsive-behaviors',
    label: 'Compulsive Behaviors',
    description: 'Habits and behaviours that feel hard to interrupt.',
  },
  {
    id: 'adolescence',
    label: 'Adolescence',
    description: 'Support for teenagers and the adults around them.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else, or you would rather describe it in your own words.',
  },
];

export const CATEGORY_LABELS: Record<HelpCategoryId, string> = Object.fromEntries(
  HELP_CATEGORIES.map((category) => [category.id, category.label]),
) as Record<HelpCategoryId, string>;

function buildServices(baseCents: number, extendedCents: number): Service[] {
  return [
    {
      id: 'initial-consultation',
      name: 'Initial consultation',
      description: 'A first conversation to understand what brings you here.',
      durationMinutes: 50,
      priceCents: baseCents,
      modality: 'video',
    },
    {
      id: 'follow-up',
      name: 'Follow-up consultation',
      description: 'A continuing session once you have already met.',
      durationMinutes: 50,
      priceCents: baseCents,
      modality: 'video',
    },
    {
      id: 'extended-session',
      name: 'Extended session',
      description: 'A longer session when more time is useful.',
      durationMinutes: 80,
      priceCents: extendedCents,
      modality: 'video',
    },
  ];
}

interface Seed {
  id: string;
  name: string;
  title: string;
  verified: boolean;
  headline: string;
  biography: string[];
  specialties: HelpCategoryId[];
  languages: string[];
  yearsOfExperience: number;
  baseCents: number;
  extendedCents: number;
  acceptingNewPatients: boolean;
}

const SEEDS: Seed[] = [
  {
    id: 'ana-ferreira',
    name: 'Ana Ferreira',
    title: 'Psychologist',
    verified: true,
    headline: 'Works with anxiety, stress and the pressure that builds up quietly.',
    biography: [
      'I work with adults who feel persistently tense, over-responsible or unable to switch off. Sessions are conversational: we look at what is happening, what keeps it going, and what could change.',
      'I usually suggest starting with one conversation before deciding anything else. There is no obligation to continue.',
    ],
    specialties: ['anxiety-stress', 'work-burnout', 'self-esteem'],
    languages: ['English', 'Portuguese'],
    yearsOfExperience: 11,
    baseCents: 6500,
    extendedCents: 9500,
    acceptingNewPatients: true,
  },
  {
    id: 'daniel-okafor',
    name: 'Daniel Okafor',
    title: 'Psychologist',
    verified: true,
    headline: 'Relationships, communication and long-standing family patterns.',
    biography: [
      'Much of my work is with people trying to understand a relationship that has become difficult, whether with a partner, a parent or an adult child.',
      'I am direct, and I will tell you plainly if I think another professional would suit you better.',
    ],
    specialties: ['relationships', 'family', 'self-esteem'],
    languages: ['English'],
    yearsOfExperience: 8,
    baseCents: 6000,
    extendedCents: 8800,
    acceptingNewPatients: true,
  },
  {
    id: 'lucia-martin',
    name: 'Lucia Martin',
    title: 'Psychologist',
    verified: true,
    headline: 'Grief, loss and the periods that follow a significant change.',
    biography: [
      'I work with people living through bereavement, separation, illness and other losses that do not have an obvious end point.',
      'Sessions move at the pace you set. Nothing has to be explained before you are ready.',
    ],
    specialties: ['grief-loss', 'family', 'anxiety-stress'],
    languages: ['English', 'Spanish'],
    yearsOfExperience: 15,
    baseCents: 7000,
    extendedCents: 10500,
    acceptingNewPatients: true,
  },
  {
    id: 'noor-haddad',
    name: 'Noor Haddad',
    title: 'Psychologist',
    verified: true,
    headline: 'Burnout, work pressure and recovering a sustainable rhythm.',
    biography: [
      'I see many people who are still functioning at work but running on very little. We look at the load itself, not only at how you are coping with it.',
      'I offer both shorter pieces of work and longer-term sessions.',
    ],
    specialties: ['work-burnout', 'anxiety-stress', 'self-esteem'],
    languages: ['English', 'Arabic', 'French'],
    yearsOfExperience: 9,
    baseCents: 6800,
    extendedCents: 9900,
    acceptingNewPatients: true,
  },
  {
    id: 'peter-lindqvist',
    name: 'Peter Lindqvist',
    title: 'Psychologist',
    verified: false,
    headline: 'Adolescence, transitions and the adults supporting them.',
    biography: [
      'I work with teenagers and young adults, and separately with parents who want to understand what is happening at home.',
      'With younger people I keep the first session short and low-pressure.',
    ],
    specialties: ['adolescence', 'family', 'self-esteem'],
    languages: ['English', 'Swedish'],
    yearsOfExperience: 6,
    baseCents: 5800,
    extendedCents: 8500,
    acceptingNewPatients: true,
  },
  {
    id: 'sofia-ricci',
    name: 'Sofia Ricci',
    title: 'Psychologist',
    verified: true,
    headline: 'Sexuality, intimacy and identity, discussed without judgement.',
    biography: [
      'I work with adults and couples on intimacy, desire, orientation and identity. Conversations start wherever you feel able to start them.',
      'Nothing you bring needs to be framed as a problem before we talk about it.',
    ],
    specialties: ['sexuality', 'relationships', 'self-esteem'],
    languages: ['English', 'Italian'],
    yearsOfExperience: 12,
    baseCents: 7200,
    extendedCents: 10800,
    acceptingNewPatients: false,
  },
  {
    id: 'tomas-varga',
    name: 'Tomas Varga',
    title: 'Psychologist',
    verified: true,
    headline: 'Habits and behaviours that have become hard to interrupt.',
    biography: [
      'My work focuses on repetitive behaviours such as checking, control and avoidance, and on what sits underneath them.',
      'We agree on what we are working towards, and review it openly.',
    ],
    specialties: ['compulsive-behaviors', 'anxiety-stress', 'other'],
    languages: ['English', 'Slovak', 'Czech'],
    yearsOfExperience: 10,
    baseCents: 6600,
    extendedCents: 9600,
    acceptingNewPatients: true,
  },
  {
    id: 'yara-mendes',
    name: 'Yara Mendes',
    title: 'Psychologist',
    verified: true,
    headline: 'A first conversation when you are not sure where to begin.',
    biography: [
      'A good part of my practice is with people who have never spoken to a psychologist and are not certain they need to.',
      'If it turns out that a colleague is a better fit, I will say so and help you get there.',
    ],
    specialties: ['other', 'anxiety-stress', 'relationships'],
    languages: ['English', 'Portuguese', 'Spanish'],
    yearsOfExperience: 7,
    baseCents: 5500,
    extendedCents: 8200,
    acceptingNewPatients: true,
  },
];

export const PSYCHOLOGISTS: Psychologist[] = SEEDS.map((seed) => {
  const services = buildServices(seed.baseCents, seed.extendedCents);
  return {
    id: seed.id,
    name: seed.name,
    title: seed.title,
    verified: seed.verified,
    photoIsPlaceholder: true,
    headline: seed.headline,
    biography: seed.biography,
    specialties: seed.specialties,
    languages: seed.languages,
    yearsOfExperience: seed.yearsOfExperience,
    services,
    fromPriceCents: Math.min(...services.map((service) => service.priceCents)),
    acceptingNewPatients: seed.acceptingNewPatients,
  };
});

export function findPsychologist(id: string): Psychologist | undefined {
  return PSYCHOLOGISTS.find((psychologist) => psychologist.id === id);
}
