"use client";

import { useCallback, useState } from "react";

import { ImageIcon, Loader2, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { CompanyLogoImage } from "./company-logo-image";

/**
 * Square company-logo dropzone. Sits beside the company name in the form and
 * previews the uploaded logo at the same size the cards render it.
 */
export function LogoUpload({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string>();

  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/experiences/v1/uploads/logo", {
          method: "POST",
          body: formData,
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(data?.error?.message ?? "Upload failed.");
          return;
        }

        if (data.url) onChange(data.url);
      } catch {
        toast.error("Upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    },
    [onChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "image/svg+xml": [".svg"],
    },
    maxFiles: 1,
    disabled: disabled || uploading,
  });

  if (value) {
    return (
      <div className="group relative h-16 w-16 shrink-0">
        <div className="border-border/60 relative size-full overflow-hidden rounded-xl border bg-zinc-50 dark:bg-zinc-100">
          {value === failedUrl ? (
            <div
              className="flex size-full items-center justify-center text-zinc-400"
              title="This logo couldn't be loaded"
            >
              <ImageIcon className="h-5 w-5" />
            </div>
          ) : (
            <CompanyLogoImage
              src={value}
              alt="Company logo"
              sizes="64px"
              onError={() => setFailedUrl(value)}
            />
          )}
        </div>
        {/* Outside the tile so it doesn't cover the logo; touch screens have no hover. */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="bg-background/90 absolute -top-2 -right-2 h-6 w-6 border opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
          onClick={() => onChange(null)}
          disabled={disabled}
          aria-label="Remove logo"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={`flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors ${
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      } ${disabled || uploading ? "pointer-events-none opacity-60" : ""}`}
      title="Upload company logo"
    >
      <input {...getInputProps()} />
      {uploading ? (
        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
      ) : (
        <>
          <ImageIcon className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground mt-1 text-[10px]">Logo</span>
        </>
      )}
    </div>
  );
}
