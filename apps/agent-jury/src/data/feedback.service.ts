import type { FeedbackEntry } from "../../rayfin/functions/src/clerk-actions";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { runClerkAction } from "./clerk.service";
import { NotSignedInError } from "./session-author";

type FeedbackClient = Pick<AppRayfinClient, "data" | "auth" | "functions">;

export const FEEDBACK_TYPES = ["idea", "confusing", "bug", "other"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Screen names, never ids: the page a note refers to is stored as one of these. */
export const FEEDBACK_PAGES = ["home", "cases", "case", "hearings", "hearing", "clerk", "guide", "intro", "feedback"] as const;
export type FeedbackPage = (typeof FEEDBACK_PAGES)[number];

export const FEEDBACK_MAX_LENGTH = 2000;

export interface NewFeedback {
    type: FeedbackType;
    message: string;
    /** Empty or unknown means "not about a page". */
    page?: string;
    canContact: boolean;
}

export function isFeedbackPage(value: string | undefined): value is FeedbackPage {
    return (FEEDBACK_PAGES as readonly string[]).includes(value ?? "");
}

/** Stores one feedback note as the signed-in user (only the subject claim, no email or name). */
export async function createFeedback(client: Pick<AppRayfinClient, "data" | "auth">, input: NewFeedback): Promise<void> {
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user?.id) throw new NotSignedInError();
    await client.data.Feedback.create({
        userId: session.user.id,
        type: input.type,
        message: input.message.trim().slice(0, FEEDBACK_MAX_LENGTH),
        page: isFeedbackPage(input.page) ? input.page : undefined,
        canContact: input.canContact,
        createdAt: new Date(),
    });
}

/** Admin-only: the Function reads the table; any other user is refused (not_admin). */
export async function readFeedback(client: FeedbackClient, limit: number): Promise<FeedbackEntry[]> {
    const result = await runClerkAction(client, "readFeedback", { limit });
    return result.feedback ?? [];
}
