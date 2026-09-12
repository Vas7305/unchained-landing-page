"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { MouseEvent } from "react";

import {
  getInquiryCategory,
  type InquiryCategoryId,
  type InquiryValues,
} from "../content/inquiry";

import { InquiryCategoryStep } from "./InquiryCategoryStep";
import { InquiryFormStep } from "./InquiryFormStep";
import styles from "./Inquiry.module.css";

interface InquiryModalProps {
  open: boolean;
  /** Called for every route out of the dialog: the close button, the backdrop,
   *  Escape, and a completed submission. */
  onClose: () => void;
}

/**
 * The inquiry dialog — category selection, then the form for the category that
 * was chosen, both inside the same panel.
 *
 * Built on the native `<dialog>` element opened with `showModal()`. That single
 * call is what makes the rest of the page inert, holds focus inside the panel,
 * closes on Escape and puts the panel in the top layer above the fixed header.
 * Every one of those is a thing a hand-rolled overlay has to re-implement,
 * usually incompletely, and none of them cost a dependency here.
 *
 * State is owned at this level rather than by the steps, so stepping back to
 * the categories cannot lose what was typed: the form step is unmounted, the
 * answers are not.
 */
export function InquiryModal({ open, onClose }: InquiryModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const [selected, setSelected] = useState<InquiryCategoryId | null>(null);
  /**
   * Answers per category, not one flat object. Someone who fills in half an
   * editorial inquiry, changes their mind and opens Campaign / Brand should
   * not find the editorial answers waiting in it — and should still find them
   * intact if they step back (§27).
   */
  const [answers, setAnswers] = useState<
    Partial<Record<InquiryCategoryId, InquiryValues>>
  >({});

  const category = selected ? getInquiryCategory(selected) : undefined;

  /* Open and close the real dialog in step with the prop. Guarded both ways:
     showModal() on an already-open dialog throws, and close() on a closed one
     would fire a second `close` event. */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  /**
   * Every way out of the dialog ends at the element's own `close` event —
   * Escape and the backdrop reach it directly, and the close button and a
   * completed submission reach it through the effect above. So this is the one
   * place that has to know the flow has ended, and the only place the step is
   * reset.
   *
   * Closing returns the flow to its entry point, but not to a blank sheet.
   * Reopening on the form of a category chosen minutes ago is not what asking
   * for the inquiry form a second time means — the visitor is starting again.
   * The answers stay in `answers` though, so choosing that category again
   * resumes where they left off, which the category list says out loud rather
   * than leaving them to discover.
   *
   * A native listener rather than React's `onClose`, so this cannot depend on
   * synthetic-event coverage for `close`.
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setSelected(null);
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  /**
   * Hold the page still underneath the dialog.
   *
   * On the root element, not on `body`: base.css explains that making `body` a
   * scroll container breaks the sticky header, and `scrollbar-gutter: stable`
   * is already declared on `html`, so the gutter stays reserved and the layout
   * does not jump sideways as the lock goes on and off.
   */
  useEffect(() => {
    if (!open) return;

    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";

    return () => {
      root.style.overflow = previous;
    };
  }, [open]);

  /* Focus lands at the top of the panel on open and again on every step
     change, so a screen reader reads the new step's heading instead of staying
     on a control that has just been unmounted. The scroll position is reset
     with it — arriving at a form already scrolled halfway down is disorienting
     for everyone. */
  useEffect(() => {
    if (!open) return;

    const body = bodyRef.current;
    if (!body) return;

    body.scrollTop = 0;
    body.focus();
  }, [open, selected]);

  const handleSelect = useCallback((id: InquiryCategoryId) => {
    setSelected(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelected(null);
  }, []);

  const handleChange = useCallback(
    (id: InquiryCategoryId, values: InquiryValues) => {
      setAnswers((current) => ({ ...current, [id]: values }));
    },
    [],
  );

  /* WhatsApp has been handed the message. The flow is finished, so it starts
     clean next time rather than reopening on a form that has already been
     sent. */
  const handleSubmitted = useCallback(() => {
    onClose();
    setSelected(null);
    setAnswers({});
  }, [onClose]);

  /**
   * A click on the backdrop is dispatched to the dialog element itself, so a
   * target that is the dialog and not something inside it means the visitor
   * clicked outside the panel. Anything within the panel — including a
   * keyboard-activated control, whose click targets that control — is left
   * alone, so this cannot swallow a submission.
   */
  const handleDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClick={handleDialogClick}
    >
      {/* Rendered only while open: seven text fields and a datalist do not need
          to sit in the document of every page waiting to be asked for. State
          lives above this line, so nothing is lost when it goes. */}
      {open ? (
        <div className={styles.panel}>
          <div className={styles.header}>
            <p className={styles.eyebrow}>Inquiry</p>
            <button type="button" className={styles.close} onClick={onClose}>
              Close
            </button>
          </div>

          <div className={styles.body} ref={bodyRef} tabIndex={-1}>
            {category ? (
              <InquiryFormStep
                category={category}
                titleId={titleId}
                values={answers[category.id] ?? {}}
                onChange={handleChange}
                onBack={handleBack}
                onSubmitted={handleSubmitted}
              />
            ) : (
              <InquiryCategoryStep
                titleId={titleId}
                answers={answers}
                onSelect={handleSelect}
              />
            )}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
