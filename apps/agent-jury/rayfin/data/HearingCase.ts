import { entity, authenticated, uuid, text, int, one } from '@microsoft/rayfin-core';
import { Hearing } from './Hearing.js';

// Snapshot taken when the hearing starts: the question and the ruled answer as they were then, so the verdicts
// stay tied to what was asked even if the case changes later. Written only by the admin Function.
@entity()
@authenticated('read')
export class HearingCase {
  @uuid() id!: string;
  @uuid() hearing_id!: string;
  @one(() => Hearing) hearing?: Hearing;
  @uuid() case_id!: string;
  @uuid() testimony_id!: string;
  @int() position!: number;
  @text({ max: 1000 }) question!: string;
  @text({ max: 2000 }) expectedAnswer!: string;
}
