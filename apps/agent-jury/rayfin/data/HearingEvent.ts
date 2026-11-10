import { entity, authenticated, uuid, text, date, set, one } from '@microsoft/rayfin-core';
import { Hearing } from './Hearing.js';

// What happened to a hearing, in order. Written by the admin Function (launched, cancelled) and the evaluate_agent
// notebook (started, progress, completed, failed) with T-SQL; createdAt is the database clock.
@entity()
@authenticated('read')
export class HearingEvent {
  @uuid() id!: string;
  @uuid() hearing_id!: string;
  @one(() => Hearing) hearing?: Hearing;
  @set('launched', 'started', 'progress', 'completed', 'failed', 'cancelled') kind!: 'launched' | 'started' | 'progress' | 'completed' | 'failed' | 'cancelled';
  // launched: the job instance id; started: the SDK version; progress: "n of m"; failed: a short reason.
  @text({ max: 500, optional: true }) detail?: string;
  @date() createdAt!: Date;
}
