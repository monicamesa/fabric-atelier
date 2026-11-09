/** The part of an email before the @; used wherever a full email must not be shown. */
export function emailLocalPart(email: string): string {
    const at = email.indexOf("@");
    return at > 0 ? email.slice(0, at) : email;
}

/** A juror's visible name: the display name, or the email's local part when it is empty. */
export function jurorLabel(juror: { email: string; displayName?: string | null }): string {
    const name = juror.displayName?.trim();
    return name ? name : emailLocalPart(juror.email);
}

/** Up to two initials for an avatar, from words or from dot/dash/underscore-separated parts. */
export function initials(label: string): string {
    const parts = label.split(/[\s._-]+/).filter(Boolean);
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : label.slice(0, 2);
    return letters.toUpperCase();
}

/** First 4 and last 4 characters of an id, for display next to a copy button. */
export function shortId(id: string): string {
    return id.length <= 9 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`;
}
