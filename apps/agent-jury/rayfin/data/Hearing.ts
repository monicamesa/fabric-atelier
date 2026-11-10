import { entity, authenticated, uuid, email, date, set, int, one, many } from '@microsoft/rayfin-core';
import { Agent } from './Agent.js';
import { HearingCase } from './HearingCase.js';
import { HearingEvent } from './HearingEvent.js';
import { Verdict } from './Verdict.js';

// One run of the judge over an agent's ruled cases. Insert-only and read-only for the client: the admin
// Function (clerkExecute, launchHearing) writes it with T-SQL after checking limits. Its state is derived from
// its HearingEvents (R6), never stored.
@entity()
@authenticated('read')
export class Hearing {
  @uuid() id!: string;
  @uuid() agent_id!: string;
  @one(() => Agent) agent?: Agent;
  @set('sandbox', 'production') stage!: 'sandbox' | 'production';
  // The AdminRequest that launched it: unique, so one request starts at most one hearing.
  @uuid({ unique: true }) requestId!: string;
  @email({ max: 254 }) launchedByEmail!: string;
  @int() caseCount!: number;
  @date() createdAt!: Date;
  @many(() => HearingCase) cases?: HearingCase[];
  @many(() => HearingEvent) events?: HearingEvent[];
  @many(() => Verdict) verdicts?: Verdict[];
}
