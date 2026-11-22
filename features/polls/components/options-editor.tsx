"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

import { unwrap } from "@/lib/app-error";
import { cn } from "@/lib/utils";

import {
  addOption,
  deleteOption,
  moveOption,
  updateOption,
} from "../lib/manage-actions";
import type { ManagerPollDTO, OptionDTO } from "../lib/types";
import { SectionCard } from "./poll-ui";

export function OptionsEditor({ poll }: { poll: ManagerPollDTO }) {
  const queryClient = useQueryClient();
  const isSeatLock = poll.kind === "seatlock";
  const fixed = poll.questionType === "yes_no";
  const locked =
    poll.status === "closed" ||
    (poll.kind === "quick" && poll.responseCount > 0);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["polls"] });
  const onError = (e: Error) => toast.error(e.message);

  const move = useMutation({
    mutationFn: async (v: { optionId: string; direction: "up" | "down" }) =>
      unwrap(await moveOption({ pollId: poll.id, ...v })),
    onSuccess: invalidate,
    onError,
  });
  const archive = useMutation({
    mutationFn: async (v: {
      optionId: string;
      status: "active" | "archived";
    }) => unwrap(await updateOption({ pollId: poll.id, ...v })),
    onSuccess: invalidate,
    onError,
  });
  const remove = useMutation({
    mutationFn: async (optionId: string) =>
      unwrap(await deleteOption({ pollId: poll.id, optionId })),
    onSuccess: () => {
      toast.success("Option removed");
      invalidate();
    },
    onError,
  });

  const totalSeats = poll.options
    .filter((o) => o.status === "active")
    .reduce((s, o) => s + (o.capacity ?? 0), 0);
  const seatsTaken = poll.options.reduce((s, o) => s + o.seatsTaken, 0);

  return (
    <SectionCard
      title="Options"
      description={
        locked
          ? poll.status === "closed"
            ? "This poll is closed, so options can't change."
            : "Options are locked because people have started voting."
          : fixed
            ? "Yes / No polls have fixed options."
            : isSeatLock
              ? `${seatsTaken} of ${totalSeats} seats locked. Seats can be raised any time, but never below what's already locked.`
              : undefined
      }
    >
      <ul className="space-y-2">
        {poll.options.map((o, i) => (
          <OptionRow
            key={o.id}
            poll={poll}
            option={o}
            first={i === 0}
            last={i === poll.options.length - 1}
            locked={locked || fixed}
            busy={move.isPending || archive.isPending || remove.isPending}
            onMove={(direction) => move.mutate({ optionId: o.id, direction })}
            onArchive={() =>
              archive.mutate({
                optionId: o.id,
                status: o.status === "archived" ? "active" : "archived",
              })
            }
            onDelete={() => remove.mutate(o.id)}
          />
        ))}
      </ul>
      {!locked && !fixed && <AddOptionForm poll={poll} />}
    </SectionCard>
  );
}

function OptionRow({
  poll,
  option,
  first,
  last,
  locked,
  busy,
  onMove,
  onArchive,
  onDelete,
}: {
  poll: ManagerPollDTO;
  option: OptionDTO;
  first: boolean;
  last: boolean;
  locked: boolean;
  busy: boolean;
  onMove: (direction: "up" | "down") => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const isSeatLock = poll.kind === "seatlock";
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(option.label);
  const [description, setDescription] = useState(option.description ?? "");
  const [capacity, setCapacity] = useState(String(option.capacity ?? ""));
  // SeatLock options stay editable (typo fixes, more seats) until close.
  const canEdit = isSeatLock ? poll.status !== "closed" : !locked;

  const save = useMutation({
    mutationFn: async () =>
      unwrap(
        await updateOption({
          pollId: poll.id,
          optionId: option.id,
          label,
          description: description || null,
          ...(isSeatLock ? { capacity: Number(capacity) } : {}),
        }),
      ),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archived = option.status === "archived";

  if (editing) {
    return (
      <li className="rounded-2xl border p-3">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={120}
            aria-label="Option label"
            required
          />
          {isSeatLock ? (
            <Input
              type="number"
              min={Math.max(1, option.seatsTaken)}
              max={10000}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              aria-label="Seats"
              required
            />
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending && <Spinner className="size-4" />} Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </div>
          {isSeatLock && (
            <Input
              className="sm:col-span-3"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={300}
              placeholder="Short description (optional)"
              aria-label="Option description"
            />
          )}
        </form>
      </li>
    );
  }

  const fill = option.capacity
    ? Math.round((option.seatsTaken / option.capacity) * 100)
    : 0;

  return (
    <li
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3",
        archived && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {option.label}
          {archived && (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              (archived)
            </span>
          )}
        </p>
        {option.description && (
          <p className="text-muted-foreground truncate text-xs">
            {option.description}
          </p>
        )}
        {isSeatLock && option.capacity !== null && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="bg-sky h-full rounded-full"
                style={{ width: `${fill}%` }}
              />
            </div>
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {option.seatsTaken}/{option.capacity}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {(!locked || isSeatLock) && poll.status !== "closed" && (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Move up"
              disabled={first || busy}
              onClick={() => onMove("up")}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Move down"
              disabled={last || busy}
              onClick={() => onMove("down")}
            >
              <ArrowDown className="size-4" />
            </Button>
          </>
        )}
        {canEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Edit option"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-4" />
          </Button>
        )}
        {canEdit && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={archived ? "Restore option" : "Archive option"}
            title={
              archived
                ? "Restore"
                : "Archive — hides it from students, keeps existing responses"
            }
            disabled={busy}
            onClick={onArchive}
          >
            {archived ? (
              <ArchiveRestore className="size-4" />
            ) : (
              <Archive className="size-4" />
            )}
          </Button>
        )}
        {!locked && (option.seatsTaken === 0 || !isSeatLock) && (
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete option"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

function AddOptionForm({ poll }: { poll: ManagerPollDTO }) {
  const queryClient = useQueryClient();
  const isSeatLock = poll.kind === "seatlock";
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("");

  const add = useMutation({
    mutationFn: async () =>
      unwrap(
        await addOption({
          pollId: poll.id,
          label,
          capacity: isSeatLock ? Number(capacity) || null : null,
        }),
      ),
    onSuccess: () => {
      setLabel("");
      setCapacity("");
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="mt-3 flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="New option"
        maxLength={120}
        aria-label="New option label"
        required
      />
      {isSeatLock && (
        <Input
          type="number"
          min={1}
          max={10000}
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          placeholder="Seats"
          aria-label="Seats for new option"
          className="sm:w-28"
          required
        />
      )}
      <Button type="submit" variant="outline" disabled={add.isPending}>
        {add.isPending ? (
          <Spinner className="size-4" />
        ) : (
          <Plus className="size-4" />
        )}{" "}
        Add
      </Button>
    </form>
  );
}
