import { entity, authenticated, uuid, text, email, date, one, many } from '@microsoft/rayfin-core';
import { Case } from './Case.js';
import { Vote } from './Vote.js';

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
  // Optional structured definition, compared row by row in the dispute table (I1c D3).
  @text({ max: 300, optional: true }) criterion?: string;
  @text({ max: 300, optional: true }) timeWindow?: string;
  @text({ max: 300, optional: true }) population?: string;
  @text({ max: 300, optional: true }) source?: string;
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
  @many(() => Vote) votes?: Vote[];
}
