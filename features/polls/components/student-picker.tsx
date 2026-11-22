"use client";

import { useEffect, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

import type { StudentLite } from "../lib/types";

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/**
 * Search-as-you-type roster picker. `search` must be a permission-checked
 * server action (min 2 chars, small result sets) — the full roster is never
 * shipped to the browser.
 */
export function StudentPicker({
  value,
  onChange,
  search,
  placeholder = "Search by name or USN",
  queryKeyPrefix,
}: {
  value: StudentLite[];
  onChange: (students: StudentLite[]) => void;
  /** e.g. `async (q) => unwrap(await searchRosterStudents(q))` */
  search: (query: string) => Promise<StudentLite[]>;
  placeholder?: string;
  queryKeyPrefix: string;
}) {
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim());
  const { data: results = [], isFetching } = useQuery({
    queryKey: ["roster-search", queryKeyPrefix, debounced],
    queryFn: () => search(debounced),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const selectedIds = new Set(value.map((s) => s.id));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((s) => (
            <li
              key={s.id}
              className="bg-sky-soft/70 flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span className="font-semibold">{s.usn}</span>
              <span className="text-muted-foreground max-w-32 truncate">
                {s.name}
              </span>
              <button
                type="button"
                aria-label={`Remove ${s.usn}`}
                className="hover:bg-muted rounded-full p-0.5"
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label={placeholder}
        />
      </div>
      {debounced.length >= 2 && (
        <ul className="max-h-56 overflow-y-auto rounded-2xl border">
          {isFetching && results.length === 0 ? (
            <li className="text-muted-foreground p-3 text-sm">Searching…</li>
          ) : results.length === 0 ? (
            <li className="text-muted-foreground p-3 text-sm">
              No matching students.
            </li>
          ) : (
            results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={selectedIds.has(s.id)}
                  onClick={() => onChange([...value, s])}
                  className="hover:bg-muted flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm disabled:opacity-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{s.usn}</span> · {s.name}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {s.batch} · {s.section}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
