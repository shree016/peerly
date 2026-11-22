/**
 * Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF) that
 * returns header-keyed rows. Runs in the browser so uploaded roster files
 * are never stored anywhere — only the parsed rows are sent to the server.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length < 2) return [];
  const header = nonEmpty[0].map((h) => h.trim().toLowerCase());
  return nonEmpty
    .slice(1)
    .map((cells) =>
      Object.fromEntries(header.map((h, i) => [h, (cells[i] ?? "").trim()])),
    );
}

/** Accepts `[{...}]` or `{ students: [{...}], batch?: "2025-27" }`. */
export function parseRosterJson(text: string): Record<string, unknown>[] {
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { students?: unknown }).students)
  ) {
    const { students, batch } = data as {
      students: Record<string, unknown>[];
      batch?: string;
    };
    return students.map((s) => (batch && !s.batch ? { ...s, batch } : s));
  }
  throw new Error("Expected an array of students or { students: [...] }.");
}
