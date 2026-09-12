import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { BookingRequest, IsoDate, Specialist, SpecialistSelection, TimeSlot } from '../../types';
import { ANY_SPECIALIST } from '../../types';
import { cn } from '../../lib/utils';
import { routes } from '../../lib/routes';
import { track } from '../../lib/analytics';
import { readAttribution } from '../../lib/attribution';
import { formatDateLabel, formatDuration, formatPrice } from '../../lib/format';
import {
  getService,
  getServiceBySlug,
  getSpecialist,
  getSpecialistBySlug,
  getSpecialistsForService,
  serviceCategories,
  services,
} from '../../data';
import { Button } from '../../components/Button';
import { Checkbox, Field, TextArea, TextInput } from '../../components/Field';
import { Figure } from '../../components/Figure';
import { AvailabilityPicker } from './AvailabilityPicker';
import { useAvailability } from './useAvailability';
import { bookingApi, SlotUnavailableError } from './api';
import { availableChannels, deliveryLabels } from './delivery';
import type { DeliveryChannel } from './delivery';

/**
 * Booking flow.
 *
 * Four decisions, in the order a customer actually makes them, all on one
 * page: service, (optional) specialist, time, contact details. No account, no
 * lead form standing between the visitor and the calendar, and no required
 * choice of specialist — "без предпочтения" is a first-class answer that
 * genuinely returns more availability.
 *
 * Every step reads its initial value from the URL, so a campaign can link
 * straight to «Марина + блонд» and land on a half-filled form.
 */

type StepId = 'service' | 'specialist' | 'time' | 'contacts';

/**
 * Phone validation.
 *
 * Russian numbers are the common case and keep their familiar shapes
 * (`+7 999 123-45-67`, `8 999 1234567`, `999 123-45-67`). A number written
 * with a country code is accepted as E.164 — a visitor abroad, or a test
 * number, should not be told their real phone is malformed.
 */
function isValidPhone(raw: string): boolean {
  const value = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(value)) return false;

  const digits = value.replace(/\D/g, '');
  if (/^[78]\d{10}$/.test(digits)) return true;
  if (value.startsWith('+')) return digits.length >= 8 && digits.length <= 15;
  return digits.length === 10;
}

