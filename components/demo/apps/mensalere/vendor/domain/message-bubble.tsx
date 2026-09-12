import { Check, CheckCheck } from 'lucide-react';
import type { Message } from '../services/types';
import { formatTime, formatDate } from '../lib/date';
import { cn } from '../lib/cn';

/** §46 — sent, received, timestamp, read and unread state. Nothing else. */
export function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <li className={cn('flex w-full', isOwn ? 'justify-end' : 'justify-start')}>
      <article
        className={cn(
          'flex max-w-[min(36rem,85%)] flex-col gap-1.5 rounded-[12px] px-4 py-3',
          isOwn ? 'bg-ms-primary-soft' : 'border-ms-border bg-ms-surface border',
        )}
      >
        <p className="sr-only">
          {isOwn ? 'You wrote' : `${message.authorName} wrote`} on {formatDate(message.sentAt)}
        </p>
        <p className="text-ms-body text-ms-text whitespace-pre-wrap">{message.body}</p>
        <p className="text-ms-caption text-ms-muted flex items-center gap-1.5 self-end">
          <time dateTime={message.sentAt}>{formatTime(message.sentAt)}</time>
          {isOwn &&
            (message.readAt ? (
              <>
                <CheckCheck aria-hidden className="text-ms-primary h-3.5 w-3.5" />
                <span className="sr-only">Read</span>
              </>
            ) : (
              <>
                <Check aria-hidden className="h-3.5 w-3.5" />
                <span className="sr-only">Sent, not yet read</span>
              </>
            ))}
        </p>
      </article>
    </li>
  );
}
