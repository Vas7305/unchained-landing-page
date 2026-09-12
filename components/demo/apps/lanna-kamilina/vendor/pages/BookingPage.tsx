import { useSeo } from '../hooks/useSeo';
import { breadcrumbSchema } from '../lib/seo';
import { routes } from '../lib/routes';
import { useDeclareCta } from '../app/CtaContext';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { SectionHeader } from '../components/Typo';
import { BookingFlow } from '../features/booking/BookingFlow';

/**
 * Booking.
 *
 * `noindex` on purpose: this page is a transaction surface, not a landing
 * page, and the service pages are what should rank. The sticky mobile CTA is
 * suppressed here — the whole page already is the call to action.
 */
export function BookingPage() {
  useSeo({
    title: 'Запись онлайн — Lanna Kamilina, салон красоты в Москве',
    description:
      'Онлайн-запись в салон Lanna Kamilina: выберите услугу, мастера по желанию, дату и свободное время. Регистрация не нужна.',
    path: routes.booking,
    noindex: true,
    jsonLd: [
      breadcrumbSchema([
        { name: 'Главная', path: routes.home },
        { name: 'Запись', path: routes.booking },
      ]),
    ],
  });

  useDeclareCta({ label: 'Запись', from: 'booking', hidden: true });

  return (
    <div className="lk-section-y-tight">
      <div className="lk-shell">
        <Breadcrumbs
          items={[{ name: 'Главная', path: routes.home }, { name: 'Запись' }]}
          className="mb-8"
        />

        <SectionHeader
          eyebrow="Онлайн-запись"
          as="h1"
          title="Выберите удобное время"
          lead="Регистрация не нужна. Мастера можно не выбирать — «без предпочтения» открывает больше свободных окон."
        />

        <div className="mt-14">
          <BookingFlow />
        </div>
      </div>
    </div>
  );
}
