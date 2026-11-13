import { entity, authenticated, uuid, text, set, boolean, date } from '@microsoft/rayfin-core';

// Feedback from jurors. Insert-only: the client can create a row only as itself and read back only its own rows
// (so the insert can return). Admins read all of it through the clerkExecute action readFeedback, never directly.
// No email or name is stored: userId is the subject claim, and the page is a screen name, never a case id.
@entity()
@authenticated('read', {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
export class Feedback {
  @uuid() id!: string;
  @text({ max: 255 }) userId!: string;
  @set('idea', 'confusing', 'bug', 'other') type!: 'idea' | 'confusing' | 'bug' | 'other';
  @text({ max: 2000 }) message!: string;
  @text({ max: 50, optional: true }) page?: string;
  @boolean({ default: false }) canContact!: boolean;
  @date() createdAt!: Date;
}
