import { Juror } from './Juror.js';
import { Agent } from './Agent.js';
import { Case } from './Case.js';
import { Testimony } from './Testimony.js';
import { CaseDismissal } from './CaseDismissal.js';
import { Vote } from './Vote.js';
import { Hearing } from './Hearing.js';
import { HearingCase } from './HearingCase.js';
import { HearingEvent } from './HearingEvent.js';
import { Verdict } from './Verdict.js';
import { AdminRequest } from './AdminRequest.js';
import { AdminRequestResult } from './AdminRequestResult.js';
import { UserFlag } from './UserFlag.js';
import { VerdictReview } from './VerdictReview.js';

export type AgentJurySchema = {
  Juror: Juror;
  Agent: Agent;
  Case: Case;
  Testimony: Testimony;
  CaseDismissal: CaseDismissal;
  Vote: Vote;
  Hearing: Hearing;
  HearingCase: HearingCase;
  HearingEvent: HearingEvent;
  Verdict: Verdict;
  AdminRequest: AdminRequest;
  AdminRequestResult: AdminRequestResult;
  UserFlag: UserFlag;
  VerdictReview: VerdictReview;
};

export const schema = [Juror, Agent, Case, Testimony, CaseDismissal, Vote, Hearing, HearingCase, HearingEvent, Verdict, AdminRequest, AdminRequestResult, UserFlag, VerdictReview];
