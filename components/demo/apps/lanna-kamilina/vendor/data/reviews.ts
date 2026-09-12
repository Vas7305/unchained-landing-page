import type { ReputationSummary, Review } from '../types';

/**
 * Reviews — DEMO CONTENT.
 *
 * These are illustrative and marked `source: 'mock'`, which keeps them out of
 * structured data. Real reviews should be imported from Yandex and 2GIS and
 * re-marked `real`; nothing in the UI needs to change when that happens.
 *
 * Reviews are anchored to a service, a specialist or a specific result, so
 * they can be shown at the exact moment a doubt appears instead of piled into
 * a testimonial wall nobody reads.
 */

const mock = { source: 'mock' } as const;

export const reviews: Review[] = [
  {
    ...mock,
    id: 'rv-blonde-1',
    author: 'Екатерина',
    rating: 5,
    text: 'Пришла после неудачного осветления в другом месте, с рыжиной по длине. Марина честно сказала, что за один раз не вытянем, и расписала два визита. После второго цвет ровный, волосы живые.',
    date: '2026-05-18',
    platform: 'yandex',
    serviceIds: ['svc-blonde'],
    specialistId: 'sp-marina',
    portfolioItemId: 'pf-blonde-transformation',
  },
  {
    ...mock,
    id: 'rv-colour-1',
    author: 'Наталья',
    rating: 5,
    text: 'Делала airtouch. Отросшие корни теперь не бросаются в глаза совсем, хожу между окрашиваниями почти четыре месяца.',
    date: '2026-04-02',
    platform: '2gis',
    serviceIds: ['svc-colour-complex'],
    specialistId: 'sp-marina',
    portfolioItemId: 'pf-airtouch',
  },
  {
    ...mock,
    id: 'rv-cut-1',
    author: 'Ирина',
    rating: 5,
    text: 'Первый раз за долгое время стрижка, которую я могу повторить дома. Анна показала, как укладывать, и это заняло у меня пять минут утром.',
    date: '2026-06-11',
    platform: 'yandex',
    serviceIds: ['svc-womens-cut'],
    specialistId: 'sp-anna',
    portfolioItemId: 'pf-bob',
  },
  {
    ...mock,
    id: 'rv-evening-1',
    author: 'Мария',
    rating: 5,
    text: 'Макияж и укладка на вечер. В ресторане при тёплом свете выглядело именно так, как в салоне, ничего не поплыло к ночи.',
    date: '2026-03-22',
    platform: 'site',
    serviceIds: ['svc-evening-look', 'svc-makeup-evening'],
    specialistId: 'sp-olga',
    portfolioItemId: 'pf-evening-look',
  },
  {
    ...mock,
    id: 'rv-wedding-1',
    author: 'Алина',
    rating: 5,
    text: 'Была репетиция за две недели, поменяли помаду и убрали блёстки — на съёмке это было бы лишним. В день свадьбы всё прошло по плану, вечером макияж был на месте.',
    date: '2026-07-05',
    platform: 'yandex',
    serviceIds: ['svc-wedding-look', 'svc-makeup-wedding'],
    specialistId: 'sp-olga',
    portfolioItemId: 'pf-wedding-1',
  },
  {
    ...mock,
    id: 'rv-photo-1',
    author: 'Вероника',
    rating: 5,
    text: 'Снимали в студии со сложным светом. Фотограф отдельно отметил, что тон не бликует.',
    date: '2026-02-14',
    platform: 'site',
    serviceIds: ['svc-makeup-photo', 'svc-photo-look'],
    specialistId: 'sp-olga',
    portfolioItemId: 'pf-photo-look',
  },
  {
    ...mock,
    id: 'rv-care-1',
    author: 'Светлана',
    rating: 5,
    text: 'После долгого блонда длина была как солома. Три процедуры ухода и аккуратная стрижка концов — расчёсываются нормально, и цвет держится дольше.',
    date: '2026-05-29',
    platform: '2gis',
    serviceIds: ['svc-hair-care'],
    specialistId: 'sp-anna',
    portfolioItemId: 'pf-recovery',
  },
  {
    ...mock,
    id: 'rv-nails-1',
    author: 'Ольга',
    rating: 5,
    text: 'Маникюр держится ровно три недели без сколов, форма одинаковая от визита к визиту.',
    date: '2026-06-30',
    platform: 'yandex',
    serviceIds: ['svc-manicure'],
    specialistId: 'sp-daria',
  },
  {
    ...mock,
    id: 'rv-brows-1',
    author: 'Дарья',
    rating: 5,
    text: 'Елена не стала делать модную форму, а подобрала под лицо. Разница небольшая, но выглядит гораздо лучше.',
    date: '2026-04-19',
    platform: '2gis',
    serviceIds: ['svc-brows'],
    specialistId: 'sp-elena',
  },
  {
    ...mock,
    id: 'rv-facial-1',
    author: 'Анна',
    rating: 5,
    text: 'Перед мероприятием делала уход. Предупредили, что за день до лучше не приходить, и предложили за четыре — совет оказался верным.',
    date: '2026-03-08',
    platform: 'site',
    serviceIds: ['svc-facial'],
    specialistId: 'sp-elena',
  },
  {
    ...mock,
    id: 'rv-styling-1',
    author: 'Юлия',
    rating: 5,
    text: 'Записалась на укладку за час до события, успели и сделали именно то, что я показала на фото.',
    date: '2026-07-21',
    platform: 'yandex',
    serviceIds: ['svc-styling'],
    specialistId: 'sp-anna',
  },
  {
    ...mock,
    id: 'rv-mens-1',
    author: 'Дмитрий',
    rating: 5,
    text: 'Хожу к Кириллу второй год. Стрижка одинаковая каждый раз, без сюрпризов.',
    date: '2026-06-02',
    platform: '2gis',
    serviceIds: ['svc-mens-cut'],
    specialistId: 'sp-kirill',
  },
  {
    ...mock,
    id: 'rv-general-1',
    author: 'Татьяна',
    rating: 5,
    text: 'Хожу сюда больше десяти лет, ещё с прошлого адреса. Меняются мастера, не меняется отношение.',
    date: '2026-01-25',
    platform: 'yandex',
  },
  {
    ...mock,
    id: 'rv-general-2',
    author: 'Ксения',
    rating: 4,
    text: 'Отличный результат, но в субботу вечером пришлось немного подождать. В будни такого не было ни разу.',
    date: '2026-05-04',
    platform: '2gis',
  },
];

/**
 * Aggregate reputation. Marked `mock` until the real Yandex and 2GIS figures
 * are pulled in — the SEO layer refuses to publish unverified ratings.
 */
export const reputation: ReputationSummary[] = [
  {
    ...mock,
    platform: 'yandex',
    label: 'Яндекс Карты',
    rating: { value: 4.9, count: 312 },
  },
  {
    ...mock,
    platform: '2gis',
    label: '2ГИС',
    rating: { value: 4.8, count: 187 },
  },
];
