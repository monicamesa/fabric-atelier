import { entity, authenticated, uuid, text, date, set, one } from '@microsoft/rayfin-core';
import { Hearing } from './Hearing.js';

// The judge's ruling on the agent's answer to one case. Written only by the evaluate_agent notebook (INSERT only).
// The agent version, etag and last-published time are kept because the same agent can answer differently over time.
@entity()
@authenticated('read')
export class Verdict {
  @uuid() id!: string;
  @uuid() hearing_id!: string;
  @one(() => Hearing) hearing?: Hearing;
  @uuid() case_id!: string;
  @text({ max: 4000 }) agentAnswer!: string;
  @set('correct', 'incorrect', 'unclear') judgeVerdict!: 'correct' | 'incorrect' | 'unclear';
  // The raw evaluation_message from the SDK ("Yes", "No", ...).
  @text({ max: 50 }) judgeMessage!: string;
  @text({ max: 100 }) evaluationId!: string;
  @text({ max: 50, optional: true }) dataAgentVersion?: string;
  @text({ max: 100, optional: true }) dataAgentEtag?: string;
  @text({ max: 50, optional: true }) dataAgentLastUpdated?: string;
  @date() createdAt!: Date;
}
