/**
 * Project validation limits.
 *
 * The product's `services/projects.ts` is 144 lines of directory creation,
 * `project.json` writing and workspace registry maintenance. The two vendored
 * modals need exactly one thing from it — the length the name field stops at —
 * so that is what this module is. Copying the rest would mean copying code
 * whose every call ends at a filesystem this demo does not have.
 */

/** Maximum length of a project name, as the product enforces it. */
export const PROJECT_NAME_MAX = 100;
