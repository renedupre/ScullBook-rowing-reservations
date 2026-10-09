import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  getGetLaunchSeatsQueryKey, useGetLaunchSeats, useReserveSeat, type Launch,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errMsg, fmtDate, useRefreshData } from "@/lib/util";

export function SeatMap({ launch, onDone }: { launch: Launch; onDone: () => void }) {
  const q = useGetLaunchSeats(launch.id, {
    query: { enabled: true, queryKey: getGetLaunchSeatsQueryKey(launch.id), staleTime: 5000, refetchOnMount: "always" },
  });
  const [sel, setSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reserve = useReserveSeat();
  const refresh = useRefreshData();
  const octuple = launch.boat.type === "Octuple Scull";
  const seats = [...(q.data ?? [])].sort((a, b) => a.position - b.position);
  const chosen = seats.find((s) => s.position === sel);

  const confirm = () => {
    if (sel == null) return;
    setError(null);
    reserve.mutate({ data: { launchId: launch.id, position: sel } }, {
      onSuccess: () => { refresh(); onDone(); },
      onError: (e) => { setError(errMsg(e)); setSel(null); refresh(); },
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {launch.boat.name} / {launch.boat.type} / {fmtDate(launch.date)}
      </p>
      {q.isLoading && <Skeleton className="h-36 w-full" />}
      {q.isError && (
        <div className="space-y-2 text-sm text-destructive" role="alert">
          {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-seats">Retry</Button>
        </div>
      )}
      {q.data && (
        <div className="overflow-x-auto pb-2">
          <div className="mb-1 flex min-w-max justify-between px-6 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            <span>Stern</span><span>Bow</span>
          </div>
          <div className="relative flex min-w-max items-center gap-2 rounded-[3rem] border-2 border-primary/70 bg-secondary/50 px-8 py-6">
            <div className="absolute left-6 right-6 top-1/2 h-px bg-primary/20" />
            {seats.map((s, i) => {
              const forward = octuple && s.position === 1;
              const Dir = forward ? ArrowRight : ArrowLeft;
              const isSel = sel === s.position;
              return (
                <button
                  key={s.position}
                  type="button"
                  disabled={s.occupied}
                  onClick={() => { setSel(s.position); setError(null); }}
                  title={s.occupied ? (s.rowerName ?? "Taken") : s.label}
                  aria-pressed={isSel}
                  data-testid={"seat-" + s.position}
                  style={{ animationDelay: i * 40 + "ms" }}
                  className={"rise relative z-10 flex h-24 w-[4.5rem] flex-col items-center justify-between rounded-xl border-2 px-1 py-2 text-center transition-transform duration-200 " +
                    (s.occupied
                      ? "stripe cursor-not-allowed border-border bg-muted text-muted-foreground"
                      : isSel
                        ? "-translate-y-1 scale-105 border-accent bg-accent text-accent-foreground"
                        : "border-primary bg-card text-primary hover:-translate-y-1")}
                >
                  <span className="font-serif text-lg leading-none">{s.position}</span>
                  <Dir className="h-4 w-4" aria-hidden />
                  <span className="text-[10px] font-medium leading-tight">{s.label}</span>
                  {s.occupied && <span className="sr-only">occupied</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {octuple ? "Coxswain faces the bow; every rower faces the stern." : "All rowers face the stern."} Hatched seats are taken.
          </p>
        </div>
      )}
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-reserve-error">{error}</p>}
      {chosen && (
        <div className="rise flex flex-wrap items-center justify-between gap-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground" data-testid="panel-confirm-seat">
          <span>Book <strong>{chosen.label}</strong> (seat {chosen.position})?</span>
          <span className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={reserve.isPending} onClick={confirm} data-testid="button-confirm-yes">Yes</Button>
            <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/15 hover:text-white" onClick={() => setSel(null)} data-testid="button-confirm-cancel">Cancel</Button>
          </span>
        </div>
      )}
    </div>
  );
}
