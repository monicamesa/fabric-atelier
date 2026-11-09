import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { AdminLogEntry, ClerkCommand, ClerkResult } from "../../rayfin/functions/src/clerk-actions";
import { getSessionAuthor } from "./session-author";

type ClerkClient = Pick<AppRayfinClient, "data" | "auth" | "functions">;
type ClerkActionName = ClerkCommand["action"];
export type ClerkPayload<A extends ClerkActionName> = Omit<Extract<ClerkCommand, { action: A }>, "action">;

/** A clerk action that did not complete. `result` is missing when the server was never reached. */
export class ClerkActionError extends Error {
    constructor(
        readonly action: ClerkActionName,
        readonly result: ClerkResult | undefined,
        readonly technicalDetails: string,
    ) {
        super(result ? `${action} rejected (${result.code} ${result.reason}).` : `${action} could not reach the server.`);
        this.name = "ClerkActionError";
    }
}

function describe(error: unknown): string {
    const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return text.replace(/\s+/g, " ").slice(0, 300);
}

/** Inserts the AdminRequest as the signed-in user, then asks clerkExecute to run it by id only. */
export async function runClerkAction<A extends ClerkActionName>(
    client: ClerkClient,
    action: A,
    payload: ClerkPayload<A>,
): Promise<ClerkResult> {
    const author = getSessionAuthor(client);
    let result: ClerkResult;
    try {
        const request = await client.data.AdminRequest.create({
            requesterEmail: author.email,
            action,
            payload: JSON.stringify(payload),
            createdAt: new Date(),
        });
        result = await client.functions.clerkExecute.invoke({ requestId: request.id });
    } catch (error) {
        throw new ClerkActionError(action, undefined, describe(error));
    }
    if (result.outcome !== "done") {
        throw new ClerkActionError(action, result, `${result.code} ${result.reason}: ${result.detail}`);
    }
    return result;
}

export async function readAdminLog(client: ClerkClient, limit: number): Promise<AdminLogEntry[]> {
    const result = await runClerkAction(client, "readAdminLog", { limit });
    return result.log ?? [];
}
