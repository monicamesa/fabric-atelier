import { describe, expect, it, vi } from "vitest";
import { createFeedback, FEEDBACK_MAX_LENGTH, readFeedback } from "./feedback.service";
import { NotSignedInError } from "./session-author";

function clientFor(signedIn = true) {
    const create = vi.fn(async (input: unknown) => ({ id: "f1", ...(input as object) }));
    const session = signedIn ? { isAuthenticated: true, user: { id: "sub-ana", email: "ana.expert@example.com" } } : { isAuthenticated: false, user: null };
    return { create, client: { data: { Feedback: { create } }, auth: { getSession: () => session } } as never };
}

describe("createFeedback", () => {
    it("stores the subject claim, the type, the message, the screen name and the contact choice, and nothing else", async () => {
        const { create, client } = clientFor();
        await createFeedback(client, { type: "bug", message: "  The button does nothing.  ", page: "cases", canContact: true });
        expect(create).toHaveBeenCalledTimes(1);
        const input = create.mock.calls[0][0] as Record<string, unknown>;
        expect(Object.keys(input).sort()).toEqual(["canContact", "createdAt", "message", "page", "type", "userId"]);
        expect(input).toMatchObject({ userId: "sub-ana", type: "bug", message: "The button does nothing.", page: "cases", canContact: true });
        expect(JSON.stringify(input)).not.toContain("example.com");
    });

    it("keeps only a known screen name as the page, so ids never end up there", async () => {
        const { create, client } = clientFor();
        await createFeedback(client, { type: "idea", message: "x", page: "00000000-0000-4000-8000-000000000001", canContact: false });
        await createFeedback(client, { type: "idea", message: "x", page: "", canContact: false });
        expect((create.mock.calls[0][0] as { page?: string }).page).toBeUndefined();
        expect((create.mock.calls[1][0] as { page?: string }).page).toBeUndefined();
    });

    it("cuts the message at 2000 characters", async () => {
        const { create, client } = clientFor();
        await createFeedback(client, { type: "other", message: "x".repeat(FEEDBACK_MAX_LENGTH + 50), canContact: false });
        expect((create.mock.calls[0][0] as { message: string }).message).toHaveLength(FEEDBACK_MAX_LENGTH);
    });

    it("needs a signed-in user", async () => {
        const { create, client } = clientFor(false);
        await expect(createFeedback(client, { type: "idea", message: "x", canContact: false })).rejects.toBeInstanceOf(NotSignedInError);
        expect(create).not.toHaveBeenCalled();
    });
});

describe("readFeedback", () => {
    it("asks the admin Function for the entries, never the table", async () => {
        const entries = [{ id: "f1", type: "idea", message: "m", page: "home", canContact: false, createdAt: "2026-11-12T10:00:00.000Z" }];
        const create = vi.fn(async () => ({ id: "request-1" }));
        const invoke = vi.fn(async () => ({ code: 200, outcome: "done", reason: "ok", detail: "", feedback: entries }));
        const client = {
            data: { AdminRequest: { create }, Feedback: { select: vi.fn() } },
            auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-dario", email: "dario.admin@example.com" } }) },
            functions: { clerkExecute: { invoke } },
        } as never;
        expect(await readFeedback(client, 50)).toEqual(entries);
        expect(create).toHaveBeenCalledWith(expect.objectContaining({ action: "readFeedback", payload: JSON.stringify({ limit: 50 }) }));
        expect(invoke).toHaveBeenCalledWith({ requestId: "request-1" });
    });
});
