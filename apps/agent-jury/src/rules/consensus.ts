/** R3: valid votes in favour needed to rule a case. Used by the rules and by the UI copy. */
export const CONSENSUS_MIN_VOTES = 2;

/** D13: records dated further than this into the future are ignored (createdAt is set by the client). */
export const FUTURE_TOLERANCE_MS = 5 * 60_000;