export function BookingFlow() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const initialService = getServiceBySlug(params.get('service') ?? '');
  const specialistParam = params.get('specialist');
  const initialSpecialist: SpecialistSelection =
    specialistParam && specialistParam !== ANY_SPECIALIST
      ? (getSpecialistBySlug(specialistParam)?.id ?? ANY_SPECIALIST)
      : ANY_SPECIALIST;

  const [serviceId, setServiceId] = useState<string | null>(initialService?.id ?? null);
  const [specialist, setSpecialist] = useState<SpecialistSelection>(initialSpecialist);
  // Lazy: the initializer only matters on the first render, but the
  // non-lazy form re-reads the query string on every one thereafter and throws
  // the result away.
  const [date, setDate] = useState<IsoDate | null>(() => params.get('date'));
  const [time, setTime] = useState<TimeSlot | null>(() => params.get('time'));
  const [openStep, setOpenStep] = useState<StepId>(initialService ? 'time' : 'service');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [comment, setComment] = useState('');
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  // Which channel is mid-flight, so only that button says «Отправляем…».
  const [submitting, setSubmitting] = useState<DeliveryChannel | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const service = serviceId ? getService(serviceId) : undefined;
  const eligible = useMemo(
    () => (serviceId ? getSpecialistsForService(serviceId) : []),
    [serviceId],
  );

  const availability = useAvailability(serviceId, specialist);

  // A chosen time can stop existing while the form is open — someone books it
  // in another tab, or the lead-time cutoff rolls past it. Dropping it here is
  // kinder than letting the visitor send a time the salon cannot give them.
  //
  // Checked during render, not from an effect. The effect version painted the
  // chosen time once more before clearing it, so the slot the visitor had just
  // lost was still sitting there highlighted in the frame they were looking at.
  const chosenDay = date ? availability.days.find((item) => item.date === date) : undefined;
  if (date && time && chosenDay && !chosenDay.slots.includes(time)) {
    setTime(null);
    setOpenStep('time');
  }

  // Fires only once a real schedule is being requested. Reporting it on an
  // empty booking page would inflate the step that matters most in the funnel.
  useEffect(() => {
    if (!service) return;
    track('availability_opened', { service: service.slug, specialist });
  }, [service, specialist]);

  /** Keeps the URL shareable and the back button meaningful. */
  const syncUrl = useCallback(
    (next: { service?: string | null; specialist?: SpecialistSelection }) => {
      const updated = new URLSearchParams(params);
      if (next.service !== undefined) {
        if (next.service) updated.set('service', next.service);
        else updated.delete('service');
      }
      if (next.specialist !== undefined) {
        const slug =
          next.specialist === ANY_SPECIALIST
            ? ANY_SPECIALIST
            : (getSpecialist(next.specialist)?.slug ?? ANY_SPECIALIST);
        updated.set('specialist', slug);
      }
      setParams(updated, { replace: true });
    },
    [params, setParams],
  );

  const chooseService = (id: string) => {
    setServiceId(id);
    setTime(null);
    setDate(null);
    // A specialist who does not perform the new service must not silently persist.
    if (specialist !== ANY_SPECIALIST && !getSpecialist(specialist)?.serviceIds.includes(id)) {
      setSpecialist(ANY_SPECIALIST);
    }
    syncUrl({ service: getService(id)?.slug ?? null });
    setOpenStep('specialist');
    track('booking_step_completed', { step: 'service', service: getService(id)?.slug });
  };

  const chooseSpecialist = (next: SpecialistSelection) => {
    setSpecialist(next);
    setTime(null);
    syncUrl({ specialist: next });
    setOpenStep('time');
    track('booking_step_completed', { step: 'specialist', specialist: next });
  };

  const chooseTime = (slot: TimeSlot) => {
    setTime(slot);
    setOpenStep('contacts');
    track('booking_step_completed', { step: 'time', date, time: slot });
  };

  const nameError = touched && name.trim().length < 2 ? 'Укажите имя' : undefined;
  const phoneError =
    touched && !isValidPhone(phone)
      ? 'Укажите телефон: +7 999 123-45-67 или международный номер с кодом страны'
      : undefined;
  const consentError = touched && !consent ? 'Без согласия мы не сможем сохранить заявку' : undefined;
  const ready = Boolean(serviceId && date && time);
  const channels = availableChannels();

  const submit = async (channel: DeliveryChannel) => {
    setTouched(true);
    if (!ready || !serviceId || !date || !time) return;
    if (name.trim().length < 2 || !isValidPhone(phone) || !consent) return;

    setSubmitting(channel);
    setSubmitError(null);

    const request: BookingRequest = {
      serviceId,
      specialist,
      date,
      time,
      name: name.trim(),
      phone: phone.trim(),
      comment: comment.trim() || undefined,
      attribution: readAttribution(),
    };

    try {
      const confirmation = await bookingApi.submit(request, channel);
      track('booking_completed', {
        service: service?.slug ?? null,
        specialist,
        date,
        time,
        channel,
        reference: confirmation.reference,
      });
      navigate(routes.bookingDone, { state: confirmation });
    } catch (error) {
      const taken = error instanceof SlotUnavailableError;
      track('booking_failed', {
        service: service?.slug ?? null,
        channel,
        reason: taken ? 'slot_taken' : 'delivery',
      });

      if (taken) {
        // The slot went while the form was being filled in. Say so plainly and
        // send the visitor back to a calendar that no longer offers it.
        setTime(null);
        setOpenStep('time');
        setSubmitError(
          'Это время только что заняли. Выберите, пожалуйста, другое — свободные часы уже обновлены.',
        );
      } else {
        setSubmitError(
          'Не получилось отправить заявку. Попробуйте ещё раз или позвоните в салон — время мы удержим.',
        );
      }
      setSubmitting(null);
    }
  };

  const specialistLabel =
    specialist === ANY_SPECIALIST
      ? 'Без предпочтения'
      : (getSpecialist(specialist)?.name ?? 'Без предпочтения');

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
      <div className="flex flex-col">
        <Step
          index={1}
          id="service"
          title="Услуга"
          summary={service ? service.title : undefined}
          open={openStep === 'service'}
          onOpen={() => setOpenStep('service')}
        >
          <ServiceChooser selectedId={serviceId} onSelect={chooseService} />
        </Step>

        <Step
          index={2}
          id="specialist"
          title="Мастер"
          summary={serviceId ? specialistLabel : undefined}
          optional
          open={openStep === 'specialist'}
          onOpen={() => serviceId && setOpenStep('specialist')}
          disabled={!serviceId}
        >
          <SpecialistChooser
            eligible={eligible}
            selected={specialist}
            onSelect={chooseSpecialist}
          />
        </Step>

        <Step
          index={3}
          id="time"
          title="Дата и время"
          summary={date && time ? `${formatDateLabel(date)}, ${time}` : undefined}
          open={openStep === 'time'}
          onOpen={() => serviceId && setOpenStep('time')}
          disabled={!serviceId}
        >
          <AvailabilityPicker
            days={availability.days}
            loading={availability.loading}
            error={availability.error}
            date={date}
            time={time}
            onSelectDate={(next) => {
              setDate(next);
              setTime(null);
            }}
            onSelectTime={chooseTime}
          />
        </Step>

        <Step
          index={4}
          id="contacts"
          title="Ваши данные"
          open={openStep === 'contacts'}
          onOpen={() => ready && setOpenStep('contacts')}
          disabled={!ready}
          last
        >
          <ContactForm
            name={name}
            phone={phone}
            comment={comment}
            consent={consent}
            nameError={nameError}
            phoneError={phoneError}
            consentError={consentError}
            submitError={submitError}
            submitting={submitting}
            channels={channels}
            onName={setName}
            onPhone={setPhone}
            onComment={setComment}
            onConsent={setConsent}
            onSubmit={submit}
          />
        </Step>
      </div>

      <BookingSummary
        serviceTitle={service?.title}
        priceLabel={service ? formatPrice(service.price) : undefined}
        durationLabel={service ? formatDuration(service.duration) : undefined}
        specialistLabel={serviceId ? specialistLabel : undefined}
        dateLabel={date && time ? `${formatDateLabel(date)}, ${time}` : undefined}
        factors={service?.price.factors}
      />
    </div>
  );
}

