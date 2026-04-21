/**
 * Type declarations for scripts/doctor.mjs — Slice 30 (DOG+2)
 * `slice:doctor` cold-operator briefing script. See
 * `specs/plans/phase-1-close-revised.md` §Slice DOG+2 and
 * `tests/contracts/slice-30-doctor.test.ts`.
 */

export function main(): void;

/**
 * Given a current `current_slice` marker (e.g. "29" or "27a"), return a
 * human-readable hint string suggesting the next candidate id. Returns
 * null when the input is not a well-formed slice id per SLICE_ID_PATTERN.
 */
export function suggestNextSliceId(current: string | null | undefined): string | null;
