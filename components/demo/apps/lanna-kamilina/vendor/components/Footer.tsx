import { Link } from './AppLink';
import { bookingLink, routes } from '../lib/routes';
import { business, IS_DEMO_CONTENT, serviceCategories, yearsInBusiness } from '../data';
import { formatYears } from '../lib/format';
import { track } from '../lib/analytics';
import { ButtonLink } from './Button';
import { Logo } from './Logo';
import { ContactChannels, MapLinks, OpeningHoursList } from './ContactLinks';

/**
 * Footer.
 *
 * Doubles as the "I already know this salon" surface: contacts, hours and maps
 * are here so a returning visitor never has to hunt through navigation.
 */
export function Footer() {
  return (
    <footer className="mt-auto bg-lk-ink text-lk-paper">
      <div className="lk-shell lk-section-y-tight">
        <div className="flex flex-col gap-10 border-b border-lk-paper/12 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className="lk-type-display text-lk-paper">Записаться проще, чем выбирать.</p>
            <p className="lk-type-lead mt-4 text-lk-paper/70">
              Свободное время видно сразу — без звонка и без формы обратной связи.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink
              to={bookingLink({ from: 'footer' })}
              variant="light"
              size="lg"
              onClick={() => track('booking_started', { from: 'footer' })}
            >
              Посмотреть свободное время
            </ButtonLink>
            <ButtonLink
              to={routes.discovery}
              variant="secondary"
              size="lg"
              className="border-lk-paper/30 text-lk-paper hover:border-lk-paper hover:bg-lk-paper/10"
            >
              Подобрать образ
            </ButtonLink>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-10 py-12 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Logo tone="paper" />
            <p className="lk-type-small mt-4 max-w-xs text-lk-paper/60">
              Салон красоты в центре Москвы. {formatYears(yearsInBusiness())} работы, команда
              мастеров и результат, который можно повторить.
            </p>
          </div>

          <nav aria-label="Услуги">
            <p className="lk-type-eyebrow mb-4 text-lk-paper/45">Услуги</p>
            <ul className="flex flex-col gap-2.5">
              {serviceCategories.map((category) => (
                <li key={category.id}>
                  <Link
                    to={routes.serviceCategory(category.slug)}
                    className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper"
                  >
                    {category.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Разделы">
            <p className="lk-type-eyebrow mb-4 text-lk-paper/45">Салон</p>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link to={routes.works} className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper">
                  Работы
                </Link>
              </li>
              <li>
                <Link to={routes.specialists} className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper">
                  Мастера
                </Link>
              </li>
              <li>
                <Link to={routes.about} className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper">
                  О нас
                </Link>
              </li>
              <li>
                <Link to={routes.contacts} className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper">
                  Контакты
                </Link>
              </li>
              <li>
                <Link to={routes.discovery} className="lk-type-small text-lk-paper/75 transition-colors hover:text-lk-paper">
                  Подбор образа
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <p className="lk-type-eyebrow mb-4 text-lk-paper/45">Часы работы</p>
            <div className="[&_dt]:text-lk-paper/55 [&_dd]:text-lk-paper/85">
              <OpeningHoursList />
            </div>
            <div className="mt-6">
              <MapLinks
                surface="footer"
                className="[&_a]:border-lk-paper/25 [&_a]:text-lk-paper/80 [&_a:hover]:border-lk-paper [&_span]:border-lk-paper/25 [&_span]:text-lk-paper/50"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-lk-paper/12 pt-10">
          <div className="[&_.lk-type-meta]:text-lk-paper/45 [&_a]:border-lk-paper/25 [&_a]:text-lk-paper/85 [&_a:hover]:border-lk-paper">
            <ContactChannels surface="footer" layout="grid" />
          </div>
        </div>

        {IS_DEMO_CONTENT && (
          <p className="lk-type-meta mt-10 max-w-3xl border-l border-lk-paper/20 pl-4 text-lk-paper/45">
            Демонстрационная сборка. Услуги, цены, работы, мастера, отзывы и рейтинги —
            заполнители, подготовленные для замены на реальные данные салона. Контактные
            данные отмечены как незаполненные и не выдуманы.
          </p>
        )}

        <div className="mt-10 flex flex-col gap-4 border-t border-lk-paper/12 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="lk-type-meta text-lk-paper/45">
            © {new Date().getFullYear()} {business.name}. {business.legalCity}, с{' '}
            {business.foundedYear} года.
          </p>
          <Link to={routes.privacy} className="lk-type-meta text-lk-paper/45 transition-colors hover:text-lk-paper/80">
            Политика конфиденциальности
          </Link>
        </div>
      </div>
    </footer>
  );
}
