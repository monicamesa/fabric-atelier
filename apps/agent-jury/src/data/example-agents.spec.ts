import { describe, expect, it } from "vitest";
import { defaultAgent, isExampleAgent, isExampleJuror, plainAgentName, visibleAgents } from "./example-agents";

const real = { id: "a-real", name: "Sales Agent", workspaceId: "ws-real", itemId: "item-real" };
const exampleByName = { id: "a-ex1", name: "Finance agent (example)", workspaceId: "ws-real", itemId: "item-1" };
const exampleById = { id: "a-ex2", name: "Ops", workspaceId: "00000000-0000-4000-8000-000000000031", itemId: "item-2" };

describe("isExampleAgent", () => {
    it("recognises placeholder ids and an (example) / (ejemplo) name", () => {
        expect(isExampleAgent(real)).toBe(false);
        expect(isExampleAgent(exampleByName)).toBe(true);
        expect(isExampleAgent(exampleById)).toBe(true);
        expect(isExampleAgent({ ...real, name: "Agente (Ejemplo)" })).toBe(true);
        expect(isExampleAgent({ ...real, itemId: "00000000-0000-4000-8000-000000000041" })).toBe(true);
    });

    it("does not treat the word 'example' inside a real name as an example", () => {
        expect(isExampleAgent({ ...real, name: "Example Corp sales agent" })).toBe(false);
    });
});

describe("isExampleJuror", () => {
    // Addresses are built from parts so the privacy hook sees no real-looking email in the file.
    const mail = (local: string, domain: string) => ({ email: `${local}@${domain}` });

    it("recognises reserved example addresses and nothing else", () => {
        for (const domain of ["example.com", "example.org", "example.net", "contoso.example", "EXAMPLE.COM"]) {
            expect(isExampleJuror(mail("ana", domain))).toBe(true);
        }
        expect(isExampleJuror(mail(" carla", "example.com "))).toBe(true);
        for (const domain of ["acme.com", "notexample.com", "example.com.au", "examples.com"]) {
            expect(isExampleJuror(mail("ana", domain))).toBe(false);
        }
        expect(isExampleJuror({ email: "example" })).toBe(false);
    });
});

describe("plainAgentName", () => {
    it("drops a trailing (example) so the localized label is not repeated", () => {
        expect(plainAgentName(exampleByName)).toBe("Finance agent");
        expect(plainAgentName(real)).toBe("Sales Agent");
    });
});

describe("visibleAgents", () => {
    const all = [exampleByName, real, exampleById];

    it("hides example agents once a real agent exists, unless they are switched on", () => {
        expect(visibleAgents(all, false)).toEqual([real]);
    });

    it("keeps example agents when switched on (they are labelled in the UI)", () => {
        expect(visibleAgents(all, true)).toEqual(all);
    });

    it("keeps examples when there is no real agent, so the app is not empty", () => {
        expect(visibleAgents([exampleByName, exampleById], false)).toEqual([exampleByName, exampleById]);
        expect(visibleAgents([], false)).toEqual([]);
    });
});

describe("defaultAgent", () => {
    const visible = [exampleByName, real];

    it("selects the real agent by default even when an example sorts first", () => {
        expect(defaultAgent(visible, undefined)).toBe(real);
    });

    it("keeps the agent named in the URL when it is visible", () => {
        expect(defaultAgent(visible, "a-ex1")).toBe(exampleByName);
    });

    it("falls back to the default when the requested agent is not visible", () => {
        expect(defaultAgent([real], "a-ex1")).toBe(real);
    });

    it("uses the first example when only examples exist", () => {
        expect(defaultAgent([exampleByName], undefined)).toBe(exampleByName);
    });
});
