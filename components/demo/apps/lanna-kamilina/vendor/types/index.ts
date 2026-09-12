/**
 * Domain models for Lanna Kamilina.
 *
 * These types are the contract between the UI and whatever eventually
 * supplies content: a CMS, a booking system, a CRM. Today they are backed by
 * `src/data/*` mock modules; swapping in a real source must not require
 * touching a single component.
 */

/* ------------------------------------------------------------------ shared */

/** A money amount in whole roubles. Never a formatted string — format at render. */
export type Rub = number;

/** Minutes. Durations are ranges because a colouring job depends on hair length. */
export interface DurationRange {
  min: number;
  max?: number;
}

export interface PriceInfo {
  /** Lowest realistic price. Rendered as "от N ₽" when `exact` is false. */
  from: Rub;
  /** Upper bound where the salon quotes a band rather than a single number. */
  to?: Rub;
  /** True when the price is fixed and can be shown without "от". */
  exact: boolean;
  /** What moves the price — shown verbatim under the number. Keeps "от" honest. */
  factors?: string[];
}

/** Marks content that is demo data, so the UI can be honest about it. */
export interface Provenance {
  /** `mock` content must never be presented as a real business claim. */
  source: 'mock' | 'real';
}

/* ---------------------------------------------------------------- services */

export type ServiceCategoryId =
  | 'hair'
  | 'colour'
  | 'makeup'
  | 'nails'
  | 'care'
  | 'occasions';

export interface ServiceCategory {
  id: ServiceCategoryId;
  slug: string;
  title: string;
  /** One line that says what the category is for, in customer language. */
  intent: string;
  description: string;
  image?: ImageRef;
}

export interface Service extends Provenance {
  id: string;
  slug: string;
  categoryId: ServiceCategoryId;
  title: string;
  /** The outcome, not the procedure. Shown under the title. */
  outcome: string;
  description: string;
  /** Bulleted "what happens" — keeps the detail page scannable. */
  includes?: string[];
  price: PriceInfo;
  duration: DurationRange;
  /** Ids of specialists who perform this service. */
  specialistIds: string[];
  /** Tags shared with portfolio items, used to pull matching results. */
  tags: string[];
  image?: ImageRef;
  /** Surfaces the service in category landing rails and search. */
  featured?: boolean;
  seo?: SeoOverrides;
}

/* ------------------------------------------------------------- specialists */

export interface Specialist extends Provenance {
  id: string;
  slug: string;
  name: string;
  /** "Колорист", "Стилист-парикмахер" … */
  role: string;
  /** Years of practice, not year of birth. */
  experienceYears: number;
  /** Two or three sentences, first person avoided. */
  bio: string;
  /** Short list of what they are actually known for. */
  focus: string[];
  serviceIds: string[];
  rating?: Rating;
  portrait?: ImageRef;
  /** A specialist may be temporarily unavailable without being deleted. */
  acceptingBookings: boolean;
}

/** The sentinel used when the customer does not care who performs the service. */
export const ANY_SPECIALIST = 'any' as const;
export type SpecialistSelection = string | typeof ANY_SPECIALIST;

/* --------------------------------------------------------------- portfolio */

export interface ImageRef {
  /** Absent while real photography is pending — the UI renders a placeholder. */
  src?: string;
  alt: string;
  /** Drives the deterministic placeholder so layouts stay stable without photos. */
  seed?: string;
  width?: number;
  height?: number;
}

export interface BeforeAfter {
  before: ImageRef;
  after: ImageRef;
}

export interface PortfolioItem extends Provenance {
  id: string;
  slug: string;
  title: string;
  /** "Окрашивание + тонирование + укладка" — the work, in one line. */
  summary: string;
  serviceIds: string[];
  specialistId: string;
  tags: string[];
  image: ImageRef;
  /** Present only where a genuine before/after pair exists. */
  beforeAfter?: BeforeAfter;
  /** Id of a review tied to this exact result. */
  reviewId?: string;
  /** Portrait cards get more vertical space in the masonry rail. */
  orientation: 'portrait' | 'landscape' | 'square';
  featured?: boolean;
}

/* ----------------------------------------------------------------- reviews */

export interface Rating {
  /** 0–5, one decimal. */
  value: number;
  count: number;
}

export type ReviewSource = 'yandex' | '2gis' | 'vk' | 'site';

export interface Review extends Provenance {
  id: string;
  /** First name + initial is the norm on Russian review platforms. */
  author: string;
  rating: number;
  text: string;
  /** ISO date. */
  date: string;
  platform: ReviewSource;
  /** Contextual anchoring — a review shows up where it reduces doubt. */
  serviceIds?: string[];
  specialistId?: string;
  portfolioItemId?: string;
}

