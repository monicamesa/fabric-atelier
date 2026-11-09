import { entity, authenticated, uuid, email, set, text, boolean } from '@microsoft/rayfin-core';

@entity()
@authenticated('read')
export class Juror {
  @uuid() id!: string;
  @email({ max: 254, unique: true }) email!: string;
  @text({ max: 100, optional: true }) displayName?: string;
  @set('expert', 'approver', 'admin') role!: 'expert' | 'approver' | 'admin';
  @text({ max: 100, optional: true }) team?: string;
  @boolean({ default: true }) active!: boolean;
}
