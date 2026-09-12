"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Button, type ButtonVariant } from "../actions/Button";
import { whatsappUrl } from "../content/site";

import { InquiryModal } from "./InquiryModal";

interface InquireButtonProps {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Class for the button itself. */
  className?: string;
  ariaLabel?: string;
}

/**
 * The site's inquiry call to action, wherever it appears.
 *
 * Clicking it no longer leaves for WhatsApp. It opens the inquiry dialog,
 * which asks what kind of production this is and composes the message; WhatsApp
 * is still the destination, and still the number configured in content/site.ts,
 * but the studio now receives a brief rather than an empty chat.
 *
 * Renders nothing at all while no WhatsApp number is configured. A dialog that
 * can only end in a dead link is worse than no button, and the contact page
 * keeps its own honest pending state either way.
 */
export function InquireButton({
  children,
  variant = "primary",
  className,
  ariaLabel,
}: InquireButtonProps) {
  const [open, setOpen] = useState(false);

  if (!whatsappUrl) return null;

  return (
    <>
      <Button
        variant={variant}
        className={className}
        onClick={() => setOpen(true)}
        ariaLabel={ariaLabel}
        ariaHasPopup="dialog"
      >
        {children}
      </Button>

      <InquiryModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
