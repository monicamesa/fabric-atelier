import type { AppRayfinClient } from "@/lib/rayfin-client";
import { NotSignedInError } from "./session-author";

type FlagClient = Pick<AppRayfinClient, "data" | "auth">;

/** Only the subject claim is needed: a flag stores no email or name. */
function sessionUserId(client: Pick<AppRayfinClient, "auth">): string {
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user?.id) throw new NotSignedInError();
    return session.user.id;
}

/** One-time per-user flags kept in the UserFlag entity. Values are constants, never user input. */
export const USER_FLAGS = {
    introSeen: "intro_seen",
} as const;

export type UserFlagName = (typeof USER_FLAGS)[keyof typeof USER_FLAGS];

/** A flag is set when the signed-in user has at least one row for it. */
export async function hasUserFlag(client: FlagClient, flag: UserFlagName): Promise<boolean> {
    const userId = sessionUserId(client);
    const rows = (await client.data.UserFlag.select(["id"])
        .where({ userId: { eq: userId }, flag: { eq: flag } })
        .first(1)
        .execute()) as unknown[] | undefined;
    return (rows?.length ?? 0) > 0;
}

/** Sets a flag for the signed-in user. Duplicate rows are harmless. */
export async function setUserFlag(client: FlagClient, flag: UserFlagName): Promise<void> {
    const userId = sessionUserId(client);
    await client.data.UserFlag.create({ userId, flag, at: new Date() });
}
