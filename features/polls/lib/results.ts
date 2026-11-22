import { and, count, desc, eq, isNotNull } from "drizzle-orm";

import db from "@/db";
import { pollResponse, pollResponseOption } from "@/db/schema";

import type { PollOptionRow, PollRow, ResultsDTO } from "./types";

const MAX_ANSWERS = 500;

/** Aggregate results: counts per option and (short answer) anonymous texts. */
export async function computeResults(
  row: Pick<PollRow, "id" | "questionType">,
  options: PollOptionRow[],
): Promise<ResultsDTO> {
  const [[{ total }], perOption, answers] = await Promise.all([
    db
      .select({ total: count() })
      .from(pollResponse)
      .where(eq(pollResponse.pollId, row.id)),
    db
      .select({ optionId: pollResponseOption.optionId, value: count() })
      .from(pollResponseOption)
      .where(eq(pollResponseOption.pollId, row.id))
      .groupBy(pollResponseOption.optionId),
    row.questionType === "short_answer"
      ? db
          .select({ text: pollResponse.textAnswer })
          .from(pollResponse)
          .where(
            and(
              eq(pollResponse.pollId, row.id),
              isNotNull(pollResponse.textAnswer),
            ),
          )
          .orderBy(desc(pollResponse.submittedAt))
          .limit(MAX_ANSWERS)
      : Promise.resolve([]),
  ]);

  const counts = new Map(perOption.map((p) => [p.optionId, p.value]));
  return {
    totalResponses: total,
    options: [...options]
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        label: o.label,
        count: counts.get(o.id) ?? 0,
        capacity: o.capacity,
      })),
    ...(row.questionType === "short_answer"
      ? { answers: answers.map((a) => a.text ?? "").filter(Boolean) }
      : {}),
  };
}
