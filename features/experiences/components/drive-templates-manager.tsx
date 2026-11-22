"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  FileText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

import { ConfirmActionDialog } from "@/features/quiz/components/confirm-action-dialog";

import { unwrap } from "@/lib/app-error";

import { documentTypeFromFileName } from "../lib/experience-form-input";
import {
  type DriveTemplatesOverview,
  deleteDriveTemplate,
  listDriveTemplates,
  saveDriveTemplate,
  setDriveTemplateStatus,
} from "../lib/template-actions";
import type { ExperienceTemplate, ManagedDriveTemplate } from "../lib/types";
import {
  type RoundType,
  difficultyOptions,
  roundTypeLabel,
  roundTypeOptions,
} from "../lib/validation";
import { BatchCombobox } from "./batch-combobox";
import { CompanyAvatar } from "./company-avatar";
import { DocumentUpload, type UploadedDocument } from "./document-upload";
import { LogoUpload } from "./logo-upload";

const QUERY_KEY = ["experiences", "drive-templates"];

type Difficulty = (typeof difficultyOptions)[number];
type EditorRound = {
  id: string;
  roundType: RoundType;
  difficulty: Difficulty | null;
};

/** What the editor dialog opens with: a template to edit, a suggestion to copy, or blank. */
type EditorSeed =
  | { mode: "create"; from?: ExperienceTemplate }
  | { mode: "edit"; template: ManagedDriveTemplate };

