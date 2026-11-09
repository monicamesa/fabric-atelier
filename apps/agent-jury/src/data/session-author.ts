import type { AppRayfinClient } from "@/lib/rayfin-client";

export interface SessionAuthor {
    userId: string;
    email: string;
}

export class NotSignedInError extends Error {
    constructor() {
        super("No signed-in user.");
        this.name = "NotSignedInError";
    }
}

/** Authorship always comes from the session; insert policies reject anything else (R1). */
export function getSessionAuthor(client: Pick<AppRayfinClient, "auth">): SessionAuthor {
    const session = client.auth.getSession();
    if (!session.isAuthenticated || !session.user?.id || !session.user.email) {
        throw new NotSignedInError();
    }
    return { userId: session.user.id, email: session.user.email };
}
