import { extendTailwindMerge } from 'tailwind-merge';
import type { ClassValue } from 'clsx';
import clsx from 'clsx';

/**
 * tailwind-merge does not know about the custom type scale defined in
 * src/styles/index.css (§13), so conflicting sizes would otherwise both survive.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: ['caption', 'small', 'body', 'body-lg', 'h3', 'h2', 'h1', 'display'],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
