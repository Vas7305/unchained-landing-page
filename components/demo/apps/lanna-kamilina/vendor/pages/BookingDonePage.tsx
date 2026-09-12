import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { BookingConfirmation } from '../types';
import { ANY_SPECIALIST } from '../types';
import { useSeo } from '../hooks/useSeo';
import { routes } from '../lib/routes';
import { formatDateLabel, formatDuration, formatPrice, formatPhone } from '../lib/format';
import { business, getService, getSpecialist, placeholders } from '../data';
import { useDeclareCta } from '../app/CtaContext';
import { bookingHandoff, deliveryLabels } from '../features/booking/delivery';
import { Button, ButtonLink, ExternalButtonLink } from '../components/Button';
import { PlaceholderToken } from '../components/Meta';
import { phoneHref } from '../lib/format';
import { track } from '../lib/analytics';

/**
 * Confirmation.
 *
 * The confirmation lives in navigation state, so a refresh or a shared link
 * lands back on the booking form rather than showing a phantom appointment.
 * The reference code is quotable on the phone, which is what an administrator
 * will actually ask for.
 */
export function BookingDonePage() {
  const location = useLocation();
  const confirmation = location.state as BookingConfirmation | null;

  useSeo({
    title: 'Заявка на запись — Lanna Kamilina',
    description: 'Заявка на запись отправлена. Администратор подтвердит время.',
    path: routes.bookingDone,
    noindex: true,
  });

  useDeclareCta({ label: 'Готово', from: 'booking-done', hidden: true });

  if (!confirmation?.request) {
    return <Navigate to={routes.booking} replace />;
  }

  const { request } = confirmation;
  const service = getService(request.serviceId);
  const specialist =
    request.specialist === ANY_SPECIALIST ? null : getSpecialist(request.specialist);
  // The request travels to the salon over a messenger, and it is sent by the
  // visitor, not by us — so the page says so, and offers the handoff again in
  // case the tab we opened was blocked or closed.
  const handoff = confirmation.channel
    ? bookingHandoff(request, confirmation.reference, confirmation.channel)
    : null;

  return (
    <div className="lk-section-y">
      <div className="lk-shell">
        <div className="max-w-2xl">
          {handoff ? (
            <>
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-lk-line-strong text-lk-ink"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M3 10h13M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              <h1 className="lk-type-display mt-7">Остался один шаг</h1>
              <p className="lk-type-lead mt-5">
                {handoff.requiresPaste
                  ? 'Мы открыли Telegram и скопировали заявку — вставьте её в чат и отправьте. Администратор подтвердит время в том же чате.'
                  : 'Мы открыли WhatsApp с готовой заявкой — нажмите в нём «Отправить», и администратор её получит. Если вкладка не открылась, отправьте заявку отсюда.'}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <ExternalButtonLink
                  href={handoff.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  size="lg"
                  onClick={() =>
                    track(
                      handoff.channel === 'telegram' ? 'telegram_clicked' : 'whatsapp_clicked',
                      { surface: 'booking-done' },
                    )
                  }
                >
                  Открыть {deliveryLabels[handoff.channel]}
                </ExternalButtonLink>
                {handoff.requiresPaste && <CopyMessageButton message={handoff.message} />}
              </div>

              {handoff.requiresPaste && (
                <pre className="lk-type-small mt-5 overflow-x-auto border border-lk-line bg-lk-paper-2/60 px-5 py-4 whitespace-pre-wrap text-lk-ink-2">
                  {handoff.message}
                </pre>
              )}
            </>
          ) : (
            <>
              <span
                aria-hidden="true"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-lk-positive text-lk-positive"
              >
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>

              <h1 className="lk-type-display mt-7">Заявка отправлена</h1>
              <p className="lk-type-lead mt-5">
                Администратор подтвердит запись по телефону. Если что-то изменится, назовите
                номер заявки — так мы найдём вас быстрее.
              </p>
            </>
          )}

          <div className="mt-10 border border-lk-line">
            <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-lk-line bg-lk-paper-2/60 px-6 py-4">
              <span className="lk-type-eyebrow text-lk-muted">Номер заявки</span>
              <span className="lk-numeric lk-type-subtitle">{confirmation.reference}</span>
            </div>

            <dl className="flex flex-col gap-4 px-6 py-6">
              <Row label="Услуга" value={service?.title} />
              <Row label="Мастер" value={specialist?.name ?? 'Без предпочтения'} />
              <Row
                label="Когда"
                value={`${formatDateLabel(request.date)}, ${request.time}`}
              />
              <Row
                label="Длительность"
                value={service ? formatDuration(service.duration) : undefined}
              />
              <Row label="Стоимость" value={service ? formatPrice(service.price) : undefined} />
              <Row label="Имя" value={request.name} />
              <Row label="Телефон" value={request.phone} />
            </dl>
          </div>

          <p className="lk-type-small mt-6 text-lk-muted">
            Нужно перенести или отменить визит? Позвоните в салон —{' '}
            {business.phone ? (
              <a
                href={phoneHref(business.phone)}
                onClick={() => track('phone_clicked', { surface: 'booking-done' })}
                className="border-b border-lk-line-strong pb-0.5 text-lk-ink transition-colors hover:border-lk-ink"
              >
                {formatPhone(business.phone)}
              </a>
            ) : (
              <PlaceholderToken>{placeholders.phone}</PlaceholderToken>
            )}
            .
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink to={routes.works} size="lg">
              Посмотреть работы
            </ButtonLink>
            <ButtonLink to={routes.home} variant="secondary" size="lg">
              На главную
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <dt className="lk-type-small text-lk-muted">{label}</dt>
      <dd className="lk-type-small text-right">{value}</dd>
    </div>
  );
}

/**
 * Copy fallback.
 *
 * The clipboard write on submit can be refused — a browser that blocked it, or
 * a visitor who came back to this page later. Copying is the whole booking for
 * Telegram, so it gets a visible, retryable button rather than silent hope.
 */
function CopyMessageButton({ message }: { message: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button variant="secondary" size="lg" onClick={copy}>
      {copied ? 'Скопировано' : 'Скопировать заявку'}
    </Button>
  );
}
