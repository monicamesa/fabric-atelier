/** Saves text as a file through the browser: nothing is uploaded and nothing is stored. */
export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
