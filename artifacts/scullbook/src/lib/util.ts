import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export function errMsg(e: unknown): string {
  const x = e as { data?: { error?: string; message?: string } | null; message?: string } | null;
  return x?.data?.error ?? x?.data?.message ?? x?.message ?? "Something went wrong";
}

export function fmtDate(d: string): string {
  try { return format(parseISO(d), "EEE d MMM yyyy"); } catch { return d; }
}
export function fmtShift(shift: string): string {
  return shift === "08:00" ? "8am–12pm" : "1pm–5pm";
}

export const CAPACITY: Record<string, number> = {
  "Single Scull": 1,
  "Double Scull": 2,
  "Quadruple Scull": 4,
  "Octuple Scull": 9,
};

export function passwordProblems(p: string): string[] {
  const out: string[] = [];
  if (p.length < 10) out.push("at least 10 characters");
  if (!/[A-Z]/.test(p)) out.push("an uppercase letter");
  if (!/[a-z]/.test(p)) out.push("a lowercase letter");
  if (!/[0-9]/.test(p)) out.push("a number");
  if (!/[^A-Za-z0-9]/.test(p)) out.push("a special character");
  return out;
}

/** Refetch every data query except the current-user query. */
export function useRefreshData() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) => String(q.queryKey[0]).startsWith("/api/") && q.queryKey[0] !== "/api/auth/me",
    });
}
