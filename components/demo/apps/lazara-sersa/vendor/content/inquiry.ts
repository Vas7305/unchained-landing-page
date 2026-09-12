/* ===========================================================================
   INQUIRY MODEL
   The six inquiry categories, the fields each one asks for, and the copy that
   introduces them.

   One definition per category. The modal, the validation and the WhatsApp
   message builder all read from here, so a field is added, renamed or reworded
   in exactly one place and the six forms cannot drift apart.

   Nothing here is sent anywhere. The form composes a message that the visitor
   sends themselves, from their own WhatsApp account — there is no backend and
   no database behind this (see lib/inquiry-message.ts).
   =========================================================================== */

/**
 * The categories, as identifiers rather than as display strings. Labels change;
 * the thing a message template is keyed to must not (Brand Identity §36 —
 * copy is content, not structure).
 */
export type InquiryCategoryId =
  | "PRIVATE_APPOINTMENT"
  | "EDITORIAL"
  | "CAMPAIGN_BRAND"
  | "CELEBRITY_TALENT"
  | "EVENT"
  | "OTHER_INQUIRY";

/**
 * Every field name used across the six forms. A closed union rather than
 * `string`: the message builder reads these keys directly, so a typo in a form
 * configuration is a compile error instead of a silently missing line in a
 * WhatsApp message.
 *
 * Names are shared where the meaning is shared — `date`, `location` and
 * `details` mean the same thing in every category, which is what lets one
 * validated value object serve all six.
 */
export type InquiryFieldName =
  | "name"
  | "date"
  | "location"
  | "details"
  | "occasion"
  | "publication"
  | "role"
  | "brand"
  | "project"
  | "talent"
  | "agency"
  | "event"
  | "people"
  | "company"
  | "link";

/**
 * Kept deliberately small. These map to input types, not to widgets — the form
 * step decides how each one is drawn, so the content layer never knows about
 * the DOM.
 */
export type InquiryFieldType = "text" | "date" | "number" | "url" | "textarea";

export interface InquiryField {
  name: InquiryFieldName;
  /** Exact label shown above the control, and used in validation messages. */
  label: string;
  type: InquiryFieldType;
  required: boolean;
  /**
   * Suggested values, offered through a datalist. The control stays a free
   * text input on purpose: a role list is a prompt, never a closed set, and a
   * producer whose title is not on it must not be forced to pick "Other".
   */
  suggestions?: readonly string[];
  /** One short line under the label. Used sparingly. */
  hint?: string;
  placeholder?: string;
  autoComplete?: string;
}

/** A partially filled form. Every field is a string; empty means unanswered. */
export type InquiryValues = Partial<Record<InquiryFieldName, string>>;

export interface InquiryCategory {
  id: InquiryCategoryId;
  /** Title case here; the category list sets it in caps typographically. */
  label: string;
  /** One line under the heading of the form step. */
  intro: string;
  fields: readonly InquiryField[];
}

/* ---------------------------------------------------------------------------
   SHARED FIELDS
   The four questions almost every category asks. Written once so "Preferred
   Date" cannot end up as "Preferred date" in one form out of six.
   ------------------------------------------------------------------------ */

const fullName: InquiryField = {
  name: "name",
  label: "Full Name",
  type: "text",
  required: true,
  autoComplete: "name",
};

const preferredDate = (required = true): InquiryField => ({
  name: "date",
  label: "Preferred Date",
  type: "date",
  required,
});

const location = (required = true): InquiryField => ({
  name: "location",
  label: "Location",
  type: "text",
  required,
  hint: "City, or where the production is based.",
});

/** Suggestions only — see `InquiryField.suggestions`. */
const role = (
  label: string,
  suggestions: readonly string[],
  required = true,
): InquiryField => ({
  name: "role",
  label,
  type: "text",
  required,
  suggestions,
  hint: "Choose a suggestion or type your own.",
});

const link: InquiryField = {
  name: "link",
  label: "Website / Instagram",
  type: "url",
  required: false,
  placeholder: "instagram.com/handle",
};

const details = (label: string, required: boolean): InquiryField => ({
  name: "details",
  label,
  type: "textarea",
  required,
});

