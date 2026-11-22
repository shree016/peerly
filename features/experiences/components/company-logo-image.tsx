"use client";

import { useState } from "react";

import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Fits any logo into a square or round tile (the parent must be `relative`).
 * A roughly square logo fills the tile edge to edge; a wordmark or tall logo is
 * shown whole, inset far enough that a round tile can't cut off its ends.
 */
export function CompanyLogoImage({
  src,
  alt,
  sizes,
  onError,
}: {
  src: string;
  alt: string;
  sizes: string;
  onError: () => void;
}) {
  const [loaded, setLoaded] = useState<{ src: string; square: boolean }>();
  const square = loaded?.src === src ? loaded.square : undefined;

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      unoptimized
      className={cn(
        square ? "object-cover" : "object-contain",
        square === false && "p-[13%]",
      )}
      onLoad={({ currentTarget }) => {
        const ratio = currentTarget.naturalWidth / currentTarget.naturalHeight;
        setLoaded({ src, square: ratio > 0.9 && ratio < 1.12 });
      }}
      onError={onError}
    />
  );
}