/* ------------------------------------------------------------- reputation */

export interface ReputationSummary extends Provenance {
  platform: ReviewSource;
  label: string;
  rating: Rating;
  url?: string;
}

/* ------------------------------------------------------------ availability */

/** ISO `YYYY-MM-DD`. */
export type IsoDate = string;
/** `HH:MM`, salon-local time. */
export type TimeSlot = string;

export interface DayAvailability {
  date: IsoDate;
  /** Empty array means the salon is open but fully booked; `closed` means shut. */
  slots: TimeSlot[];
  closed: boolean;
}

export interface AvailabilityQuery {
  serviceId: string;
  specialist: SpecialistSelection;
  /** Inclusive start of the window to fetch. */
  from: IsoDate;
  days: number;
}

/* --------------------------------------------------------------- booking */

export interface BookingDraft {
  serviceId: string | null;
  specialist: SpecialistSelection;
  date: IsoDate | null;
  time: TimeSlot | null;
  name: string;
  phone: string;
  comment: string;
  /** Consent is required by Russian personal-data law (152-ФЗ). */
  consent: boolean;
}

export interface BookingRequest {
  serviceId: string;
  specialist: SpecialistSelection;
  date: IsoDate;
  time: TimeSlot;
  name: string;
  phone: string;
  comment?: string;
  /** Where the booking came from — preserved through deep links. */
  attribution?: Attribution;
}

export interface BookingConfirmation {
  id: string;
  request: BookingRequest;
  /** Human-readable code the customer can quote on the phone. */
  reference: string;
  createdAt: string;
  /** Which messenger the request was handed to, when it was handed to one. */
  channel?: 'whatsapp' | 'telegram';
  /**
   * The master the slot was actually held against. Present even when the
   * visitor chose «без предпочтения» — an hour has to come out of someone's
   * day, or the calendar would go on offering time that is already sold.
   */
  assignedSpecialist?: string;
}

export interface Attribution {
  source?: string;
  campaign?: string;
  /** The entry route: which page the visitor landed on first. */
  landing?: string;
}

/* -------------------------------------------------------------- discovery */

export type DiscoveryQuestionId = string;

export interface DiscoveryOption {
  id: string;
  label: string;
  /** Optional supporting line for options that are not self-explanatory. */
  hint?: string;
  /** Where to go next; `null` ends the flow and resolves a recommendation. */
  next: DiscoveryQuestionId | null;
  /** Tags accumulated by picking this option; they drive the recommendation. */
  tags: string[];
}

export interface DiscoveryQuestion {
  id: DiscoveryQuestionId;
  title: string;
  /** Kept short — this is a two-to-three step flow, never a quiz. */
  hint?: string;
  options: DiscoveryOption[];
}

export interface DiscoveryAnswer {
  questionId: DiscoveryQuestionId;
  optionId: string;
}

export interface Recommendation {
  /** The headline result: "Вечерний образ". */
  title: string;
  /** Why this was recommended, in one sentence the customer can verify. */
  rationale: string;
  serviceIds: string[];
  specialistIds: string[];
  portfolioIds: string[];
  priceFrom: Rub;
  duration: DurationRange;
  /** Tags carried into the booking link so the context is not lost. */
  tags: string[];
}

/* ---------------------------------------------------------------- business */

/**
 * Verified business facts. Unknown values are `null` and rendered as an
 * explicit placeholder token — never invented. See `src/data/business.ts`.
 */
export interface BusinessInformation {
  name: string;
  legalCity: string;
  foundedYear: number;
  address: string | null;
  metro: string | null;
  phone: string | null;
  email: string | null;
  telegram: string | null;
  whatsapp: string | null;
  yandexMapsUrl: string | null;
  twoGisUrl: string | null;
  vkUrl: string | null;
  instagramUrl: string | null;
  openingHours: OpeningHours[];
  coordinates: { lat: number; lng: number } | null;
}

export interface OpeningHours {
  /** `Mo`–`Su`, schema.org day codes. */
  days: string[];
  label: string;
  opens: string | null;
  closes: string | null;
}

/* --------------------------------------------------------------------- seo */

export interface SeoOverrides {
  title?: string;
  description?: string;
  keywords?: string[];
}

export interface SeoInput {
  title: string;
  description: string;
  /** Path only; the canonical origin is added by the SEO layer. */
  path: string;
  image?: string;
  type?: 'website' | 'article' | 'profile';
  /** JSON-LD graph nodes contributed by the page. */
  jsonLd?: Record<string, unknown>[];
  noindex?: boolean;
}
