import { entity, authenticated, uuid, email, text, date } from '@microsoft/rayfin-core';

// Admin audit trail. Insert-only; each user can create and read only their own requests.
@entity()
@authenticated('read', {
  policy: (claims, item) => claims.email.eq(item.requesterEmail),
})
@authenticated('create', {
  policy: (claims, item) => claims.email.eq(item.requesterEmail),
})
export class AdminRequest {
  @uuid() id!: string;
  @email({ max: 254 }) requesterEmail!: string;
  @text({ max: 50 }) action!: string;
  @text({ max: 4000 }) payload!: string;
  @date() createdAt!: Date;
}
