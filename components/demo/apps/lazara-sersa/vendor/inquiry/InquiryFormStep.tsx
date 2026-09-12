"use client";

import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../actions/Button";
import type {
  InquiryCategory,
  InquiryCategoryId,
  InquiryField,
  InquiryFieldName,
  InquiryValues,
} from "../content/inquiry";
import { site } from "../content/site";

import styles from "./Inquiry.module.css";

interface InquiryFormStepProps {
  category: InquiryCategory;
  titleId: string;
  values: InquiryValues;
  onChange: (id: InquiryCategoryId, values: InquiryValues) => void;
  onBack: () => void;
  /** WhatsApp has the message. The dialog closes and the flow resets. */
  onSubmitted: () => void;
}

type InquiryErrors = Partial<Record<InquiryFieldName, string>>;

/**
 * Client-side validation, over the same configuration the fields are drawn
 * from — so a field cannot be added to a category and left unvalidated.
 *
 * Deliberately thin. A required answer must not be blank and a headcount must
 * be a real number; nothing else is second-guessed, because a location, a
 * publication title or a role written in someone's own words has no shape this
 * form is entitled to reject.
 */
function validate(category: InquiryCategory, values: InquiryValues) {
  const errors: InquiryErrors = {};

  for (const field of category.fields) {
    const value = (values[field.name] ?? "").trim();

    if (field.required && value === "") {
      errors[field.name] = `${field.label} is required.`;
      continue;
    }

    if (field.type === "number" && value !== "") {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount < 1) {
        errors[field.name] = "Enter a number of one or more.";
      }
    }
  }

  return errors;
}

/**
 * The second step: the questions this category actually needs, and the button
 * that hands the finished message to WhatsApp.
 *
 * One component for all six forms, driven by the category's field list
 * (content/inquiry.ts). Six near-identical form components would have meant
 * six places to fix a label, a validation rule or a focus behaviour.
 */
export function InquiryFormStep({
  category,
  titleId,
  values,
  onChange,
  onBack,
  onSubmitted,
}: InquiryFormStepProps) {
  const baseId = useId();
  const [errors, setErrors] = useState<InquiryErrors>({});
  /** Announced politely — a visible message per field is no use unheard. */
  const [summary, setSummary] = useState("");
  /**
   * Set only when WhatsApp could not be opened for the visitor. `url` is the
   * link to offer them by hand, and is null in the one case where there was no
   * link to open to begin with.
   */
  const [fallback, setFallback] = useState<{ url: string | null } | null>(null);

  const fieldId = (name: InquiryFieldName) => `${baseId}-${name}`;

  const handleChange = (name: InquiryFieldName, value: string) => {
    onChange(category.id, { ...values, [name]: value });

    // Correcting a field clears its message straight away rather than making
    // the visitor submit again to find out whether it worked.
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFallback(null);

    const nextErrors = validate(category, values);
    setErrors(nextErrors);

    const invalid = category.fields.filter((field) => nextErrors[field.name]);
    if (invalid.length > 0) {
      setSummary(
        invalid.length === 1
          ? "1 field needs your attention."
          : `${invalid.length} fields need your attention.`,
      );

      const first = invalid[0];
      if (first) document.getElementById(fieldId(first.name))?.focus();
      return;
    }

    setSummary("");

    /* ── DEMO ADAPTATION ───────────────────────────────────────────────
       The product composes the brief and hands it to WhatsApp with
       `window.open`. That is the one outbound call in this entire vendored
       tree, and a portfolio demo must not make it: it would open a real chat
       to a real studio on behalf of a visitor who was only looking.

       Everything above this point is the product's own code and still runs —
       the same required fields, the same validation, the same focus handling,
       the same composed message. Only the delivery is replaced, by the
       completion callback the component already had.

       `buildInquiryWhatsAppUrl` is consequently unimported here; the module is
       kept in `lib/` so the diff against the product stays small and a future
       re-copy is a straight overwrite. */
    onSubmitted();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <button
        type="button"
        className={styles.back}
        onClick={onBack}
        aria-label="Back to inquiry categories"
      >
        ← Back
      </button>

      <h2 id={titleId} className={styles.title}>
        {category.label}
      </h2>
      <p className={styles.lede}>{category.intro}</p>

      <p className="visually-hidden" role="status">
        {summary}
      </p>

      <div className={styles.fields}>
        {category.fields.map((field) => (
          <InquiryFieldControl
            key={field.name}
            field={field}
            id={fieldId(field.name)}
            value={values[field.name] ?? ""}
            error={errors[field.name]}
            onChange={handleChange}
          />
        ))}
      </div>

      <div className={styles.actions}>
        {fallback ? (
          <div className={styles.fallback} role="alert">
            <p className={styles.fallbackText}>
              We couldn’t open WhatsApp. Please try again or contact Sersa
              directly.
            </p>
            {fallback.url ? (
              <a
                href={fallback.url}
                className={styles.fallbackLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open WhatsApp
              </a>
            ) : null}
            {site.contact.whatsapp ? (
              <p className={styles.fallbackText}>
                {`Direct: ${site.contact.whatsapp}`}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" variant="primary" className={styles.submit}>
          Send Inquiry
        </Button>

        <p className={styles.note}>
          This opens WhatsApp with your message ready to send. It is an inquiry
          — nothing is booked or confirmed until the studio replies.
        </p>
      </div>
    </form>
  );
}

interface InquiryFieldControlProps {
  field: InquiryField;
  id: string;
  value: string;
  error?: string;
  onChange: (name: InquiryFieldName, value: string) => void;
}

/**
 * One labelled control. A real `<label for>`, a hint and an error message tied
 * to the field through `aria-describedby`, and `aria-invalid` while it is
 * wrong — the message is next to the field for anyone who can see it and
 * attached to the field for anyone who cannot.
 */
function InquiryFieldControl({
  field,
  id,
  value,
  error,
  onChange,
}: InquiryFieldControlProps) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const listId = `${id}-options`;

  const describedBy =
    [field.hint ? hintId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  /* A URL field stays `text`: `type="url"` asks for a scheme, and
     "instagram.com/handle" is what people actually paste. The keyboard hint is
     kept below without the constraint. */
  const inputType =
    field.type === "number" ? "number" : field.type === "date" ? "date" : "text";

  const shared = {
    id,
    name: field.name,
    value,
    required: field.required,
    placeholder: field.placeholder,
    autoComplete: field.autoComplete,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
  };

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {field.label}
        {/* The space is not decorative: the gap between these two is a flex
            gap, which does not exist for a screen reader reading the label
            out — without it the field is announced as "Full NameOptional". */}
        {field.required ? null : (
          <>
            {" "}
            <span className={styles.optional}>Optional</span>
          </>
        )}
      </label>

      {field.hint ? (
        <p className={styles.hint} id={hintId}>
          {field.hint}
        </p>
      ) : null}

      {field.type === "textarea" ? (
        <textarea
          {...shared}
          className={`${styles.control} ${styles.textarea}`}
          rows={4}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      ) : (
        <input
          {...shared}
          className={styles.control}
          type={inputType}
          inputMode={
            field.type === "number"
              ? "numeric"
              : field.type === "url"
                ? "url"
                : undefined
          }
          min={field.type === "number" ? 1 : undefined}
          list={
            field.suggestions && field.suggestions.length > 0
              ? listId
              : undefined
          }
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      )}

      {/* Suggestions, never a closed set — the control above stays free text
          so a title that is not on the list can simply be typed. */}
      {field.suggestions && field.suggestions.length > 0 ? (
        <datalist id={listId}>
          {field.suggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      ) : null}

      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
