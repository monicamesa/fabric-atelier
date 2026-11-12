import { describe, expect, it, vi } from "vitest";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import { NotSignedInError } from "./session-author";
import { hasUserFlag, setUserFlag, USER_FLAGS } from "./user-flags.service";

function fakeClient(rows: unknown[] = [], signedIn = true) {
    const calls: [string, unknown][] = [];
    const create = vi.fn(async (input: unknown) => ({ id: "new-id", ...(input as object) }));
    const builder: Record<string, unknown> = {};
    for (const name of ["select", "where", "first"]) {
        builder[name] = (value: unknown) => {
            calls.push([name, value]);
            return builder;
        };
    }
    builder.execute = async () => rows;
    const session = signedIn
        ? { isAuthenticated: true, isAnonymous: false, user: { id: "sub-ana" } }
        : { isAuthenticated: false, isAnonymous: false, user: null };
    const client = { data: { UserFlag: { select: (fields: unknown) => (builder.select as (v: unknown) => unknown)(fields), create } }, auth: { getSession: () => session } };
    return { client: client as unknown as AppRayfinClient, calls, create };
}

describe("user flags", () => {
    it("reads the flag for the signed-in user only", async () => {
        const { client, calls } = fakeClient([{ id: "row" }]);
        await expect(hasUserFlag(client, USER_FLAGS.introSeen)).resolves.toBe(true);
        expect(calls).toEqual([
            ["select", ["id"]],
            ["where", { userId: { eq: "sub-ana" }, flag: { eq: "intro_seen" } }],
            ["first", 1],
        ]);
    });

    it("is not set when there is no row", async () => {
        await expect(hasUserFlag(fakeClient([]).client, USER_FLAGS.introSeen)).resolves.toBe(false);
    });

    it("writes the subject, the flag and a date, and nothing else", async () => {
        const { client, create } = fakeClient();
        await setUserFlag(client, USER_FLAGS.introSeen);
        expect(create).toHaveBeenCalledTimes(1);
        const input = create.mock.calls[0][0] as Record<string, unknown>;
        expect(Object.keys(input).sort()).toEqual(["at", "flag", "userId"]);
        expect(input.userId).toBe("sub-ana");
        expect(input.flag).toBe("intro_seen");
        expect(input.at).toBeInstanceOf(Date);
    });

    it("needs a signed-in user", async () => {
        const { client, create } = fakeClient([], false);
        await expect(hasUserFlag(client, USER_FLAGS.introSeen)).rejects.toBeInstanceOf(NotSignedInError);
        await expect(setUserFlag(client, USER_FLAGS.introSeen)).rejects.toBeInstanceOf(NotSignedInError);
        expect(create).not.toHaveBeenCalled();
    });
});
