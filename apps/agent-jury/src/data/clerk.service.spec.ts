import { describe, expect, it, vi } from "vitest";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { ClerkResult } from "../../rayfin/functions/src/clerk-actions";
import { ClerkActionError, readAdminLog, runClerkAction } from "./clerk.service";
import { describeClerkError } from "./clerk-errors";
import { NotSignedInError } from "./session-author";

const REQUEST_ID = "00000000-0000-4000-8000-0000000000a1";

function fakeClient(result: ClerkResult | Error, signedIn = true) {
    const create = vi.fn(async (input: object) => ({ id: REQUEST_ID, ...input }));
    const invoke = vi.fn(async () => {
        if (result instanceof Error) throw result;
        return result;
    });
    const session = signedIn
        ? { isAuthenticated: true, user: { id: "sub-dario", email: "dario.admin@example.com" } }
        : { isAuthenticated: false, user: null };
    const client = {
        data: { AdminRequest: { create } },
        functions: { clerkExecute: { invoke } },
        auth: { getSession: () => session },
    } as unknown as AppRayfinClient;
    return { client, create, invoke };
}

const rejected = (code: ClerkResult["code"], reason: ClerkResult["reason"]): ClerkResult => ({
    code,
    outcome: "rejected",
    reason,
    detail: "server detail",
});

async function failureOf(promise: Promise<unknown>): Promise<unknown> {
    try {
        await promise;
    } catch (error) {
        return error;
    }
    throw new Error("expected a failure");
}

describe("runClerkAction", () => {
    it("inserts the request as the session user and invokes clerkExecute with the id only", async () => {
        const { client, create, invoke } = fakeClient({ code: 200, outcome: "done", reason: "ok", detail: "Role changed." });
        await runClerkAction(client, "setJurorRole", { jurorId: "j1", role: "approver" });
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({
                requesterEmail: "dario.admin@example.com",
                action: "setJurorRole",
                payload: JSON.stringify({ jurorId: "j1", role: "approver" }),
            }),
        );
        expect(invoke).toHaveBeenCalledWith({ requestId: REQUEST_ID });
    });

    it("throws a ClerkActionError with the server result when the request is rejected", async () => {
        const { client } = fakeClient(rejected(403, "not_admin"));
        const error = await failureOf(runClerkAction(client, "readAdminLog", { limit: 3 }));
        expect(error).toBeInstanceOf(ClerkActionError);
        expect((error as ClerkActionError).technicalDetails).toBe("403 not_admin: server detail");
    });

    it("returns the log entries of readAdminLog", async () => {
        const entry = {
            requestId: REQUEST_ID,
            action: "setJurorActive",
            payload: "{}",
            requesterEmail: "dario.admin@example.com",
            outcome: "rejected" as const,
            reason: "self_protection",
            detail: "An admin cannot deactivate themselves.",
            processedAt: "2026-11-09T10:00:00.000Z",
        };
        const { client } = fakeClient({ code: 200, outcome: "done", reason: "ok", detail: "1 entries.", log: [entry] });
        expect(await readAdminLog(client, 3)).toEqual([entry]);
    });

    it("does nothing without a signed-in user", async () => {
        const { client, create } = fakeClient(rejected(403, "not_admin"), false);
        await expect(runClerkAction(client, "readAdminLog", { limit: 1 })).rejects.toBeInstanceOf(NotSignedInError);
        expect(create).not.toHaveBeenCalled();
    });
});

describe("describeClerkError", () => {
    const viaService = async (result: ClerkResult | Error, action: "swearInJuror" | "registerAgent" = "swearInJuror") => {
        const { client } = fakeClient(result);
        const payload =
            action === "registerAgent"
                ? { name: "Sales", workspaceId: REQUEST_ID, itemId: REQUEST_ID }
                : { email: "new@example.com", role: "expert" as const };
        return describeClerkError(await failureOf(runClerkAction(client, action, payload as never)));
    };

    it.each([
        [rejected(403, "not_admin"), "onlyAdmins"],
        [rejected(403, "unknown_action"), "onlyAdmins"],
        [rejected(409, "already_processed"), "alreadyApplied"],
        [rejected(403, "expired"), "tryAgain"],
        [rejected(404, "unknown_request"), "tryAgain"],
        [rejected(422, "self_protection"), "selfProtection"],
        [rejected(400, "invalid_payload"), "invalid"],
        [rejected(404, "not_found"), "notFound"],
        [rejected(500, "server_error"), "unexpected"],
    ] as const)("maps %o to %s", async (result, key) => {
        expect((await viaService(result)).key).toBe(key);
    });

    it("tells apart an existing juror and an existing agent", async () => {
        expect((await viaService(rejected(422, "already_exists"))).key).toBe("jurorExists");
        expect((await viaService(rejected(422, "already_exists"), "registerAgent")).key).toBe("agentExists");
    });

    it("asks to try again when the server can't be reached, keeping the cause as technical detail", async () => {
        const view = await viaService(new TypeError("Failed to fetch"));
        expect(view).toEqual({ key: "tryAgain", technicalDetails: "TypeError: Failed to fetch" });
    });

    it("keeps the server detail out of the message and in the technical details", async () => {
        expect(await viaService(rejected(403, "not_admin"))).toEqual({
            key: "onlyAdmins",
            technicalDetails: "403 not_admin: server detail",
        });
    });

    it("handles a missing session and unknown errors", () => {
        expect(describeClerkError(new NotSignedInError())).toEqual({ key: "notSignedIn" });
        expect(describeClerkError(new Error("boom"))).toEqual({ key: "unexpected", technicalDetails: "boom" });
    });
});
