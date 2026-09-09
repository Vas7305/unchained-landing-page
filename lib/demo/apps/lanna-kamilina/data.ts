/**
 * Lanna Kamilina demo fixtures.
 *
 * A salon open in central Moscow since 1999: a service list, the masters who
 * perform them, their working days and a wall of finished work. Invented
 * people, invented prices, invented telephone numbers — the salon is real, so
 * publishing its actual price list and its actual staff rota on our own
 * website is exactly what §7 rules out.
 *
 * Prices are in kopeks, the same reason TanCerca counts centavos.
 */

export interface DemoService {
  id: string;
  category: string;
  name: string;
  /** Minutes in the chair. Drives the slot grid. */
  duration: number;
  /** Price in kopeks. */
  price: number;
  description: string;
}

export interface DemoMaster {
  id: string;
  name: string;
  title: string;
  since: number;
  /** Service categories this master performs. */
  categories: readonly string[];
  /** Weekdays off, 0 = Monday through 6 = Sunday. */
  daysOff: readonly number[];
}

export interface DemoWork {
  id: string;
  title: string;
  category: string;
}

export const categories = ['Стрижка', 'Окрашивание', 'Уход', 'Маникюр'] as const;

export const services: readonly DemoService[] = [
  {
    id: 'strizhka-zhen',
    category: 'Стрижка',
    name: 'Женская стрижка',
    duration: 60,
    price: 350_000,
    description: 'Консультация, мытьё, стрижка и укладка.',
  },
  {
    id: 'strizhka-muzh',
    category: 'Стрижка',
    name: 'Мужская стрижка',
    duration: 45,
    price: 250_000,
    description: 'Машинка и ножницы, оформление контура.',
  },
  {
    id: 'ukladka',
    category: 'Стрижка',
    name: 'Укладка',
    duration: 45,
    price: 220_000,
    description: 'Укладка любой сложности без стрижки.',
  },
  {
    id: 'okrashivanie-baza',
    category: 'Окрашивание',
    name: 'Окрашивание в один тон',
    duration: 120,
    price: 620_000,
    description: 'Краска, уход после окрашивания и укладка.',
  },
  {
    id: 'airtouch',
    category: 'Окрашивание',
    name: 'Airtouch',
    duration: 240,
    price: 1_450_000,
    description: 'Сложное растяжение цвета с мягкой границей.',
  },
  {
    id: 'tonirovanie',
    category: 'Окрашивание',
    name: 'Тонирование',
    duration: 90,
    price: 480_000,
    description: 'Освежение цвета и блеска между окрашиваниями.',
  },
  {
    id: 'keratin',
    category: 'Уход',
    name: 'Кератиновое выпрямление',
    duration: 180,
    price: 980_000,
    description: 'Разглаживание и защита длины на 3–4 месяца.',
  },
  {
    id: 'uvlazhnenie',
    category: 'Уход',
    name: 'Глубокое увлажнение',
    duration: 60,
    price: 340_000,
    description: 'Восстановление после отпуска или осветления.',
  },
  {
    id: 'manikur',
    category: 'Маникюр',
    name: 'Маникюр с покрытием',
    duration: 90,
    price: 300_000,
    description: 'Аппаратный маникюр и гель-лак.',
  },
  {
    id: 'pedikur',
    category: 'Маникюр',
    name: 'Педикюр',
    duration: 90,
    price: 380_000,
    description: 'Аппаратный педикюр с покрытием.',
  },
];

export const masters: readonly DemoMaster[] = [
  {
    id: 'lanna',
    name: 'Ланна Камилина',
    title: 'Основатель салона, топ-стилист',
    since: 1999,
    categories: ['Стрижка', 'Окрашивание', 'Уход'],
    daysOff: [6],
  },
  {
    id: 'marina',
    name: 'Марина Т.',
    title: 'Колорист',
    since: 2011,
    categories: ['Окрашивание', 'Уход'],
    daysOff: [0, 6],
  },
  {
    id: 'olga',
    name: 'Ольга К.',
    title: 'Стилист-парикмахер',
    since: 2016,
    categories: ['Стрижка', 'Уход'],
    daysOff: [2],
  },
  {
    id: 'dasha',
    name: 'Дарья С.',
    title: 'Мастер маникюра и педикюра',
    since: 2019,
    categories: ['Маникюр'],
    daysOff: [0],
  },
];

export const works: readonly DemoWork[] = [
  { id: 'w1', title: 'Airtouch на тёмную базу', category: 'Окрашивание' },
  { id: 'w2', title: 'Каре с удлинением', category: 'Стрижка' },
  { id: 'w3', title: 'Тонирование в холодный блонд', category: 'Окрашивание' },
  { id: 'w4', title: 'Кератин на длину ниже лопаток', category: 'Уход' },
  { id: 'w5', title: 'Короткая стрижка пикси', category: 'Стрижка' },
  { id: 'w6', title: 'Френч в молочном тоне', category: 'Маникюр' },
];

/** Slot grid. The salon works 10:00–20:30, in ninety-minute starts. */
export const SLOT_TIMES = [
  '10:00',
  '11:30',
  '13:00',
  '14:30',
  '16:00',
  '17:30',
  '19:00',
] as const;

/** How many days ahead the booking calendar offers. */
export const BOOKING_DAYS = 7;

/**
 * The slot that is always taken between choosing it and confirming it.
 *
 * Every booking system has this race, and a demo that never shows it is
 * demonstrating a booking system nobody has ever built. It is one fixed
 * master, day and time (§20: deterministic, reachable on purpose), and after
 * it fires the slot is marked taken so the visitor picks another and succeeds
 * — which is the behaviour worth showing, not the error itself.
 *
 * It has to be a slot the visitor can actually reach: a master who works that
 * weekday, at a time `busy()` leaves free, with other free times left in the
 * same day so the retry has somewhere to go. Ольга works day 1 and has 11:30,
 * 14:30, 16:00 and 19:00 open on it.
 */
export const CONTESTED_SLOT = { masterId: 'olga', dayOffset: 1, time: '16:00' };

export function findService(id: string): DemoService | undefined {
  return services.find((s) => s.id === id);
}

export function findMaster(id: string): DemoMaster | undefined {
  return masters.find((m) => m.id === id);
}

/** The masters who perform a given service. */
export function mastersFor(serviceId: string): DemoMaster[] {
  const service = findService(serviceId);
  if (!service) return [];
  return masters.filter((master) => master.categories.includes(service.category));
}

/** A stable pseudo-random bit, so a master's diary looks lived-in and never
 *  changes between renders or reloads. */
function busy(masterId: string, dayOffset: number, time: string): boolean {
  const seed = `${masterId}:${dayOffset}:${time}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 10 < 4;
}

export interface DemoSlot {
  time: string;
  available: boolean;
}

/** One master's day, as the booking grid shows it. */
export function slotsFor(
  masterId: string,
  dayOffset: number,
  weekday: number,
  blocked: readonly string[] = [],
): DemoSlot[] {
  const master = findMaster(masterId);
  if (!master || master.daysOff.includes(weekday)) {
    return SLOT_TIMES.map((time) => ({ time, available: false }));
  }

  return SLOT_TIMES.map((time) => ({
    time,
    available:
      !busy(masterId, dayOffset, time) &&
      !blocked.includes(slotKey(masterId, dayOffset, time)),
  }));
}

export function slotKey(
  masterId: string,
  dayOffset: number,
  time: string,
): string {
  return `${masterId}|${dayOffset}|${time}`;
}