/* ------------------------------------------------------- specialist step */

/**
 * Choosing a master, or explicitly not choosing one.
 *
 * "Без предпочтения" is first and framed as the easier option rather than as a
 * fallback, because it genuinely has more free time — the calendar pools every
 * eligible master's availability behind it.
 */
function SpecialistChooser({
  eligible,
  selected,
  onSelect,
}: {
  eligible: Specialist[];
  selected: SpecialistSelection;
  onSelect: (next: SpecialistSelection) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="lk-type-small text-lk-muted">
        Выбор мастера не обязателен. «Без предпочтения» обычно даёт больше свободного
        времени — запись уйдёт к любому мастеру, который выполняет эту услугу.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <SpecialistOption
          active={selected === ANY_SPECIALIST}
          title="Без предпочтения по мастеру"
          subtitle={`${eligible.length} мастеров выполняют услугу`}
          onClick={() => onSelect(ANY_SPECIALIST)}
        />
        {eligible.map((item) => (
          <SpecialistOption
            key={item.id}
            active={selected === item.id}
            title={item.name}
            subtitle={item.role}
            portraitSeed={item.portrait?.seed}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- contact step */

interface ContactFormProps {
  name: string;
  phone: string;
  comment: string;
  consent: boolean;
  /** Validation messages, present only once the visitor has tried to submit. */
  nameError?: string;
  phoneError?: string;
  consentError?: string;
  /** A failure from the last attempt — a taken slot, or a delivery problem. */
  submitError: string | null;
  /** Which channel is mid-flight, so only that button says «Открываем…». */
  submitting: DeliveryChannel | null;
  channels: DeliveryChannel[];
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onComment: (value: string) => void;
  onConsent: (value: boolean) => void;
  onSubmit: (channel: DeliveryChannel) => void;
}

/**
 * The last step: who to call back, and where to send the request.
 *
 * Holds no state of its own. Every value and every error comes from the flow,
 * because the flow is what decides when a field counts as wrong — the errors
 * only appear once a submission has been attempted, and clearing them is its
 * business rather than this component's.
 */
function ContactForm({
  name,
  phone,
  comment,
  consent,
  nameError,
  phoneError,
  consentError,
  submitError,
  submitting,
  channels,
  onName,
  onPhone,
  onComment,
  onConsent,
  onSubmit,
}: ContactFormProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Имя" required error={nameError}>
          {(props) => (
            <TextInput
              {...props}
              value={name}
              autoComplete="given-name"
              placeholder="Как к вам обращаться"
              onChange={(event) => onName(event.target.value)}
            />
          )}
        </Field>
        <Field
          label="Телефон"
          required
          hint="Позвоним только чтобы подтвердить запись."
          error={phoneError}
        >
          {(props) => (
            <TextInput
              {...props}
              value={phone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
              onChange={(event) => onPhone(event.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label="Комментарий" hint="Например: сложная история окрашивания, событие через неделю.">
        {(props) => (
          <TextArea {...props} value={comment} onChange={(event) => onComment(event.target.value)} />
        )}
      </Field>

      <Checkbox checked={consent} onChange={onConsent} error={consentError}>
        Согласен(на) на обработку персональных данных для записи в салон.
      </Checkbox>

      {submitError && (
        <p role="alert" className="lk-type-small border border-lk-critical/40 bg-lk-critical/5 px-4 py-3 text-lk-critical">
          {submitError}
        </p>
      )}

      {channels.length ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row">
            {channels.map((channel, index) => (
              <Button
                key={channel}
                size="lg"
                variant={index === 0 ? 'primary' : 'secondary'}
                onClick={() => onSubmit(channel)}
                disabled={submitting !== null}
                className="sm:w-fit"
              >
                {submitting === channel ? 'Открываем…' : `Отправить в ${deliveryLabels[channel]}`}
              </Button>
            ))}
          </div>

          <p className="lk-type-meta text-lk-muted">
            Регистрация не нужна. Заявка откроется в выбранном мессенджере — останется
            нажать «Отправить». Администратор подтвердит время.
          </p>
        </>
      ) : (
        <p role="alert" className="lk-type-small border border-lk-line px-4 py-3 text-lk-muted">
          Онлайн-заявка временно недоступна — позвоните в салон, и мы запишем вас сами.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ steps */

function Step({
  index,
  title,
  summary,
  open,
  onOpen,
  children,
  disabled,
  optional,
  last,
}: {
  index: number;
  id: StepId;
  title: string;
  summary?: string;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  optional?: boolean;
  last?: boolean;
}) {
  return (
    <section className={cn('border-t border-lk-line py-6', last && 'border-b')}>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-4 text-left',
          disabled && 'cursor-not-allowed opacity-45',
        )}
      >
        <span
          className={cn(
            'lk-numeric flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[0.8125rem]',
            summary ? 'border-lk-ink bg-lk-ink text-lk-paper' : 'border-lk-line-strong text-lk-muted',
          )}
          aria-hidden="true"
        >
          {index}
        </span>
        <span className="min-w-0 flex-1">
          <span className="lk-type-subtitle block">
            {title}
            {optional && <span className="lk-type-meta ml-2 align-middle text-lk-muted">необязательно</span>}
          </span>
          {summary && !open && <span className="lk-type-small block text-lk-muted">{summary}</span>}
        </span>
        {!open && !disabled && (
          <span className="lk-type-meta shrink-0 text-lk-accent uppercase">
            {summary ? 'изменить' : 'выбрать'}
          </span>
        )}
      </button>

      {open && <div className="lk-animate-fade-up mt-6 pl-0 sm:pl-12">{children}</div>}
    </section>
  );
}

function SpecialistOption({
  active,
  title,
  subtitle,
  portraitSeed,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  portraitSeed?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-3 rounded-lk-xs border p-3 text-left transition-colors duration-200',
        active ? 'border-lk-ink bg-lk-paper-2' : 'border-lk-line-strong hover:border-lk-ink',
      )}
    >
      {portraitSeed ? (
        <Figure
          image={{ alt: title, seed: portraitSeed }}
          ratio="square"
          className="h-11 w-11 shrink-0 rounded-full"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-lk-line-strong text-lk-muted"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M3 17c1.5-3.2 4-4.8 7-4.8s5.5 1.6 7 4.8M10 9.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5z" strokeLinecap="round" />
          </svg>
        </span>
      )}
      <span className="min-w-0">
        <span className="lk-type-small block font-medium">{title}</span>
        <span className="lk-type-meta block truncate text-lk-muted">{subtitle}</span>
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- summary */

function BookingSummary({
  serviceTitle,
  priceLabel,
  durationLabel,
  specialistLabel,
  dateLabel,
  factors,
}: {
  serviceTitle?: string;
  priceLabel?: string;
  durationLabel?: string;
  specialistLabel?: string;
  dateLabel?: string;
  factors?: string[];
}) {
  return (
    <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
      <div className="border border-lk-line bg-lk-paper-2/50 p-6">
        <p className="lk-type-eyebrow mb-5 text-lk-muted">Ваша запись</p>

        <dl className="flex flex-col gap-4">
          <SummaryRow label="Услуга" value={serviceTitle} />
          <SummaryRow label="Мастер" value={specialistLabel} />
          <SummaryRow label="Когда" value={dateLabel} />
          <SummaryRow label="Длительность" value={durationLabel} />
          <SummaryRow label="Стоимость" value={priceLabel} emphasis />
        </dl>

        {factors?.length ? (
          <p className="lk-type-meta mt-5 border-t border-lk-line pt-4 text-lk-muted">
            Итоговая стоимость зависит от: {factors.join(', ').toLowerCase()}. Мастер назовёт
            точную сумму на консультации, до начала работы.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function SummaryRow({
  label,
  value,
  emphasis,
}: {
  label: string;
  value?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="lk-type-small shrink-0 text-lk-muted">{label}</dt>
      <dd
        className={cn(
          'lk-type-small text-right',
          emphasis && 'lk-numeric font-medium',
          !value && 'text-lk-line-strong',
        )}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

/* -------------------------------------------------------- service chooser */

function ServiceChooser({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const normalised = query.trim().toLowerCase();

  // Built and pruned in one pass rather than mapping every category and then
  // filtering the empty ones back out: this runs on every keystroke in the
  // search field, and most categories are empty for most queries.
  const groups = serviceCategories.flatMap((category) => {
    const items = services.filter(
      (service) =>
        service.categoryId === category.id &&
        (!normalised ||
          service.title.toLowerCase().includes(normalised) ||
          service.outcome.toLowerCase().includes(normalised)),
    );
    return items.length > 0 ? { category, items } : [];
  });

  return (
    <div className="flex flex-col gap-5">
      <label className="relative block">
        <span className="sr-only">Поиск услуги</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти услугу — например, блонд"
          className="w-full rounded-lk-xs border border-lk-line-strong bg-lk-paper px-3.5 py-3 text-[0.9375rem] placeholder:text-lk-muted/70 focus:border-lk-ink focus:outline-none"
        />
      </label>

      {groups.length === 0 ? (
        <p className="lk-type-small text-lk-muted">Ничего не нашлось. Попробуйте другое слово.</p>
      ) : (
        <div className="flex max-h-[26rem] flex-col gap-6 overflow-y-auto pr-1">
          {groups.map(({ category, items }) => (
            <div key={category.id}>
              <p className="lk-type-eyebrow mb-3 text-lk-muted">{category.title}</p>
              <div className="flex flex-col">
                {items.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => onSelect(service.id)}
                    aria-pressed={service.id === selectedId}
                    className={cn(
                      'flex items-baseline justify-between gap-4 border-b border-lk-line py-3 text-left transition-colors',
                      service.id === selectedId ? 'text-lk-ink' : 'text-lk-ink-2 hover:text-lk-ink',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="lk-type-body block">{service.title}</span>
                      <span className="lk-type-meta block text-lk-muted">{service.outcome}</span>
                    </span>
                    <span className="lk-numeric lk-type-small shrink-0 whitespace-nowrap text-lk-muted">
                      {formatPrice(service.price)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
