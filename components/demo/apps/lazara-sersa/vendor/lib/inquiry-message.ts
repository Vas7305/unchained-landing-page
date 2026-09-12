/* ===========================================================================
   INQUIRY → WHATSAPP MESSAGE
   The single place a WhatsApp message is composed. Six templates, one layer:
   the forms collect values and this file turns them into the text and the
   deep link, so no component anywhere concatenates a wa.me URL of its own.

   The destination is never written here either — it comes from
   `whatsappUrl` in content/site.ts, which is the one place the number lives.
   =========================================================================== */

import type { InquiryCategoryId, InquiryValues } from "../content/inquiry";
import { whatsappUrl } from "../content/site";

/* ---------------------------------------------------------------------------
   PARTS
   A message is a list of blocks joined by blank lines. Any part that resolves
   to `null` — an optional field left empty — drops out before the join, which
   is what keeps an unanswered question from appearing as a dangling label.
   ------------------------------------------------------------------------ */

/** `Label: value`, or nothing at all when there is no value. */
function line(label: string, value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}: ${trimmed}` : null;
}

/** A labelled paragraph — the free-text answers sit on their own line. */
function paragraph(label: string, value?: string): string | null {
  const trimmed = value?.trim();
  return trimmed ? `${label}:\n${trimmed}` : null;
}

/** Consecutive `Label: value` lines, as one block. Empty block → nothing. */
function group(...items: (string | null)[]): string | null {
  const kept = items.filter((item): item is string => item !== null);
  return kept.length > 0 ? kept.join("\n") : null;
}

function compose(...blocks: (string | null)[]): string {
  return blocks
    .filter((block): block is string => block !== null)
    .join("\n\n");
}

/**
 * `2026-08-15` → `15 August 2026`.
 *
 * The value comes from a date input, which is always ISO regardless of how the
 * control is drawn locally — reading it out raw would send the studio a machine
 * string. Parsed field by field rather than through `new Date(value)`, which
 * reads a bare ISO date as UTC and lands on the previous day for anyone west
 * of Greenwich. Anything that is not an ISO date is passed through untouched,
 * so a browser with no date input support still sends what was typed.
 */
function formatDate(value?: string): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const [year, month, day] = raw.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return raw;

  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return raw;

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/* ---------------------------------------------------------------------------
   THE TEMPLATES
   One per category. Each opens the same way and closes with the sentence that
   suits what is being asked — an appointment inquiry ends differently from a
   campaign brief, and that difference is the point of asking the category
   first. None of them confirm anything: this is an inquiry, and the studio
   replies (Brand Identity §36 — no booking language).
   ------------------------------------------------------------------------ */
export function buildInquiryMessage(
  category: InquiryCategoryId,
  values: InquiryValues,
): string {
  const date = formatDate(values.date);

  switch (category) {
    case "PRIVATE_APPOINTMENT":
      return compose(
        "Hi Sersa,",
        "I’d like to inquire about a private makeup appointment.",
        group(
          line("Name", values.name),
          line("Preferred date", date),
          line("Location", values.location),
          line("Occasion", values.occasion),
        ),
        paragraph("Additional details", values.details),
        "Thank you. I look forward to hearing from you.",
      );

    case "EDITORIAL":
      return compose(
        "Hi Sersa,",
        "I’m reaching out regarding an editorial project.",
        group(
          line("Name", values.name),
          line("Publication / Project", values.publication),
          line("Role", values.role),
          line("Preferred date", date),
          line("Location", values.location),
        ),
        paragraph("Project details", values.details),
        line("Website / Instagram", values.link),
        "I’d love to discuss the project and your availability.",
      );

    case "CAMPAIGN_BRAND":
      return compose(
        "Hi Sersa,",
        "I’m reaching out regarding a campaign / brand project.",
        group(
          line("Name", values.name),
          line("Brand / Company", values.brand),
          line("Role", values.role),
          line("Campaign / Project", values.project),
          line("Preferred date", date),
          line("Location", values.location),
        ),
        paragraph("Project details", values.details),
        line("Website / Instagram", values.link),
        "I’d love to discuss the project and your availability.",
      );

    case "CELEBRITY_TALENT":
      return compose(
        "Hi Sersa,",
        "I’m reaching out regarding makeup services for a talent / artist.",
        group(
          line("Name", values.name),
          line("Talent / Artist", values.talent),
          line("My role", values.role),
          line("Agency / Management", values.agency),
          line("Preferred date", date),
          line("Location", values.location),
        ),
        paragraph("Project details", values.details),
        line("Website / Instagram", values.link),
        "I’d love to discuss availability and next steps.",
      );

    case "EVENT":
      return compose(
        "Hi Sersa,",
        "I’d like to inquire about makeup services for an event.",
        group(
          line("Name", values.name),
          line("Event / Occasion", values.event),
          line("Preferred date", date),
          line("Location", values.location),
          line("Number of people", values.people),
        ),
        paragraph("Additional details", values.details),
        "Please let me know about your availability.",
      );

    case "OTHER_INQUIRY":
      return compose(
        "Hi Sersa,",
        "I’d like to inquire about working together.",
        group(
          line("Name", values.name),
          line("Company / Organization", values.company),
          line("Role", values.role),
          line("Preferred date", date),
          line("Location", values.location),
        ),
        paragraph("Inquiry", values.details),
        line("Website / Instagram", values.link),
        "I’d be happy to provide any additional information you may need.",
      );
  }
}

/**
 * The finished deep link, or `null` while no WhatsApp number is configured.
 *
 * `encodeURIComponent`, not `URLSearchParams`: the latter serialises a space as
 * `+`, which is correct for a form body and wrong here — WhatsApp shows the
 * message verbatim, and every space in a six-line inquiry would arrive as a
 * plus sign. `encodeURIComponent` percent-encodes the whole set this message
 * can contain — line breaks, apostrophes, accents, ampersands, slashes and any
 * URL the visitor pasted in — so nothing has to be escaped by hand.
 */
export function buildInquiryWhatsAppUrl(
  category: InquiryCategoryId,
  values: InquiryValues,
): string | null {
  if (!whatsappUrl) return null;

  const message = buildInquiryMessage(category, values);
  return `${whatsappUrl}?text=${encodeURIComponent(message)}`;
}