export function DriveTemplatesManager({
  initial,
}: {
  initial: DriveTemplatesOverview;
}) {
  const queryClient = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => unwrap(await listDriveTemplates()),
    initialData: initial,
  });

  const [editor, setEditor] = useState<EditorSeed | null>(null);
  const [deleting, setDeleting] = useState<ManagedDriveTemplate | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const status = useMutation({
    mutationFn: async (v: { id: string; status: "active" | "archived" }) =>
      unwrap(await setDriveTemplateStatus(v)),
    onSuccess: (r) => {
      toast.success(
        r.status === "archived" ? "Template archived" : "Template restored",
      );
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => unwrap(await deleteDriveTemplate(id)),
    onSuccess: () => {
      toast.success("Template deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = data.official.filter((t) => t.status === "active");
  const archived = data.official.filter((t) => t.status === "archived");

  return (
    <div className="mx-auto mt-6 mb-12 max-w-6xl space-y-8 px-4 sm:mt-8 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/experiences">
          <ArrowLeft className="size-4" /> Placement experiences
        </Link>
      </Button>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            Drive templates
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Set up each drive once — company, role, batch, CTC, JD and the round
            structure. Students pick it when sharing their experience, so every
            write-up for the drive starts from the same accurate details.
          </p>
        </div>
        <Button
          onClick={() => setEditor({ mode: "create" })}
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" /> New template
        </Button>
      </header>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
          <BadgeCheck className="size-5 text-emerald-600" /> Official templates
          <span className="text-muted-foreground text-sm font-medium">
            ({active.length})
          </span>
        </h2>
        {active.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-[1.5rem] border p-5 text-sm">
            No official templates yet. Create one for an upcoming drive, or make
            one official from the suggestions below.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {active.map((t) => (
              <TemplateCard key={t.templateId} template={t}>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditor({ mode: "edit", template: t })}
                >
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Archive template"
                  title="Archive — hides it from students"
                  disabled={status.isPending}
                  onClick={() =>
                    status.mutate({ id: t.templateId, status: "archived" })
                  }
                >
                  <Archive className="size-4" />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete template"
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TemplateCard>
            ))}
          </div>
        )}
      </section>

      {data.suggestions.length > 0 && (
        <section>
          <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-amber-500" /> Suggested from
            students&apos; posts
            <span className="text-muted-foreground text-sm font-medium">
              ({data.suggestions.length})
            </span>
          </h2>
          <p className="text-muted-foreground mb-3 text-sm">
            Drives students already wrote about. Check the details and make them
            official.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {data.suggestions.map((t) => (
              <TemplateCard key={t.key} template={t}>
                <Button
                  size="sm"
                  onClick={() => setEditor({ mode: "create", from: t })}
                >
                  <BadgeCheck className="size-4" /> Make official
                </Button>
              </TemplateCard>
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <details className="group">
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-sm font-semibold">
            Archived ({archived.length})
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-3 opacity-80 md:grid-cols-2">
            {archived.map((t) => (
              <TemplateCard key={t.templateId} template={t}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={status.isPending}
                  onClick={() =>
                    status.mutate({ id: t.templateId, status: "active" })
                  }
                >
                  <ArchiveRestore className="size-4" /> Restore
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete template"
                  onClick={() => setDeleting(t)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TemplateCard>
            ))}
          </div>
        </details>
      )}

      {editor && (
        <TemplateEditorDialog
          key={
            editor.mode === "edit"
              ? editor.template.templateId
              : (editor.from?.key ?? "new")
          }
          seed={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            invalidate();
          }}
        />
      )}

      <ConfirmActionDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this template?"
        description={`Students won't be able to pick "${deleting?.companyName ?? ""} · ${deleting?.role ?? ""}" any more. Experiences already shared are not affected. To hide it temporarily, archive it instead.`}
        confirmLabel="Delete template"
        destructive
        loading={remove.isPending}
        onConfirm={() => {
          if (deleting) remove.mutate(deleting.templateId);
        }}
      />
    </div>
  );
}

function TemplateCard({
  template,
  children,
}: {
  template: ExperienceTemplate | ManagedDriveTemplate;
  children: React.ReactNode;
}) {
  const managed = "createdByName" in template ? template : null;
  return (
    <div className="peeerly-card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <CompanyAvatar
          companyName={template.companyName}
          logoUrl={template.companyLogoUrl}
          size="h-11 w-11"
          className="shrink-0 rounded-xl text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{template.companyName}</p>
          <p className="text-muted-foreground truncate text-xs">
            {template.role} · {template.batch}
            {template.ctcLpa != null && ` · ${template.ctcLpa} LPA`}
          </p>
        </div>
      </div>
      <ol className="flex flex-wrap gap-1.5">
        {template.rounds.length === 0 ? (
          <li className="text-muted-foreground text-xs">No rounds listed</li>
        ) : (
          template.rounds.map((r, i) => (
            <li
              key={i}
              className="bg-muted rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium"
            >
              {i + 1}. {roundTypeLabel[r.roundType]}
              {r.difficulty && (
                <span className="text-muted-foreground"> · {r.difficulty}</span>
              )}
            </li>
          ))
        )}
      </ol>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {template.jd && (
          <span className="flex items-center gap-1">
            <FileText className="size-3.5" /> JD attached
          </span>
        )}
        <span>
          {template.postCount} {template.postCount === 1 ? "post" : "posts"} so
          far
        </span>
        {managed?.createdByName && <span>By {managed.createdByName}</span>}
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

function toUploadedDocument(
  jd: ExperienceTemplate["jd"],
): UploadedDocument | null {
  if (!jd) return null;
  return {
    url: jd.url,
    type: documentTypeFromFileName(jd.fileName),
    fileName: jd.fileName,
    fileSize: 0,
  };
}

function TemplateEditorDialog({
  seed,
  onClose,
  onSaved,
}: {
  seed: EditorSeed;
  onClose: () => void;
  onSaved: () => void;
}) {
  const source = seed.mode === "edit" ? seed.template : seed.from;
  const [companyName, setCompanyName] = useState(source?.companyName ?? "");
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(
    source?.companyLogoUrl ?? null,
  );
  const [role, setRole] = useState(source?.role ?? "");
  const [batch, setBatch] = useState(source?.batch ?? "");
  const [ctcLpa, setCtcLpa] = useState(
    source?.ctcLpa != null ? String(source.ctcLpa) : "",
  );
  const [jd, setJd] = useState<UploadedDocument | null>(
    toUploadedDocument(source?.jd ?? null),
  );
  const [rounds, setRounds] = useState<EditorRound[]>(() =>
    source?.rounds.length
      ? source.rounds.map((r) => ({
          id: crypto.randomUUID(),
          roundType: r.roundType,
          difficulty: r.difficulty ?? null,
        }))
      : [{ id: crypto.randomUUID(), roundType: "Aptitude", difficulty: null }],
  );

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await saveDriveTemplate({
          id: seed.mode === "edit" ? seed.template.templateId : undefined,
          companyName,
          companyLogoUrl,
          role,
          batch,
          ctcLpa: ctcLpa.trim() === "" ? null : Number(ctcLpa),
          jd: jd ? { url: jd.url, fileName: jd.fileName } : null,
          rounds: rounds.map((r) => ({
            roundType: r.roundType,
            difficulty: r.difficulty,
          })),
        }),
      ),
    onSuccess: () => {
      toast.success(
        seed.mode === "edit"
          ? "Template updated"
          : "Template published for students",
      );
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRound = (id: string, patch: Partial<EditorRound>) =>
    setRounds((list) =>
      list.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  const moveRound = (index: number, delta: -1 | 1) =>
    setRounds((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const busy = save.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {seed.mode === "edit"
              ? "Edit drive template"
              : "New drive template"}
          </DialogTitle>
          <DialogDescription>
            {seed.mode === "create" && seed.from
              ? "Pre-filled from students' posts — check every detail before publishing."
              : "Students see this as an official template when sharing their experience."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <LogoUpload
              value={companyLogoUrl}
              onChange={setCompanyLogoUrl}
              disabled={busy}
            />
            <div className="space-y-1.5">
              <Label htmlFor="tpl-company">Company</Label>
              <Input
                id="tpl-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                maxLength={100}
                placeholder="e.g. Infosys"
                required
                disabled={busy}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="tpl-role">Role</Label>
              <Input
                id="tpl-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                maxLength={100}
                placeholder="e.g. Systems Engineer"
                required
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <BatchCombobox
                value={batch}
                onChange={setBatch}
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-ctc">CTC (LPA, optional)</Label>
              <Input
                id="tpl-ctc"
                type="number"
                min={0}
                max={200}
                step="0.1"
                value={ctcLpa}
                onChange={(e) => setCtcLpa(e.target.value)}
                placeholder="e.g. 6.5"
                disabled={busy}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Job description (optional)</Label>
            <DocumentUpload
              value={jd}
              onChange={setJd}
              disabled={busy}
              compact
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rounds, in order</Label>
              <span className="text-muted-foreground text-xs">
                {rounds.length} / 15
              </span>
            </div>
            <ol className="space-y-2">
              {rounds.map((r, i) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-2xl border p-2 sm:flex-nowrap"
                >
                  <span className="text-muted-foreground w-5 text-center text-sm tabular-nums">
                    {i + 1}
                  </span>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_11.5rem]">
                    <Select
                      value={r.roundType}
                      onValueChange={(v) =>
                        updateRound(r.id, { roundType: v as RoundType })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Round ${i + 1} type`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roundTypeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {roundTypeLabel[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={r.difficulty ?? "unset"}
                      onValueChange={(v) =>
                        updateRound(r.id, {
                          difficulty: v === "unset" ? null : (v as Difficulty),
                        })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-label={`Round ${i + 1} difficulty`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unset">
                          Difficulty not set
                        </SelectItem>
                        {difficultyOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex w-full shrink-0 justify-end sm:w-auto">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move round up"
                      disabled={busy || i === 0}
                      onClick={() => moveRound(i, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Move round down"
                      disabled={busy || i === rounds.length - 1}
                      onClick={() => moveRound(i, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Remove round"
                      disabled={busy || rounds.length <= 1}
                      onClick={() =>
                        setRounds((list) => list.filter((x) => x.id !== r.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || rounds.length >= 15}
              onClick={() =>
                setRounds((list) => [
                  ...list,
                  {
                    id: crypto.randomUUID(),
                    roundType: "Technical",
                    difficulty: null,
                  },
                ])
              }
            >
              <Plus className="size-4" /> Add round
            </Button>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !batch}>
              {busy && <Spinner className="size-4" />}
              {seed.mode === "edit" ? "Save changes" : "Publish template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
