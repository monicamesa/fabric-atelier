import { entity, authenticated, uuid, text, email, date, set, one } from '@microsoft/rayfin-core';
import { Verdict } from './Verdict.js';

// A juror's view of the AI judge's verdict. Insert-only: changing your mind is a new review and the latest one per
// reviewer and verdict counts (like Vote). "Appeal" is only the UI word for a review that differs from the judge.
// Validity (active juror, an appeal needs a comment) and the effect on the case (R9) are computed, never stored.
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.reviewerUserId).and(claims.email.eq(item.reviewerEmail)),
})
export class VerdictReview {
  @uuid() id!: string;
  @uuid() verdict_id!: string;
  @one(() => Verdict) verdict?: Verdict;
  @set('correct', 'incorrect', 'ambiguous') humanVerdict!: 'correct' | 'incorrect' | 'ambiguous';
  @set({ optional: true }, 'judge_too_strict', 'judge_too_lenient', 'expected_answer_wrong', 'other') reason?: 'judge_too_strict' | 'judge_too_lenient' | 'expected_answer_wrong' | 'other';
  @text({ max: 1000, optional: true }) comment?: string;
  @text({ max: 255 }) reviewerUserId!: string;
  @email({ max: 254 }) reviewerEmail!: string;
  // "seed" marks example rows written by SQL for the demo; judge trust ignores them.
  @text({ max: 20, optional: true }) source?: string;
  @date() createdAt!: Date;
}
