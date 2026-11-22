import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown instantly while the event page loads its data on the server, so
 * "Create Event", "Save" and "Add question" navigate right away instead of
 * leaving the user on the previous page until the new one is ready.
 */
export default function QuizEventLoading() {
  return (
    <div
      className="container mx-auto mt-6 mb-12 max-w-6xl space-y-6 px-4 sm:mt-8 sm:px-6 md:mb-32"
      aria-busy="true"
      aria-label="Loading event"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-36" />
      </div>
      <Skeleton className="h-40 w-full rounded-[1.75rem]" />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}
