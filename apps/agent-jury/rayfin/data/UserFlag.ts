import { entity, authenticated, uuid, text, date } from '@microsoft/rayfin-core';

// One-time per-user flags (for example "intro_seen"). Insert-only: a flag is set when a row exists for
// (userId, flag), and duplicate rows are harmless. Each user can create and read only their own rows.
// Flag values are constants in src/data/user-flags.service.ts, never user input. No email or name is stored.
@entity()
@authenticated('read', {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.userId),
})
export class UserFlag {
  @uuid() id!: string;
  @text({ max: 255 }) userId!: string;
  @text({ max: 64 }) flag!: string;
  @date() at!: Date;
}
