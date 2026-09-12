import { useEffect, useMemo, useRef } from 'react';
import type { DayAvailability, IsoDate, TimeSlot } from '../../types';
import { cn } from '../../lib/utils';
import { dayNumber, formatDateLabel, isWeekend, weekdayShort } from '../../lib/format';

/**
 * Date and time picker.
 *
 * Availability is shown, not requested. Days with nothing free are visibly
 * disabled instead of silently absent, because "четверг занят" is useful
 * information — an empty list that quietly skips days is not.
 */

export function AvailabilityPicker({
  days,
  loading,
  error,
  date,
  time,
  onSelectDate,
  onSelectTime,
}: {
  days: DayAvailability[];
  loading: boolean;
  error: string | null;
  date: IsoDate | null;
  time: TimeSlot | null;
  onSelectDate: (date: IsoDate) => void;
  onSelectTime: (time: TimeSlot) => void;
}) {
  const selected = useMemo(() => days.find((day) => day.date === date), [days, date]);
  const firstOpen = useMemo(() => days.find((day) => !day.closed && day.slots.length > 0), [days]);
  const railRef = useRef<HTMLDivElement>(null);

  // Land on the first day that actually has time rather than on an empty today.
  useEffect(() => {
    if (!date && firstOpen) onSelectDate(firstOpen.date);
  }, [date, firstOpen, onSelectDate]);

  if (error) {
    return (
      <p role="alert" className="lk-type-small border border-lk-critical/40 bg-lk-critical/5 px-4 py-3 text-lk-critical">
        {error}
      </p>
    );
  }

  if (loading && days.length === 0) {
    return <AvailabilitySkeleton />;
  }

  const noneAtAll = days.every((day) => day.closed || day.slots.length === 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div
          ref={railRef}
          role="radiogroup"
          aria-label="Дата визита"
          className="lk-rail -mx-1 gap-2 px-1 pb-1"
        >
          {days.map((day) => {
            const disabled = day.closed || day.slots.length === 0;
            const active = day.date === date;
            return (
              <button
                key={day.date}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onSelectDate(day.date)}
                className={cn(
                  'flex h-[4.5rem] w-[3.75rem] flex-col items-center justify-center gap-1 rounded-lk-xs border transition-colors duration-200',
                  active && 'border-lk-ink bg-lk-ink text-lk-paper',
                  !active && !disabled && 'border-lk-line-strong hover:border-lk-ink',
                  // A day can empty out while it is the selected one; it stays
                  // marked as chosen so the picker does not appear to jump.
                  disabled && !active && 'cursor-not-allowed border-lk-line text-lk-line-strong',
                  disabled && active && 'cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'lk-type-meta uppercase',
                    active ? 'text-lk-paper/65' : isWeekend(day.date) ? 'text-lk-accent' : 'text-lk-muted',
                    disabled && 'text-lk-line-strong',
                  )}
                >
                  {weekdayShort(day.date)}
                </span>
                <span className="lk-numeric text-[1.0625rem]">{dayNumber(day.date)}</span>
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    disabled ? 'bg-transparent' : active ? 'bg-lk-paper/60' : 'bg-lk-accent/60',
                  )}
                  aria-hidden="true"
                />
                <span className="sr-only">
                  {formatDateLabel(day.date)}
                  {disabled ? ', нет свободного времени' : `, свободно ${day.slots.length}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {noneAtAll ? (
        <p className="lk-type-small border border-lk-line bg-lk-paper-2/60 px-4 py-3 text-lk-ink-2">
          На ближайшие две недели свободного времени нет. Выберите другого мастера или свяжитесь
          с салоном — иногда появляются переносы.
        </p>
      ) : selected && selected.slots.length > 0 ? (
        <div>
          <p className="lk-type-meta mb-3 text-lk-muted uppercase">
            Свободное время · {formatDateLabel(selected.date)}
          </p>
          <div
            role="radiogroup"
            aria-label={`Время на ${formatDateLabel(selected.date)}`}
            className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2"
          >
            {selected.slots.map((slot) => {
              const active = slot === time;
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelectTime(slot)}
                  className={cn(
                    'lk-numeric h-11 rounded-lk-xs border text-[0.875rem] transition-colors duration-200',
                    active
                      ? 'border-lk-ink bg-lk-ink text-lk-paper'
                      : 'border-lk-line-strong hover:border-lk-ink hover:bg-lk-paper-2',
                  )}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ) : selected ? (
        <p className="lk-type-small border border-lk-line bg-lk-paper-2/60 px-4 py-3 text-lk-ink-2">
          На {formatDateLabel(selected.date)} свободного времени не осталось. Выберите другой день
          — или другого мастера, у него может быть окно.
        </p>
      ) : (
        <p className="lk-type-small text-lk-muted">Выберите день, чтобы увидеть свободное время.</p>
      )}

      {loading && days.length > 0 && (
        <p className="lk-type-meta text-lk-muted" role="status">
          Обновляем расписание…
        </p>
      )}
    </div>
  );
}

function AvailabilitySkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Загружаем свободное время">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-[4.5rem] w-[3.75rem] shrink-0 animate-pulse rounded-lk-xs bg-lk-paper-2" />
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="h-11 animate-pulse rounded-lk-xs bg-lk-paper-2" />
        ))}
      </div>
    </div>
  );
}
