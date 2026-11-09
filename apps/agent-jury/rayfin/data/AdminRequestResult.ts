import { entity, authenticated, uuid, email, text, set, date } from '@microsoft/rayfin-core';

// Admin audit trail: the outcome of each AdminRequest. Written only by the admin Function with T-SQL;
// the client can read only the results of its own requests. requestId is unique, so a request runs once.
@entity()
@authenticated('read', {
  policy: (claims, item) => claims.email.eq(item.requesterEmail),
})
export class AdminRequestResult {
  @uuid() id!: string;
  @uuid({ unique: true }) requestId!: string;
  @email({ max: 254 }) requesterEmail!: string;
  @set('done', 'rejected') outcome!: 'done' | 'rejected';
  // Machine-readable cause (see ClerkReason in functions/src/clerk-actions.ts); the UI translates it.
  @text({ max: 40, optional: true }) reason?: string;
  @text({ max: 500 }) detail!: string;
  @date() processedAt!: Date;
}
