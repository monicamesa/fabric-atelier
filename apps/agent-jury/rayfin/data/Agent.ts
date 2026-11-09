import { entity, authenticated, uuid, text, boolean, many } from '@microsoft/rayfin-core';
import { Case } from './Case.js';

@entity()
@authenticated('read')
export class Agent {
  @uuid() id!: string;
  @text({ max: 200 }) name!: string;
  @text({ max: 36 }) workspaceId!: string;
  @text({ max: 36 }) itemId!: string;
  @boolean({ default: true }) active!: boolean;
  @many(() => Case) cases?: Case[];
}
