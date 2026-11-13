// Static check for the real evaluate_agent notebook. The notebook runs as the app owner, who could do anything in the app
// database, so the code itself is limited: it only reads Hearings and HearingCases, and only inserts into Verdicts,
// HearingEvents and VerdictTraces. No DDL, no UPDATE or DELETE, no scratch tables, no other tables, one statement per call.
// Rayfin pluralizes table names (Verdict -> dbo.Verdicts).

export const ALLOWED_READ_TABLES = ["Hearings", "HearingCases"];
export const ALLOWED_WRITE_TABLES = ["Verdicts", "HearingEvents", "VerdictTraces"];

const FORBIDDEN_PYTHON = [
    [/\.to_sql\s*\(/, "DataFrame.to_sql writes tables"],
    [/\.write\s*\.\s*(?:mode|format|save|saveAsTable|jdbc|option)\b/, "Spark writers are not allowed"],
    [/\bexecutescript\s*\(/, "executescript runs unchecked SQL"],
    [/\bnotebookutils\.data\./, "notebookutils.data connections bypass this check"],
    [/\bsempy\b[\s\S]{0,40}\b(?:write|to_lakehouse)/, "semantic link writers are not allowed"],
];

const SQL_START = /^\s*(select|insert|update|delete|merge|create|alter|drop|truncate|exec|execute|grant|revoke|with|declare|set|use|backup|bulk|dbcc|openrowset)\b/i;
const SQL_HINT = /\b(?:from|into)\s+\[?dbo\]?\s*\./i;
const STRING_LITERAL = /(?:[rRfFbBuU]{0,2})("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/g;
const TABLE = String.raw`(?:\[?dbo\]?\s*\.\s*)?\[?(\w+)\]?`;

function stripCommentLines(source) {
    return source
        .split(/\r?\n/)
        .map((line) => (/^\s*#/.test(line) ? "" : line))
        .join("\n");
}

function literals(source) {
    return [...stripCommentLines(source).matchAll(STRING_LITERAL)].map((match) => {
        const raw = match[1];
        return raw.startsWith('"""') || raw.startsWith("'''") ? raw.slice(3, -3) : raw.slice(1, -1);
    });
}

function tablesAfter(keyword, text) {
    return [...text.matchAll(new RegExp(String.raw`\b${keyword}\s+${TABLE}`, "gi"))].map((m) => m[1]);
}

function checkStatement(statement) {
    const problems = [];
    const verb = statement.trim().split(/\s+/)[0].toLowerCase();
    const known = (list, name) => list.some((allowed) => allowed.toLowerCase() === name.toLowerCase());
    if (verb === "select" || verb === "with") {
        if (/\binto\b/i.test(statement)) problems.push("SELECT INTO creates a table");
        const sources = [...tablesAfter("from", statement), ...tablesAfter("join", statement)];
        if (sources.length === 0) problems.push("a read must name its table (Hearings or HearingCases)");
        for (const name of sources) {
            if (!known(ALLOWED_READ_TABLES, name)) problems.push(`reads table ${name}; only ${ALLOWED_READ_TABLES.join(", ")} are allowed`);
        }
    } else if (verb === "insert") {
        const target = statement.match(new RegExp(String.raw`^\s*insert\s+(?:into\s+)?${TABLE}`, "i"));
        if (!target || !known(ALLOWED_WRITE_TABLES, target[1])) {
            problems.push(`inserts into ${target?.[1] ?? "an unknown table"}; only ${ALLOWED_WRITE_TABLES.join(", ")} are allowed`);
        }
        for (const name of tablesAfter("from", statement)) {
            if (!known(ALLOWED_READ_TABLES, name)) problems.push(`INSERT ... SELECT reads table ${name}`);
        }
    } else {
        problems.push(`${verb.toUpperCase()} is not allowed`);
    }
    return problems;
}

/** Returns a list of { rule, snippet } violations; an empty list means the notebook source is within policy. */
export function checkNotebookSql(source) {
    const violations = [];
    for (const [pattern, rule] of FORBIDDEN_PYTHON) {
        const match = stripCommentLines(source).match(pattern);
        if (match) violations.push({ rule, snippet: match[0].slice(0, 80) });
    }
    for (const text of literals(source)) {
        if (!SQL_START.test(text) && !SQL_HINT.test(text)) continue;
        const statements = text.split(";").map((part) => part.trim()).filter(Boolean);
        if (statements.length > 1) violations.push({ rule: "one statement per call", snippet: text.trim().slice(0, 80) });
        for (const statement of statements) {
            for (const rule of checkStatement(statement)) violations.push({ rule, snippet: statement.slice(0, 80) });
        }
    }
    return violations;
}
