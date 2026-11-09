import type { JurorRow } from "@/data/directory.service";
import { emailLocalPart, jurorLabel } from "@/lib/people";
import { findActiveJuror, normalizeEmail, type Me } from "@/rules/case-validity";

/** Who is looking at the docket and what they may do (D2: only active jurors act). */
export interface Viewer {
    me?: Me;
    juror?: JurorRow;
    canAct: boolean;
    isAdmin: boolean;
}

interface SessionLike {
    isAuthenticated: boolean;
    user?: { id?: string; email?: string } | null;
}

export function viewerFor(session: SessionLike, jurors: readonly JurorRow[] | undefined): Viewer {
    const id = session.user?.id;
    const email = session.user?.email;
    const me = session.isAuthenticated && id && email ? { userId: id, email } : undefined;
    const juror = me && jurors ? (findActiveJuror(jurors, me.email) as JurorRow | undefined) : undefined;
    return { me, juror, canAct: Boolean(juror), isAdmin: juror?.role === "admin" };
}

/** A person's visible name: the juror's display name, else the part of the email before the @. */
export function personName(email: string, jurors: readonly JurorRow[]): string {
    const juror = jurors.find((row) => normalizeEmail(row.email) === normalizeEmail(email));
    return juror ? jurorLabel(juror) : emailLocalPart(email);
}

export function personTeam(email: string, jurors: readonly JurorRow[]): string | undefined {
    return jurors.find((row) => normalizeEmail(row.email) === normalizeEmail(email))?.team?.trim() || undefined;
}

/** Answers are lettered A, B, C… in the order they were given. */
export function answerLetter(index: number): string {
    return index < 26 ? String.fromCharCode(65 + index) : String(index + 1);
}
