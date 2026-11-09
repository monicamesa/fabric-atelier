import { entity, authenticated, uuid, text, email, date, set, one } from '@microsoft/rayfin-core';
import { Testimony } from './Testimony.js';

// Insert-only (R1): changing your mind is a new vote; the latest one per voter and testimony counts.
@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.voterUserId).and(claims.email.eq(item.voterEmail)),
})
export class Vote {
  @uuid() id!: string;
  @uuid() testimony_id!: string;
  @one(() => Testimony) testimony?: Testimony;
  @set('for', 'against') value!: 'for' | 'against';
  @text({ max: 1000, optional: true }) comment?: string;
  @text({ max: 255 }) voterUserId!: string;
  @email({ max: 254 }) voterEmail!: string;
  @date() createdAt!: Date;
}
