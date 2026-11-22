"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Download,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { ConfirmActionDialog } from "@/features/quiz/components/confirm-action-dialog";

import { unwrap } from "@/lib/app-error";
import { batchOptions } from "@/lib/batches";
import { cn } from "@/lib/utils";

import { parseCsv, parseRosterJson } from "../lib/csv-parse";
import {
  type ImportResult,
  type RosterRow,
  createStudent,
  deleteBatch,
  deleteStudent,
  exportRosterCsv,
  importStudents,
  listRoster,
  listRosterGroups,
  updateStudent,
} from "../lib/roster-actions";
import { SectionCard, downloadCsv } from "./poll-ui";

export function RosterManager({
  canWrite,
  canExport,
}: {
  canWrite: boolean;
  canExport: boolean;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [batch, setBatch] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<RosterRow | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    | { type: "student"; row: RosterRow }
    | { type: "batch"; batch: string; count: number }
    | { type: "export" }
    | null
  >(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: groups = [] } = useQuery({
    queryKey: ["roster", "groups"],
    queryFn: async () => unwrap(await listRosterGroups()),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["roster", "list", debounced, batch, page],
    queryFn: async () =>
      unwrap(
        await listRoster({
          query: debounced || undefined,
          batch: batch ?? undefined,
          page,
        }),
      ),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["roster"] });

  const remove = useMutation({
    mutationFn: async () => {
      if (confirm?.type === "student")
        return unwrap(await deleteStudent(confirm.row.id));
      if (confirm?.type === "batch")
        return unwrap(await deleteBatch(confirm.batch));
      return null;
    },
    onSuccess: () => {
      toast.success("Removed from roster");
      setConfirm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCsv = useMutation({
    mutationFn: async () => unwrap(await exportRosterCsv(batch)),
    onSuccess: ({ filename, csv }) => {
      downloadCsv(filename, csv);
      setConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batches = [...new Set(groups.map((g) => g.batch))].map((b) => ({
    batch: b,
    count: groups.filter((g) => g.batch === b).reduce((s, g) => s + g.count, 0),
    sections: groups.filter((g) => g.batch === b),
  }));
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;

  return (
    <div className="mx-auto mt-6 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/polls">
          <ArrowLeft className="size-4" /> Polls
        </Link>
      </Button>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Student roster
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Decides which students each poll reaches. Visible only to faculty
            and coordinators.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm({ type: "export" })}
            >
              <Download className="size-4" /> Export{batch ? ` ${batch}` : ""}
            </Button>
          )}
          {canWrite && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="size-4" /> Import CSV / JSON
              </Button>
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus className="size-4" /> Add student
              </Button>
            </>
          )}
        </div>
      </header>

      <p className="bg-sun-soft/50 flex items-start gap-2 rounded-[1.25rem] border p-3 text-xs">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        This is students&apos; personal data. Never paste it into chats, commit
        it to GitHub, or share exports publicly. Every import, edit, deletion
        and export is recorded in the audit log.
      </p>

      {batches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBatch(null);
              setPage(1);
            }}
            className={cn(
              "peeerly-chip border px-3 py-1.5 text-xs",
              !batch ? "bg-sky-soft border-sky" : "bg-card",
            )}
          >
            All batches
          </button>
          {batches.map((b) => (
            <span
              key={b.batch}
              className={cn(
                "peeerly-chip border py-1 pr-1 pl-3 text-xs",
                batch === b.batch ? "bg-sky-soft border-sky" : "bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setBatch(b.batch);
                  setPage(1);
                }}
              >
                {b.batch} · {b.count} (
                {b.sections.map((s) => `${s.section}: ${s.count}`).join(", ")})
              </button>
              {canWrite && (
                <button
                  type="button"
                  aria-label={`Delete batch ${b.batch}`}
                  title="Delete this batch (e.g. after graduation)"
                  className="hover:bg-muted rounded-full p-1"
                  onClick={() =>
                    setConfirm({
                      type: "batch",
                      batch: b.batch,
                      count: b.count,
                    })
                  }
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <SectionCard
        title={`Students (${data?.total ?? 0})`}
        action={
          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or USN"
              className="pl-9"
              aria-label="Search roster"
            />
          </div>
        }
      >
        {isLoading ? (
          <Spinner className="size-5" />
        ) : !data || data.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {debounced || batch
              ? "No matching students."
              : canWrite
                ? "The roster is empty. Import a CSV with columns name, usn, email, batch, section."
                : "The roster is empty."}
          </p>
        ) : (
          <>
            <div className="-mx-4 overflow-x-auto sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>USN</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Section</TableHead>
                    {canWrite && <TableHead className="w-24" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-semibold tabular-nums">
                        {r.usn}
                      </TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.email}
                      </TableCell>
                      <TableCell>{r.batch}</TableCell>
                      <TableCell>{r.section}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Edit ${r.usn}`}
                            onClick={() => setEditing(r)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete ${r.usn}`}
                            onClick={() =>
                              setConfirm({ type: "student", row: r })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {canWrite && (
        <StudentDialog
          student={editing === "new" ? null : editing}
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}
      {canWrite && (
        <ImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={invalidate}
        />
      )}

      <ConfirmActionDialog
        open={confirm?.type === "student" || confirm?.type === "batch"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.type === "batch"
            ? `Delete batch ${confirm.batch}?`
            : "Remove this student?"
        }
        description={
          confirm?.type === "batch"
            ? `Removes all ${confirm.count} students of ${confirm.batch} from the roster and from poll audiences. Past responses keep the details recorded when they were submitted.`
            : "They'll be removed from the roster and any custom poll audiences. Past responses are kept."
        }
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
      <ConfirmActionDialog
        open={confirm?.type === "export"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Export roster?"
        description="The file contains names, USNs and emails. Keep it private, never commit or share it publicly, and delete it when done. This export is recorded in the audit log."
        confirmLabel="Download CSV"
        loading={exportCsv.isPending}
        onConfirm={() => exportCsv.mutate()}
      />
    </div>
  );
}

function StudentDialog({
  student,
  open,
  onOpenChange,
  onSaved,
}: {
  student: RosterRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{student ? "Edit student" : "Add student"}</DialogTitle>
        </DialogHeader>
        {/* Content unmounts on close, so each open starts from fresh state. */}
        <StudentForm
          key={student?.id ?? "new"}
          student={student}
          onCancel={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function StudentForm({
  student,
  onCancel,
  onSaved,
}: {
  student: RosterRow | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() =>
    student
      ? {
          name: student.name,
          usn: student.usn,
          email: student.email,
          batch: student.batch,
          section: student.section,
        }
      : {
          name: "",
          usn: "",
          email: "",
          batch: batchOptions[1] as string,
          section: "",
        },
  );

  const save = useMutation({
    mutationFn: async () =>
      student
        ? unwrap(await updateStudent({ id: student.id, data: form }))
        : unwrap(await createStudent(form)),
    onSuccess: () => {
      toast.success(student ? "Student updated" : "Student added");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (
    key: keyof typeof form,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`student-${key}`}>{label}</Label>
      <Input
        id={`student-${key}`}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        required
        {...props}
      />
    </div>
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {field("name", "Name", { maxLength: 120 })}
      <div className="grid grid-cols-2 gap-3">
        {field("usn", "USN", { maxLength: 20 })}
        {field("section", "Section", { maxLength: 5 })}
      </div>
      {field("email", "College email", { type: "email", maxLength: 200 })}
      {field("batch", "Batch", {
        placeholder: "2025-27",
        list: "roster-batches",
      })}
      <datalist id="roster-batches">
        {batchOptions.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner className="size-4" />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setRows(null);
    setFileName("");
    setParseError(null);
    setResult(null);
  };

  const run = useMutation({
    mutationFn: async () => unwrap(await importStudents({ rows: rows ?? [] })),
    onSuccess: (r) => {
      setResult(r);
      setRows(null);
      onImported();
      toast.success(`Imported: ${r.created} added, ${r.updated} updated`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setParseError("File is larger than 2 MB.");
      return;
    }
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = file.name.toLowerCase().endsWith(".json")
        ? parseRosterJson(text)
        : parseCsv(text);
      if (parsed.length === 0)
        throw new Error("No rows found. The first line must be the header.");
      if (parsed.length > 3000)
        throw new Error("Import at most 3000 students at a time.");
      setRows(parsed);
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : "Couldn't read that file.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>
            CSV with header <code>name,usn,email,batch,section</code>, or JSON.
            Existing USNs are updated. The file is read in your browser and
            never stored — only the rows are saved.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={(e) => onFile(e.target.files?.[0])}
            aria-label="Roster file"
          />
          {parseError && (
            <p className="text-destructive text-sm">{parseError}</p>
          )}
          {rows && (
            <p className="text-sm">
              <strong>{rows.length}</strong> rows found in {fileName}. Ready to
              import.
            </p>
          )}
          {result && (
            <div className="rounded-2xl border p-3 text-sm">
              <p>
                <strong>{result.created}</strong> added ·{" "}
                <strong>{result.updated}</strong> updated ·{" "}
                <strong>{result.skipped.length}</strong> skipped
              </p>
              {result.skipped.length > 0 && (
                <ul className="text-muted-foreground mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                  {result.skipped.map((s, i) => (
                    <li key={i}>
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result && (
            <Button
              disabled={!rows || run.isPending}
              onClick={() => run.mutate()}
            >
              {run.isPending && <Spinner className="size-4" />}
              Import
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
