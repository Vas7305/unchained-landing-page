import { ServiceError } from '../services/types';

/**
 * §52 — turns any thrown value into something a person can read. Technical
 * detail belongs in logs, never on screen.
 */
export function userFacingMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.message;
  return 'Something went wrong on our side. Please try again.';
}
