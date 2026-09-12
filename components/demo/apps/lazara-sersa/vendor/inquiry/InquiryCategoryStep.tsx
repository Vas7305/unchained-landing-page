import {
  inquiryCategories,
  type InquiryCategoryId,
  type InquiryValues,
} from "../content/inquiry";

import styles from "./Inquiry.module.css";

interface InquiryCategoryStepProps {
  /** Owned by the dialog, which labels itself with the step's heading. */
  titleId: string;
  /** Everything typed so far, so a part-filled category can say so. */
  answers: Partial<Record<InquiryCategoryId, InquiryValues>>;
  onSelect: (id: InquiryCategoryId) => void;
}

/**
 * True once anything at all has been typed into a category's form.
 *
 * The `typeof` guard is doing real work: `InquiryValues` is a partial record,
 * so every value it holds is `string | undefined`.
 */
function hasAnswers(values: InquiryValues | undefined): boolean {
  if (!values) return false;
  return Object.values(values).some(
    (value) => typeof value === "string" && value.trim() !== "",
  );
}

/**
 * The first step: six routes in, set as a contents page.
 *
 * Numeral, rule, label — the same device the work index uses, at the same
 * restraint. Not a card grid, and no icons: the identity has no icon set
 * (Brand Identity §35) and six pictograms for six kinds of production would
 * be six invented symbols.
 *
 * A real list of real buttons, so the whole step is reachable and announced by
 * a screen reader as six options rather than as an undifferentiated block.
 */
export function InquiryCategoryStep({
  titleId,
  answers,
  onSelect,
}: InquiryCategoryStepProps) {
  return (
    <div className={styles.categoryStep}>
      <h2 id={titleId} className={styles.title}>
        Let’s Work Together
      </h2>
      <p className={styles.lede}>
        Select the type of inquiry that best describes your request.
      </p>

      <ul className={styles.list}>
        {inquiryCategories.map((category, index) => {
          const resumed = hasAnswers(answers[category.id]);

          return (
            <li key={category.id}>
              <button
                type="button"
                className={styles.option}
                onClick={() => onSelect(category.id)}
              >
                <span className={styles.optionIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className={styles.optionLabel}>{category.label}</span>
                {resumed ? (
                  <span className={styles.optionResumed}>In progress</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
