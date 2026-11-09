import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { JUROR_ROLES, type JurorRole } from "../../../rayfin/functions/src/clerk-actions";
import { Button } from "@/components/docket/button";
import { RadioField, TextField } from "@/components/docket/field";
import { emailLocalPart } from "@/lib/people";
import { ClerkError } from "./clerk-feedback";
import type { ClerkRunner } from "./clerk-runner";

interface SwearInFormProps {
    clerk: ClerkRunner;
    onNotice: (message: string) => void;
}

export function SwearInForm({ clerk, onNotice }: SwearInFormProps) {
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [team, setTeam] = useState("");
    const [role, setRole] = useState<JurorRole>("expert");
    const [emailError, setEmailError] = useState<string>();

    async function submit(event: FormEvent) {
        event.preventDefault();
        const trimmed = email.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            setEmailError(t("clerk.swearIn.emailInvalid"));
            return;
        }
        setEmailError(undefined);
        const payload = { email: trimmed, role, displayName: displayName.trim() || undefined, team: team.trim() || undefined };
        // On failure the form keeps what was typed.
        if (await clerk.run("swearInJuror", payload)) {
            onNotice(t("clerk.jurors.done.swornIn", { name: payload.displayName ?? emailLocalPart(trimmed) }));
            setEmail("");
            setDisplayName("");
            setTeam("");
            setRole("expert");
        }
    }

    return (
        <section aria-labelledby="clerk-swear-in-title" className="flex flex-col gap-3.5 border border-ink bg-paper-raised p-5">
            <h2 id="clerk-swear-in-title" className="m-0 font-serif text-[24px] font-bold text-ink">
                {t("clerk.swearIn.title")}
            </h2>
            <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3.5">
                <TextField
                    label={t("clerk.swearIn.email")}
                    hint={t("clerk.swearIn.emailHint")}
                    error={emailError}
                    type="email"
                    autoComplete="off"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                    label={t("clerk.swearIn.displayName")}
                    hint={t("clerk.swearIn.displayNameHint")}
                    maxLength={100}
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                />
                <TextField
                    label={t("clerk.swearIn.team")}
                    hint={t("clerk.swearIn.teamHint")}
                    maxLength={100}
                    value={team}
                    onChange={(event) => setTeam(event.target.value)}
                />
                <RadioField<JurorRole>
                    legend={t("clerk.swearIn.role")}
                    name="swear-in-role"
                    value={role}
                    onChange={setRole}
                    options={JUROR_ROLES.map((value) => ({
                        value,
                        label: t(`roles.${value}.label`),
                        description: t(`roles.${value}.description`),
                    }))}
                />
                <ClerkError view={clerk.error} />
                <Button type="submit" variant="primary" disabled={clerk.pending}>
                    {clerk.pending ? t("clerk.swearIn.submitting") : t("clerk.swearIn.submit")}
                </Button>
            </form>
        </section>
    );
}
