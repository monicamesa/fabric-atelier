// Which deployment a script talks to. Deployed checks default to the test deployment (rayfin/.env.test)
// and refuse the production item unless --allow-production is passed. Prints no ids or URLs.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export const appRoot = resolve(import.meta.dirname, "..", "..");
export const privateValuesPath = resolve(appRoot, "..", "..", ".private", "values.env");
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readEnvFile(path) {
    const values = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
}

export function loadPrivateValues() {
    return readEnvFile(privateValuesPath);
}

/**
 * --target=test (default) reads rayfin/.env.test; --target=production reads rayfin/.env and also needs
 * --allow-production. A test env file that points at the production item is refused too.
 */
export function resolveTarget(argv = process.argv) {
    const target = (argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length) ?? "test").toLowerCase();
    const allowProduction = argv.includes("--allow-production");
    if (target !== "test" && target !== "production") {
        throw new Error("--target must be test or production.");
    }
    const values = loadPrivateValues();
    const envPath = resolve(appRoot, "rayfin", target === "test" ? ".env.test" : ".env");
    if (!existsSync(envPath)) {
        throw new Error(`Missing rayfin/${target === "test" ? ".env.test" : ".env"}. For the test deployment run: node scripts/deploy-test.mjs`);
    }
    const env = readEnvFile(envPath);
    const baseUrl = env.RAYFIN_PUBLIC_API_URL;
    const publishableKey = env.RAYFIN_PUBLIC_PUBLISHABLE_KEY;
    if (!GUID.test(values.TENANT_ID ?? "") || !baseUrl?.startsWith("https://") || !publishableKey) {
        throw new Error("Missing TENANT_ID in .private/values.env or the deployment values in the env file.");
    }
    const productionItem = values.APP_BACKEND_ID_AGENT_JURY?.toLowerCase();
    const pointsAtProduction = Boolean(productionItem) && baseUrl.toLowerCase().includes(productionItem);
    if (!productionItem) {
        throw new Error("APP_BACKEND_ID_AGENT_JURY is missing in .private/values.env; it is needed to recognise production.");
    }
    if (pointsAtProduction && !(target === "production" && allowProduction)) {
        throw new Error("Refusing to run against the production item. Use the test deployment, or pass --target=production --allow-production.");
    }
    return { target, baseUrl, publishableKey, tenantId: values.TENANT_ID, values };
}
