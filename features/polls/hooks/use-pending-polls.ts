"use client";

import { useQuery } from "@tanstack/react-query";

import { getMyPendingPollCount } from "@/features/polls/lib/student-actions";

/** Open polls the signed-in user can still answer — drives the nav badge. */
export function usePendingPollCount(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["polls", "pending-count"],
    queryFn: async () => {
      const result = await getMyPendingPollCount();
      return result.ok ? result.data.count : 0;
    },
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  return data ?? 0;
}
