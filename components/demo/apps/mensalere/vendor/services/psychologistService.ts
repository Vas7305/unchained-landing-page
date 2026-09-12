import type { HelpCategoryId, Psychologist, QuestionnaireAnswers } from './types';
import { ServiceError } from './types';
import { PSYCHOLOGISTS, findPsychologist } from './mock/catalog';
import { latency } from './mock/store';

export interface PsychologistFilters {
  /** Free text over name, headline and specialties. */
  query?: string;
  category?: HelpCategoryId | 'all';
  language?: string | 'all';
  /** Upper bound on the cheapest service, in minor units. */
  maxPriceCents?: number | undefined;
  acceptingOnly?: boolean;
}

export interface Recommendation {
  psychologist: Psychologist;
  /**
   * Plain-language reasons the professional appears in the list. This is
   * preference matching, never a clinical or compatibility judgement (§35, §36).
   */
  reasons: string[];
}

export interface PsychologistService {
  list(filters?: PsychologistFilters): Promise<Psychologist[]>;
  get(id: string): Promise<Psychologist>;
  featured(limit?: number): Promise<Psychologist[]>;
  languages(): Promise<string[]>;
  recommend(answers: QuestionnaireAnswers): Promise<Recommendation[]>;
}

function matchesQuery(psychologist: Psychologist, query: string): boolean {
  const haystack = [psychologist.name, psychologist.headline, ...psychologist.specialties]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query.trim().toLowerCase());
}

export const psychologistService: PsychologistService = {
  async list(filters = {}) {
    const {
      query,
      category = 'all',
      language = 'all',
      maxPriceCents,
      acceptingOnly = false,
    } = filters;

    const results = PSYCHOLOGISTS.filter((psychologist) => {
      if (query && !matchesQuery(psychologist, query)) return false;
      if (category !== 'all' && !psychologist.specialties.includes(category)) return false;
      if (language !== 'all' && !psychologist.languages.includes(language)) return false;
      if (maxPriceCents && psychologist.fromPriceCents > maxPriceCents) return false;
      if (acceptingOnly && !psychologist.acceptingNewPatients) return false;
      return true;
    });

    return latency(results);
  },

  async get(id) {
    const psychologist = findPsychologist(id);
    if (!psychologist) {
      throw new ServiceError('We could not find that professional.', 'not_found');
    }
    return latency(psychologist);
  },

  async featured(limit = 3) {
    // "Featured" is simply the first professionals accepting new patients. No
    // ranking, rating or paid placement is implied.
    const results = PSYCHOLOGISTS.filter((p) => p.acceptingNewPatients).slice(0, limit);
    return latency(results);
  },

  async languages() {
    const all = new Set<string>();
    PSYCHOLOGISTS.forEach((p) => p.languages.forEach((language) => all.add(language)));
    return latency([...all].sort());
  },

  async recommend(answers) {
    const scored = PSYCHOLOGISTS.filter((p) => p.acceptingNewPatients).map((psychologist) => {
      const reasons: string[] = [];
      let score = 0;

      const shared = psychologist.specialties.filter((specialty) =>
        answers.concerns.includes(specialty),
      );
      if (shared.length > 0) {
        score += shared.length * 2;
        reasons.push('Works with the areas you selected');
      }

      if (answers.supportType === 'first-time' && psychologist.specialties.includes('other')) {
        score += 1;
        reasons.push('Often sees people speaking to a psychologist for the first time');
      }

      if (answers.modality !== 'no-preference') {
        const offers = psychologist.services.some(
          (service) => service.modality === answers.modality,
        );
        if (offers) {
          score += 1;
          reasons.push(
            answers.modality === 'video'
              ? 'Offers video consultations'
              : 'Offers written consultations',
          );
        }
      }

      if (reasons.length === 0) {
        reasons.push('Currently accepting new patients');
      }

      return { psychologist, reasons, score };
    });

    const results = scored
      .sort((a, b) => b.score - a.score || a.psychologist.name.localeCompare(b.psychologist.name))
      .slice(0, 4)
      .map(({ psychologist, reasons }) => ({ psychologist, reasons }));

    return latency(results, 700);
  },
};
