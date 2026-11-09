import { entity, authenticated, uuid, text, email, date, one } from '@microsoft/rayfin-core';
import { Case } from './Case.js';

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId).and(claims.email.eq(item.authorEmail)),
})
export class Testimony {
  @uuid() id!: string;
  @uuid() case_id!: string;
  @one(() => Case) case?: Case;
  @text({ max: 2000 }) answer!: string;
  @text({ max: 1000 }) definition!: string;
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
}
