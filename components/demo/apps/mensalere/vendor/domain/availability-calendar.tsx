import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import type { DayAvailability } from '../services/availabilityService';
import { calendarGrid, dateKey, formatDateLong, formatMonthYear, startOfDay } from '../lib/date';
import { cn } from '../lib/cn';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * §39 — the calendar distinguishes available, selected, unavailable and past.
 * Every state is carried by text (the accessible name and the legend) as well
 * as by colour, and disabled days are not focus traps because they are real
 * disabled buttons.
 */
export function AvailabilityCalendar({
  days,
  isLoading,
  selected,
  onSelect,
  month,
  onMonthChange,
  className,
}: {
  days: DayAvailability[];
  isLoading: boolean;
  selected: string | null;
  onSelect: (date: string) => void;
  month: Date;
  onMonthChange: (month: Date) => void;
  className?: string;
}) {
  const byDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const cells = useMemo(() => calendarGrid(month), [month]);
  const today = startOfDay(new Date());
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const canGoBack = monthStart > today;

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-ms-body-lg text-ms-text font-medium" aria-live="polite">
          {formatMonthYear(month)}
        </h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            disabled={!canGoBack}
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft aria-hidden className="h-4 w-4" />
            <span className="sr-only">Previous month</span>
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
            <span className="sr-only">Next month</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5" role="presentation">
        {WEEKDAYS.map((weekday) => (
          <div key={weekday} className="text-ms-caption text-ms-muted pb-1 text-center" aria-hidden>
            {weekday}
          </div>
        ))}

        {cells.map((cell) => {
          const key = dateKey(cell);
          const outsideMonth = cell.getMonth() !== month.getMonth();
          const info = byDate.get(key);
          const past = cell < today;
          const available = !past && (info?.availableCount ?? 0) > 0;
          const isSelected = selected === key;

          if (isLoading && !outsideMonth) {
            return <Skeleton key={key} className="aspect-square w-full rounded-[8px]" />;
          }

          const stateWord = past
            ? 'past'
            : available
              ? `${info?.availableCount} times available`
              : 'no availability';

          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              aria-pressed={isSelected}
              aria-label={`${formatDateLong(cell)}, ${stateWord}`}
              onClick={() => onSelect(key)}
              className={cn(
                // Square cells keep a comfortable target at 320px, where a
                // seven-column grid is otherwise only ~36px wide (§53, §55).
                'text-ms-small relative flex aspect-square min-h-11 flex-col items-center justify-center',
                'rounded-[8px] transition-colors duration-150',
                'focus-visible:outline-ms-primary focus-visible:outline-2 focus-visible:outline-offset-2',
                outsideMonth && 'opacity-35',
                available && !isSelected && 'bg-ms-primary-soft/60 text-ms-text hover:bg-ms-primary-soft',
                // The selected day is unmistakable: filled, ringed and bold —
                // three signals, not colour alone (§39).
                isSelected &&
                  'bg-ms-primary-strong ring-ms-primary-strong font-semibold text-white ring-2 ring-offset-2',
                !available && 'text-ms-muted/70 decoration-ms-border line-through',
              )}
            >
              <span aria-hidden>{cell.getDate()}</span>
              {available && !isSelected && (
                <span aria-hidden className="bg-ms-primary absolute bottom-1 h-1 w-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      <ul className="text-ms-caption text-ms-muted flex flex-wrap gap-x-5 gap-y-2">
        <li className="flex items-center gap-2">
          <span aria-hidden className="bg-ms-primary-soft h-3 w-3 rounded-[4px]" />
          Available
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="bg-ms-primary-strong h-3 w-3 rounded-[4px]" />
          Selected
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="border-ms-border h-3 w-3 rounded-[4px] border" />
          Unavailable or past
        </li>
      </ul>
    </div>
  );
}
