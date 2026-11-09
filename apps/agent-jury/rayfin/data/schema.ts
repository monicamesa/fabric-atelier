import { Juror } from './Juror.js';
import { Agent } from './Agent.js';
import { Case } from './Case.js';
import { Testimony } from './Testimony.js';
import { CaseDismissal } from './CaseDismissal.js';

export type AgentJurySchema = {
  Juror: Juror;
  Agent: Agent;
  Case: Case;
  Testimony: Testimony;
  CaseDismissal: CaseDismissal;
};

export const schema = [Juror, Agent, Case, Testimony, CaseDismissal];
