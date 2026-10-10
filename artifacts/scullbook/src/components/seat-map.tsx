import { useState } from "react";
import { BoatSeatLayout } from "@/components/boat-seat-layout";
import {
  getGetLaunchSeatsQueryKey, useGetLaunchSeats, useReserveSeat, type Launch,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errMsg, fmtDate, fmtShift, useRefreshData } from "@/lib/util";

export function SeatMap({ launch, onDone, canReserve = true, bookingNotice }: {
  launch: Launch; onDone: () => void; canReserve?: boolean; bookingNotice?: string;
}) {
  const q = useGetLaunchSeats(launch.id, {
    query: { enabled: true, queryKey: getGetLaunchSeatsQueryKey(launch.id), staleTime: 5000, refetchOnMount: "always", refetchInterval: 10000 },
  });
  const [sel, setSel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reserve = useReserveSeat();
  const refresh = useRefreshData();
  const octuple = launch.boat.type === "Octuple Scull";
  const seats = [...(q.data ?? [])].sort((a, b) => a.position - b.position);
  const chosen = canReserve ? seats.find((s) => s.position === sel && !s.occupied) : undefined;

  const confirm = () => {
    if (!chosen || !canReserve) return;
    setError(null);
    reserve.mutate({ data: { launchId: launch.id, position: chosen.position } }, {
      onSuccess: () => { refresh(); onDone(); },
      onError: (e) => { setError(errMsg(e)); setSel(null); refresh(); },
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {launch.boat.name} / {launch.boat.type} / {fmtDate(launch.date)} / {fmtShift(launch.shift)}
      </p>
      {bookingNotice && <p className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="text-booking-notice">{bookingNotice}</p>}
      {q.isLoading && <Skeleton className="h-36 w-full" />}
      {q.isError && (
        <div className="space-y-2 text-sm text-destructive" role="alert">
          {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-seats">Retry</Button>
        </div>
      )}
      {q.data && (
        <BoatSeatLayout
          seats={seats} octuple={octuple}
          isDisabled={(s) => s.occupied || !canReserve || reserve.isPending}
          isSelected={(s) => sel === s.position}
          onSelect={(s) => { setSel(s.position); setError(null); }}
          note={<>{octuple ? "Coxswain faces the bow; every rower faces the stern." : "All rowers face the stern."} Hatched seats are taken. Names are visible to all signed-in users.</>}
        />
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
