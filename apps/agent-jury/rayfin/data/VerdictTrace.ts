import { entity, authenticated, uuid, text, boolean, date, one } from '@microsoft/rayfin-core';
import { Verdict } from './Verdict.js';

// How the agent got to its answer: the tools it used and the queries it generated (DAX, SQL or KQL), one row per verdict.
// Written only by the evaluate_agent notebook (INSERT only). It never holds query results, data rows, URLs or ids.
@entity()
@authenticated('read')
export class VerdictTrace {
  @uuid() id!: string;
  @uuid() verdict_id!: string;
  @one(() => Verdict) verdict?: Verdict;
  // JSON list of { k: "source" | "query", tool, lang, request, code }; see src/data/trace.ts.
  @text({ max: 4000 }) steps!: string;
  @boolean({ default: false }) truncated!: boolean;
  @text({ max: 50 }) sdkVersion!: string;
  @date() createdAt!: Date;
}
