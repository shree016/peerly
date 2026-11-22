import { cn } from "@/lib/utils";

/** Small count bubble for nav items. Renders nothing for 0. */
export function NavBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className={cn(
        "bg-candy inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[0.65rem] leading-5 font-bold text-white shadow-sm",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
