import { useEffect, useRef, useState } from "react";
import { getSearchRowersQueryKey, useSearchRowers, type RowerOption } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errMsg } from "@/lib/util";

export function RowerPicker({ seatText, disabled, onPick }: {
  seatText: string; disabled: boolean; onPick: (r: RowerOption) => void;
}) {
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);
  const params = term ? { q: term } : {};
  const q = useSearchRowers(params, { query: { queryKey: getSearchRowersQueryKey(params), staleTime: 0, refetchOnMount: "always" } });
  const current = text.trim() === term && !q.isFetching && !q.isError;
  const rows = current ? (q.data ?? []) : [];
  const dupes = new Set<string>();
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.firstName} ${r.lastName}`.toLowerCase();
    if (seen.has(k)) dupes.add(k); seen.add(k);
  }
  return (
    <div className="space-y-2 rounded-md border bg-card p-3" data-testid="panel-rower-picker">
      <label htmlFor="rower-search" className="text-sm font-medium">Reserve {seatText} for which rower? Click a name to book.</label>
      <Input id="rower-search" ref={ref} value={text} maxLength={100} disabled={disabled} autoComplete="off"
        placeholder="Search first or last name" onChange={(e) => setText(e.target.value)} data-testid="input-rower-search" />
      <div className="max-h-[200px] overflow-y-auto rounded-md border" style={{ maxHeight: 200, overflowY: "auto" }} aria-busy={!current} data-testid="list-rowers">
        {q.isError ? (
          <div className="space-y-2 p-3 text-sm text-destructive" role="alert">
            {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-rowers">Retry</Button>
          </div>
        ) : !current ? (
          <div className="space-y-2 p-2" role="status" aria-label="Searching rowers"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
        ) : rows.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground" data-testid="text-no-rowers">No registered rowers match.</p>
        ) : (
          <ul>
            {rows.map((r) => {
              const dup = dupes.has(`${r.firstName} ${r.lastName}`.toLowerCase());
              return (
                <li key={r.id}>
                  <button type="button" disabled={disabled} onClick={() => onPick(r)} data-testid={"button-pick-rower-" + r.id}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none disabled:opacity-50">
                    <span>{r.firstName} {r.lastName}</span>
                    {dup && <span className="text-xs text-muted-foreground">Member ID {r.id}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