/* ---------------------------------------------------------------------------
   THE SIX CATEGORIES
   Order is the order they are presented in. Kept short on purpose: the form
   exists to let the studio understand and filter an inquiry, not to collect
   everything that could conceivably be asked.
   ------------------------------------------------------------------------ */

export const inquiryCategories: readonly InquiryCategory[] = [
  {
    id: "PRIVATE_APPOINTMENT",
    label: "Private Appointment",
    intro: "A personal appointment for you or a small private party.",
    fields: [
      fullName,
      preferredDate(),
      location(),
      {
        name: "occasion",
        label: "Type of Occasion",
        type: "text",
        required: true,
      },
      details("Additional Details", false),
    ],
  },
  {
    id: "EDITORIAL",
    label: "Editorial",
    intro: "Magazine, publication and editorial productions.",
    fields: [
      fullName,
      {
        name: "publication",
        label: "Publication / Project",
        type: "text",
        required: true,
      },
      role("Your Role", [
        "Editor",
        "Creative Director",
        "Photographer",
        "Stylist",
        "Producer",
      ]),
      preferredDate(),
      location(),
      details("Project Details", true),
      link,
    ],
  },
  {
    id: "CAMPAIGN_BRAND",
    label: "Campaign / Brand",
    intro: "Advertising, brand and commercial productions.",
    fields: [
      fullName,
      {
        name: "brand",
        label: "Brand / Company",
        type: "text",
        required: true,
        autoComplete: "organization",
      },
      role("Your Role", [
        "Brand Representative",
        "Marketing",
        "Creative Director",
        "Producer",
        "Agency",
      ]),
      {
        name: "project",
        label: "Campaign / Project",
        type: "text",
        required: true,
      },
      preferredDate(),
      location(),
      details("Project Details", true),
      link,
    ],
  },
  {
    id: "CELEBRITY_TALENT",
    label: "Celebrity / Talent",
    intro:
      "For an artist, performer or public figure — including inquiries made on their behalf.",
    fields: [
      fullName,
      {
        name: "talent",
        label: "Talent / Artist",
        type: "text",
        required: true,
      },
      role("Your Role", [
        "Manager",
        "Agent",
        "Publicist",
        "Producer",
        "Creative Director",
        "Stylist",
      ]),
      {
        name: "agency",
        label: "Agency / Management",
        type: "text",
        required: false,
        autoComplete: "organization",
      },
      preferredDate(),
      location(),
      details("Project Details", true),
      link,
    ],
  },
  {
    id: "EVENT",
    label: "Event",
    intro: "Weddings, ceremonies, presentations and private events.",
    fields: [
      fullName,
      {
        name: "event",
        label: "Event / Occasion",
        type: "text",
        required: true,
      },
      preferredDate(),
      location(),
      {
        name: "people",
        label: "Number of People",
        type: "number",
        required: true,
      },
      details("Additional Details", false),
    ],
  },
  {
    id: "OTHER_INQUIRY",
    label: "Other Inquiry",
    intro: "Anything that does not sit inside the categories above.",
    fields: [
      fullName,
      location(),
      details("Tell us about your inquiry", true),
      {
        name: "company",
        label: "Company / Organization",
        type: "text",
        required: false,
        autoComplete: "organization",
      },
      role("Your Role", [], false),
      preferredDate(false),
      link,
    ],
  },
];

/** Lookup by id. `undefined` for an id that is no longer configured. */
export function getInquiryCategory(
  id: InquiryCategoryId,
): InquiryCategory | undefined {
  return inquiryCategories.find((category) => category.id === id);
}

/* ---------------------------------------------------------------------------
   THE AUTOMATIC REPLY
   Not sent by this website — it is configured as the away/greeting message on
   the WhatsApp Business account that receives these inquiries. It lives here
   so the wording is version-controlled with the flow it answers.

   It is generic by design. It confirms nothing, quotes nothing, repeats
   nothing the visitor typed and names no category, because an assistant reads
   and filters the inquiry before anyone commits to anything. "Our team" is
   deliberate for the same reason — see README, "Inquiry flow".
   ------------------------------------------------------------------------ */
export const inquiryAutoResponse = `Hi, thank you for reaching out to Sersa Sarría.

We’ve received your inquiry and our team will review the details and get back to you shortly.

Thank you for your interest in working with Sersa. We look forward to connecting with you.`;
