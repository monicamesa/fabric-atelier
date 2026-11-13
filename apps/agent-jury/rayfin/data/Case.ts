import { entity, authenticated, uuid, text, email, date, set, one, many } from '@microsoft/rayfin-core';
import { Agent } from './Agent.js';
import { Testimony } from './Testimony.js';
import { CaseDismissal } from './CaseDismissal.js';

@entity()
@authenticated('read')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.authorUserId).and(claims.email.eq(item.authorEmail)),
})
export class Case {
  @uuid() id!: string;
  @uuid() agent_id!: string;
  @one(() => Agent) agent?: Agent;
  @text({ max: 1000 }) text!: string;
  @text({ max: 100 }) category!: string;
  @text({ max: 500, optional: true }) tags?: string;
  // The UI language when the case was written. Older cases have none, and then no badge is shown.
  @set({ optional: true }, 'en', 'es') language?: 'en' | 'es';
  @text({ max: 255 }) authorUserId!: string;
  @email({ max: 254 }) authorEmail!: string;
  @date() createdAt!: Date;
  @many(() => Testimony) testimonies?: Testimony[];
  @many(() => CaseDismissal) dismissals?: CaseDismissal[];
}
