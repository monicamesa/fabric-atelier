import { entity, authenticated, uuid, text, email, date, one } from '@microsoft/rayfin-core';
import { Case } from './Case.js';

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.dismissedByUserId).and(claims.email.eq(item.dismissedByEmail)),
})
export class CaseDismissal {
  @uuid() id!: string;
  @uuid() case_id!: string;
  @one(() => Case) case?: Case;
  @text({ max: 1000 }) reason!: string;
  @text({ max: 255 }) dismissedByUserId!: string;
  @email({ max: 254 }) dismissedByEmail!: string;
  @date() createdAt!: Date;
}
