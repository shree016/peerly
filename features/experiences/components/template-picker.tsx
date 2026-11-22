"use client";

import { useState } from "react";

import {
  BadgeCheck,
  Check,
  ChevronsUpDown,
  LayoutTemplate,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { ExperienceTemplate } from "../lib/types";
import { CompanyAvatar } from "./company-avatar";

export function TemplatePicker({
  templates,
  selectedKey,
  onSelect,
  onClear,
  disabled,
}: {
  templates: ExperienceTemplate[];
  selectedKey: string | null;
  onSelect: (template: ExperienceTemplate) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  const official = templates.filter((t) => t.source === "official");
  const community = templates.filter((t) => t.source !== "official");

  const renderItem = (template: ExperienceTemplate) => (
    <CommandItem
      key={template.key}
      value={`${template.companyName} ${template.role} ${template.batch}`}
      onSelect={() => {
        onSelect(template);
        setOpen(false);
      }}
    >
      <CompanyAvatar
        companyName={template.companyName}
        logoUrl={template.companyLogoUrl}
        size="h-7 w-7"
        className="rounded-md text-xs"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-sm font-medium">
          <span className="truncate">{template.companyName}</span>
          {template.source === "official" && (
            <BadgeCheck
              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
              aria-label="Official template"
            />
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {template.role} · {template.batch}
          {template.ctcLpa != null && ` · ${template.ctcLpa} LPA`}
          {template.postCount > 0 &&
            ` · ${template.postCount} ${template.postCount === 1 ? "post" : "posts"}`}
        </p>
      </div>
      <Check
        className={`h-4 w-4 shrink-0 ${
          selectedKey === template.key ? "opacity-100" : "opacity-0"
        }`}
      />
    </CommandItem>
  );

  return (
    <div className="bg-muted/40 space-y-3 rounded-lg border border-dashed p-4">
      <div className="flex items-start gap-2">
        <LayoutTemplate className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Start from a template{" "}
            <span className="normal-case">(optional)</span>
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Pick your drive to reuse the company, role, batch, CTC, JD and round
            structure — then add your own experience. Templates marked official
            come from the placement cell.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled}
              className="min-w-0 flex-1 justify-between font-normal"
            >
              <span
                className={
                  selected ? "truncate" : "text-muted-foreground truncate"
                }
              >
                {selected
                  ? `${selected.companyName} · ${selected.role} · ${selected.batch}`
                  : "Search company or role..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] min-w-[280px] p-0"
            align="start"
          >
            <Command>
              <CommandInput placeholder="Search company or role..." />
              <CommandList>
                <CommandEmpty>No matching drive yet.</CommandEmpty>
                {official.length > 0 && (
                  <CommandGroup heading="Official · placement cell">
                    {official.map(renderItem)}
                  </CommandGroup>
                )}
                {community.length > 0 && (
                  <CommandGroup heading="From students' posts">
                    {community.map(renderItem)}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            disabled={disabled}
            aria-label="Clear template"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
