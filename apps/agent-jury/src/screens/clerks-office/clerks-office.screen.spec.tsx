import { describe, expect, it, vi, beforeAll } from "vitest";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import type { AppRayfinClient } from "@/lib/rayfin-client";
import type { ClerkResult } from "../../../rayfin/functions/src/clerk-actions";
import type { JurorRow } from "@/data/directory.service";
import { initI18n, i18n } from "@/i18n/i18n";
import { ClerksOffice } from "./clerks-office.screen";

const DARIO: JurorRow = { id: "00000000-0000-4000-8000-000000000014", email: "dario.admin@example.com", displayName: null, role: "admin", team: "Data team", active: true };
const ANA: JurorRow = { id: "00000000-0000-4000-8000-000000000011", email: "ana.expert@example.com", displayName: "Ana E.", role: "expert", team: "Finance", active: true };
const AGENT = { id: "00000000-0000-4000-8000-000000000021", name: "Sales agent (example)", workspaceId: "00000000-0000-4000-8000-000000000031", itemId: "00000000-0000-4000-8000-000000000041", active: true };

type Handler = (payload: Record<string, unknown>) => ClerkResult;

function fakeClient(handlers: Partial<Record<string, Handler>>) {
    const requests = new Map<string, { action: string; payload: Record<string, unknown> }>();
    const page = (items: unknown[]) => {
        const builder: Record<string, unknown> = {};
        for (const name of ["where", "orderBy", "first", "after"]) builder[name] = () => builder;
        builder.executePaginated = async () => ({ items, hasNextPage: false });
        return builder;
    };
    const create = vi.fn(async (input: { action: string; payload: string }) => {
        const id = `00000000-0000-4000-8000-${String(requests.size + 1).padStart(12, "0")}`;
        requests.set(id, { action: input.action, payload: JSON.parse(input.payload) });
        return { id };
    });
    const invoke = vi.fn(async ({ requestId }: { requestId: string }) => {
        const request = requests.get(requestId)!;
        const handler = handlers[request.action];
        return handler ? handler(request.payload) : { code: 200, outcome: "done", reason: "ok", detail: "", log: [] };
    });
    const client = {
        data: {
            Agent: { select: () => page([AGENT]) },
            Case: { select: () => page([{ id: "c1", agent_id: AGENT.id, authorEmail: ANA.email }]) },
            Testimony: { select: () => page([]) },
            AdminRequest: { create },
        },
        functions: { clerkExecute: { invoke } },
        auth: { getSession: () => ({ isAuthenticated: true, user: { id: "sub-dario", email: DARIO.email } }) },
    } as unknown as AppRayfinClient;
    return { client, create, invoke, requests };
}

const jury = (jurors: JurorRow[]) => ({ status: "success" as const, data: jurors, reload: vi.fn() });

/** Opens the "Actions ▾" menu of one juror and returns it. */
function openActions(scope: HTMLElement, name: string) {
    fireEvent.click(within(scope).getByRole("button", { name: `Actions for ${name}` }));
    return within(scope).getByRole("menu");
}

beforeAll(async () => {
    initI18n("en");
    await i18n.changeLanguage("en");
});

