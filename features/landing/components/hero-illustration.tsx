import { cn } from "@/lib/utils";

/**
 * The onboarding-style illustration from the Peerly theme: a sunshine-yellow
 * blob, a tilted periwinkle speech bubble carrying the headline, a floating
 * trophy, and a lightbulb-over-book motif. Pure CSS + emoji, no image assets.
 */
export function HeroIllustration({
  title = ["Learn.", "Play.", "Get placed."],
  caption = "Live quizzes and real placement stories from your seniors.",
  className,
  compact = false,
}: {
  title?: string[];
  caption?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "bg-sky-soft relative isolate overflow-hidden rounded-[2.5rem]",
        compact ? "aspect-[5/4]" : "aspect-[4/5] sm:aspect-square",
        className,
      )}
    >
      {/* soft rings */}
      <div className="absolute -top-24 -right-24 size-72 rounded-full border-[40px] border-white/35" />
      <div className="absolute -bottom-28 -left-20 size-64 rounded-full border-[36px] border-white/25" />

      {/* doodles */}
      <span className="text-foreground/70 absolute top-[16%] left-[10%] text-2xl font-black">
        ✦
      </span>
      <span className="border-foreground/60 absolute top-[30%] left-[7%] size-0 border-y-[9px] border-r-[14px] border-y-transparent" />
      <span className="text-foreground/60 absolute bottom-[34%] left-[16%] text-xl font-black">
        ⚡
      </span>

      {/* yellow blob */}
      <div className="bg-sun absolute top-[22%] left-[22%] h-[50%] w-[64%] rotate-6 rounded-[46%_54%_42%_58%/55%_45%_55%_45%]" />

      {/* speech bubble */}
      <div className="absolute top-[24%] left-[12%] w-[70%] -rotate-6">
        <div className="relative rounded-[2rem] border-[3px] border-black/80 bg-[oklch(0.86_0.08_220)] px-5 py-4 shadow-lg sm:px-6 sm:py-5 dark:bg-[oklch(0.62_0.1_230)]">
          <span className="absolute -top-5 -left-4 flex size-10 items-center justify-center rounded-full border-[3px] border-black/80 bg-white text-lg font-black text-black">
            ?
          </span>
          <p
            className={cn(
              "font-serif leading-[1.05] font-extrabold text-black",
              compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl",
            )}
          >
            {title.map((line, i) => (
              <span key={line} className="block">
                {i === title.length - 1 ? (
                  <span className="bg-sun/80 rounded-md px-1">{line}</span>
                ) : (
                  line
                )}
              </span>
            ))}
          </p>
          <p className="mt-2 max-w-[16rem] text-xs font-medium text-black/70 sm:text-sm">
            {caption}
          </p>
          <span className="absolute -bottom-4 left-[62%] size-0 border-t-[18px] border-r-[18px] border-t-black/80 border-r-transparent" />
        </div>
      </div>

      {/* floating trophy */}
      <span className="animate-float absolute top-[8%] right-[10%] text-6xl drop-shadow-xl sm:text-7xl">
        🏆
      </span>

      {/* lightbulb over book */}
      <div className="absolute bottom-[6%] left-1/2 flex -translate-x-1/2 flex-col items-center">
        <span className="text-4xl sm:text-5xl">💡</span>
        <span className="-mt-2 text-5xl sm:text-6xl">📖</span>
      </div>
    </div>
  );
}
