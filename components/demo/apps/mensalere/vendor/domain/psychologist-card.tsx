import { Link } from '../router';
import { ArrowRight } from 'lucide-react';
import { Card, CardBody } from '../ui/card';
import { Portrait } from '../ui/portrait';
import { VerifiedMark } from './verified-mark';
import { CATEGORY_LABELS } from '../services/mock/catalog';
import type { Psychologist } from '../services/types';
import { formatPrice, pluralize } from '../lib/format';
import { cn } from '../lib/cn';

/**
 * §26 — hierarchy is fixed: photo, name, title, specialties, experience, next
 * availability, price, then the profile link. No ratings, reviews, patient
 * counts or outcomes appear, because none exist.
 *
 * The photograph leads the card and carries the visual weight; everything below
 * it is typography. Specialties are read as a line of text rather than a row of
 * badges, so a card can be scanned in one pass instead of decoded.
 *
 * The card carries exactly one link, stretched across the whole surface: the
 * card is clickable without duplicating the destination for keyboard users.
 */
export function PsychologistCard({
  psychologist,
  nextAvailable,
  reasons,
  className,
}: {
  psychologist: Psychologist;
  /** Rendered when the caller already knows the next free slot. */
  nextAvailable?: string;
  /** Preference-based reasons from the questionnaire (§36). */
  reasons?: string[];
  className?: string;
}) {
  const specialties = psychologist.specialties.map((id) => CATEGORY_LABELS[id]);

  return (
    <Card
      interactive
      className={cn(
        'group relative flex h-full flex-col overflow-hidden',
        'focus-within:outline-ms-primary focus-within:outline-2 focus-within:outline-offset-2',
        className,
      )}
    >
      <Portrait
        name={psychologist.name}
        src={psychologist.photoUrl}
        ratio="card"
        radius="top"
        className="border-ms-border border-b"
      />

      <CardBody className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-h3 text-ms-text leading-tight">
            <Link
              to={`/psychologists/${psychologist.id}`}
              className="rounded-ms-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {psychologist.name}
            </Link>
          </h3>
          <p className="text-ms-small text-ms-muted">{psychologist.title}</p>
          {psychologist.verified && <VerifiedMark className="mt-1" />}
        </div>

        <p className="text-ms-body text-ms-muted">{psychologist.headline}</p>

        <p className="text-ms-small text-ms-text">{specialties.join(' · ')}</p>

        {reasons && reasons.length > 0 && (
          <ul className="text-ms-small text-ms-muted flex flex-col gap-1.5">
            {reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span aria-hidden className="text-ms-primary">
                  &middot;
                </span>
                {reason}
              </li>
            ))}
          </ul>
        )}

        <dl className="border-ms-border text-ms-small mt-auto grid grid-cols-2 gap-x-4 gap-y-4 border-t pt-5">
          <div className="flex flex-col gap-0.5">
            <dt className="text-ms-caption text-ms-muted">Experience</dt>
            <dd className="text-ms-text">
              {psychologist.yearsOfExperience} {pluralize(psychologist.yearsOfExperience, 'year')}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-ms-caption text-ms-muted">Consultations from</dt>
            <dd className="text-ms-text font-medium">{formatPrice(psychologist.fromPriceCents)}</dd>
          </div>
          <div className="col-span-2 flex flex-col gap-0.5">
            <dt className="text-ms-caption text-ms-muted">Next available</dt>
            <dd className="text-ms-text">
              {nextAvailable ??
                (psychologist.acceptingNewPatients ? 'See the profile' : 'Not taking new patients')}
            </dd>
          </div>
        </dl>

        <p className="text-ms-small text-ms-primary-strong flex items-center gap-1.5 font-medium">
          View profile
          <ArrowRight
            aria-hidden
            className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5"
          />
        </p>
      </CardBody>
    </Card>
  );
}
