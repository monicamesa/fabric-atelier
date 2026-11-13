/** The five stages of the game, in order: the same as "The game" line on Home. */
export const STAGES = ["propose", "vote", "ruled", "hearing", "review"] as const;
export type GuideStage = (typeof STAGES)[number];