describe("ClerksOffice", () => {
    it("shows only a notice to someone who is not an active admin, and sends no admin request", async () => {
        const { client, create } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA])} me={ANA} />);
        expect(screen.getByRole("note")).toHaveTextContent("Only active admins can use the clerk's office");
        expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(create).not.toHaveBeenCalled();
    });

    it("hides deactivate and role changes on the admin's own row only", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        const ownRow = within(table).getByText(/dario\.admin \(you\)/).closest("tr")!;
        const ownMenu = openActions(ownRow, "dario.admin");
        expect(within(ownMenu).getByText("You can't remove yourself")).toBeInTheDocument();
        expect(within(ownMenu).getAllByRole("menuitem").map((item) => item.getAttribute("aria-label"))).toEqual(["Edit the details of dario.admin"]);
        expect(within(ownRow).queryByRole("combobox")).not.toBeInTheDocument();
        const anaRow = within(table).getByText("Ana E.").closest("tr")!;
        const anaMenu = openActions(anaRow, "Ana E.");
        expect(within(anaMenu).getByRole("menuitem", { name: "Deactivate Ana E." })).toBeInTheDocument();
        expect(within(anaMenu).getByRole("menuitem", { name: "Change the role of Ana E." })).toBeInTheDocument();
    });

    it("lets an admin edit their own display name and team through clerkExecute", async () => {
        const { client, requests } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        const ownRow = within(table).getByText(/dario\.admin \(you\)/).closest("tr")!;
        const menu = openActions(ownRow, "dario.admin");
        fireEvent.click(within(menu).getByRole("menuitem", { name: "Edit the details of dario.admin" }));
        // The form opens in its own row under the juror, so the table never changes its width.
        fireEvent.change(within(table).getByLabelText("Display name"), { target: { value: " Dario A. " } });
        expect(within(table).getByLabelText("Team")).toHaveValue("Data team");
        fireEvent.change(within(table).getByLabelText("Team"), { target: { value: "" } });
        fireEvent.click(within(table).getByRole("button", { name: "Save details" }));
        await waitFor(() =>
            expect([...requests.values()].find((request) => request.action === "editJurorDetails")?.payload).toEqual({
                jurorId: DARIO.id,
                displayName: "Dario A.",
            }),
        );
    });

    it("refreshes the app's agent lists right after an agent is registered, without a reload", async () => {
        const { client, requests } = fakeClient({});
        const onDirectoryChanged = vi.fn();
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} onDirectoryChanged={onDirectoryChanged} />);
        fireEvent.click(await screen.findByRole("tab", { name: /Agents/ }));
        fireEvent.click(await screen.findByRole("button", { name: /Register an agent/ }));
        fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "Quality agent" } });
        fireEvent.change(screen.getByLabelText("Workspace ID"), { target: { value: "00000000-0000-4000-8000-000000000032" } });
        fireEvent.change(screen.getByLabelText("Agent ID"), { target: { value: "00000000-0000-4000-8000-000000000043" } });
        fireEvent.click(screen.getByRole("button", { name: "Register the agent" }));
        await waitFor(() => expect(onDirectoryChanged).toHaveBeenCalledTimes(1));
        expect([...requests.values()].some((request) => request.action === "registerAgent")).toBe(true);
    });

    it("labels example agents as Example in the agents list", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        fireEvent.click(await screen.findByRole("tab", { name: /Agents/ }));
        const card = await screen.findByRole("article", { name: AGENT.name });
        expect(within(card).getByText("Example")).toBeInTheDocument();
        expect(within(card).getByText("Sales agent")).toBeInTheDocument();
    });

    it("hides example agents and jurors until an admin switches example data on, counts included, and says nothing is deleted", async () => {
        const { client } = fakeClient({});
        const onShowExamplesChange = vi.fn();
        const REAL: JurorRow = { id: "00000000-0000-4000-8000-000000000015", email: "real.person", displayName: "Real P.", role: "admin", team: null, active: true };
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO, REAL])} me={REAL} showExamples={false} onShowExamplesChange={onShowExamplesChange} />);
        const toggle = await screen.findByRole("checkbox", { name: /Show example data/ });
        expect(toggle).not.toBeChecked();
        expect(screen.getByText(/nothing is deleted/)).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /Jurors · 1/ })).toBeInTheDocument();
        expect(await screen.findByRole("tab", { name: /Agents · 0/ })).toBeInTheDocument();
        fireEvent.click(toggle);
        expect(onShowExamplesChange).toHaveBeenCalledWith(true);
    });

    it("shows example jurors and agents, and counts them, when example data is on", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} showExamples onShowExamplesChange={vi.fn()} />);
        expect(await screen.findByRole("tab", { name: /Jurors · 2/ })).toBeInTheDocument();
        expect(await screen.findByRole("tab", { name: /Agents · 1/ })).toBeInTheDocument();
    });

    it("never hides the admin's own row, even when it is an example", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} showExamples={false} onShowExamplesChange={vi.fn()} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        expect(within(table).getByText(/dario\.admin \(you\)/)).toBeInTheDocument();
        expect(within(table).queryByText("Ana E.")).not.toBeInTheDocument();
    });

    it("filters agents into Active and Retired, Active first", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        fireEvent.click(await screen.findByRole("tab", { name: /Agents/ }));
        expect(await screen.findByRole("button", { name: "Active · 1" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("article", { name: AGENT.name })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Retired · 0" }));
        expect(screen.queryByRole("article", { name: AGENT.name })).not.toBeInTheDocument();
        expect(screen.getByText(/No retired agents/)).toBeInTheDocument();
    });

    it("shows the role once and opens the role choice only on Change role, with Save and Cancel", async () => {
        const { client, requests } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        const anaRow = within(table).getByText("Ana E.").closest("tr")!;
        expect(within(anaRow).queryByRole("combobox")).not.toBeInTheDocument();

        fireEvent.click(within(openActions(anaRow, "Ana E.")).getByRole("menuitem", { name: "Change the role of Ana E." }));
        const select = within(table).getByRole("combobox", { name: "Role for Ana E." });
        fireEvent.click(within(table).getByRole("button", { name: "Cancel" }));
        expect(select).not.toBeInTheDocument();

        fireEvent.click(within(openActions(anaRow, "Ana E.")).getByRole("menuitem", { name: "Change the role of Ana E." }));
        fireEvent.change(within(table).getByRole("combobox", { name: "Role for Ana E." }), { target: { value: "approver" } });
        fireEvent.click(within(table).getByRole("button", { name: "Save role" }));
        await waitFor(() =>
            expect([...requests.values()].find((request) => request.action === "setJurorRole")?.payload).toEqual({ jurorId: ANA.id, role: "approver" }),
        );
    });

    it("puts every row action in one 'Actions' menu with full labels, closes it with Escape and gives the focus back", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        const anaRow = within(table).getByText("Ana E.").closest("tr")!;
        expect(within(anaRow).getAllByRole("button")).toHaveLength(1);
        const button = within(anaRow).getByRole("button", { name: "Actions for Ana E." });
        expect(button).toHaveTextContent("Actions");
        expect(button).toHaveAttribute("aria-expanded", "false");
        const menu = openActions(anaRow, "Ana E.");
        expect(button).toHaveAttribute("aria-expanded", "true");
        expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Edit details", "Change role", "Deactivate"]);
        expect(within(menu).getAllByRole("menuitem")[0]).toHaveFocus();
        fireEvent.keyDown(menu, { key: "ArrowDown" });
        expect(within(menu).getAllByRole("menuitem")[1]).toHaveFocus();
        fireEvent.keyDown(menu, { key: "Escape" });
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        expect(button).toHaveFocus();
    });

    it("keeps the jurors table at the full content width: no side column, and 'Swear in a juror' opens inline under its button", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Swear in a juror" })).not.toBeInTheDocument();
        const open = screen.getByRole("button", { name: "+ Swear in a juror" });
        expect(open).toHaveAttribute("aria-expanded", "false");
        // The button comes before the table; the form comes between them.
        expect(open.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        fireEvent.click(open);
        const form = screen.getByRole("region", { name: "Swear in a juror" });
        expect(open).toHaveAttribute("aria-expanded", "true");
        expect(form.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(table.parentElement).not.toContainElement(form);
        fireEvent.click(within(form).getByRole("button", { name: "Cancel" }));
        expect(screen.queryByRole("region", { name: "Swear in a juror" })).not.toBeInTheDocument();
    });

    it("closes the swear-in form and says so after a juror is added", async () => {
        const { client, requests } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        fireEvent.click(await screen.findByRole("button", { name: "+ Swear in a juror" }));
        fireEvent.change(screen.getByLabelText("Work email"), { target: { value: "new.juror@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: "Add to the jury" }));
        await waitFor(() => expect([...requests.values()].some((request) => request.action === "swearInJuror")).toBe(true));
        await waitFor(() => expect(screen.queryByRole("region", { name: "Swear in a juror" })).not.toBeInTheDocument());
    });

    it("stacks jurors as cards with full-width actions on phones, without a table", async () => {
        const original = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            matches: query === "(max-width: 899px)",
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        })) as unknown as typeof window.matchMedia;
        try {
            const { client } = fakeClient({});
            render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
            const list = await screen.findByRole("list", { name: "Jurors" });
            expect(screen.queryByRole("table", { name: "Jurors" })).not.toBeInTheDocument();
            const card = within(list).getByText("Ana E.").closest("li")!;
            expect(within(card).getByRole("button", { name: "Actions for Ana E." })).toHaveClass("w-full");
            const menu = openActions(card, "Ana E.");
            expect(within(menu).getByRole("menuitem", { name: "Deactivate Ana E." })).toBeInTheDocument();
            expect(within(menu).getByRole("menuitem", { name: "Change the role of Ana E." })).toBeInTheDocument();
        } finally {
            window.matchMedia = original;
        }
    });

    it("shows the display name, or the email's local part when it is empty", async () => {
        const { client } = fakeClient({});
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const table = await screen.findByRole("table", { name: "Jurors" });
        expect(within(table).getByText("Ana E.")).toBeInTheDocument();
        expect(within(table).getByText("dario.admin (you)")).toBeInTheDocument();
    });

    it("explains a rejected change in plain words and keeps the server detail under Technical details", async () => {
        const { client } = fakeClient({
            setJurorActive: () => ({ code: 403, outcome: "rejected", reason: "not_admin", detail: "The requester is not an active admin." }),
        });
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const anaRow = (await within(await screen.findByRole("table", { name: "Jurors" })).findByText("Ana E.")).closest("tr")!;
        fireEvent.click(within(openActions(anaRow, "Ana E.")).getByRole("menuitem", { name: "Deactivate Ana E." }));
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Only active admins can do this.");
        expect(alert).toHaveTextContent("Nothing was changed.");
        const details = within(alert).getByText("Technical details").closest("details")!;
        expect(details).not.toHaveAttribute("open");
        expect(details).toHaveTextContent("403 not_admin: The requester is not an active admin.");
    });

    it("keeps what was typed in the swear-in form when the change is rejected", async () => {
        const { client, requests } = fakeClient({
            swearInJuror: () => ({ code: 409, outcome: "rejected", reason: "already_processed", detail: "The request was already processed." }),
        });
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        fireEvent.click(await screen.findByRole("button", { name: "+ Swear in a juror" }));
        const email = await screen.findByLabelText("Work email");
        fireEvent.change(email, { target: { value: "new.juror@example.com" } });
        fireEvent.click(screen.getByLabelText(/^Approver/));
        fireEvent.click(screen.getByRole("button", { name: "Add to the jury" }));
        expect(await screen.findByText("This change was already applied.")).toBeInTheDocument();
        expect(email).toHaveValue("new.juror@example.com");
        const sent = [...requests.values()].find((request) => request.action === "swearInJuror");
        expect(sent?.payload).toEqual({ email: "new.juror@example.com", role: "approver" });
    });

    it("lists rejected attempts in the latest admin changes", async () => {
        const { client } = fakeClient({
            readAdminLog: () => ({
                code: 200,
                outcome: "done",
                reason: "ok",
                detail: "1 entries.",
                log: [
                    {
                        requestId: "r1",
                        action: "setJurorActive",
                        payload: JSON.stringify({ jurorId: DARIO.id, active: false }),
                        requesterEmail: "intruder@example.com",
                        outcome: "rejected",
                        reason: "not_admin",
                        detail: "The requester is not an active admin.",
                        processedAt: new Date().toISOString(),
                        automatedCheck: false,
                    },
                ],
            }),
        });
        render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
        const latest = await screen.findByRole("region", { name: "Latest admin changes" });
        await waitFor(() =>
            expect(latest).toHaveTextContent("Rejected: intruder tried to deactivate dario.admin (not an active admin)"),
        );
        expect(latest).not.toHaveTextContent("intruder@example.com");
    });

    it("switches to Spanish", async () => {
        const { client } = fakeClient({});
        await i18n.changeLanguage("es");
        try {
            render(<ClerksOffice client={client} jury={jury([ANA, DARIO])} me={DARIO} />);
            expect(await screen.findByRole("heading", { level: 1, name: "Secretaría" })).toBeInTheDocument();
            expect(screen.getByRole("tab", { name: "Jurados · 2" })).toBeInTheDocument();
        } finally {
            await i18n.changeLanguage("en");
        }
    });
});
