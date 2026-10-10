import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetLaunchSeatsQueryKey, useCancelReservation, useGetLaunchSeats, useSwapSeats,
  type Launch, type Seat,
} from "@workspace/api-client-react";
import { BoatSeatLayout } from "@/components/boat-seat-layout";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMsg, fmtDate, fmtShift, useRefreshData } from "@/lib/util";

type Pick = { id: number; position: number };
type Snap = { id: number; position: number; name: string; label: string };
type Pending =
  | { kind: "cancel"; a: Snap }
  | { kind: "swap"; a: Snap; b: Snap };

const snap = (s: Seat): Snap => ({ id: s.reservationId as number, position: s.position, name: s.rowerName ?? "Rower", label: s.label });

export function AdminCrewDialog({ launch, onClose }: { launch: Launch | null; onClose: () => void }) {
  const open = !!launch;
  const launchId = launch?.id ?? 0;
  const qc = useQueryClient();
  const q = useGetLaunchSeats(launchId, {
    query: { queryKey: getGetLaunchSeatsQueryKey(launchId), enabled: open, refetchInterval: 10000, refetchOnMount: "always" },
  });
  const cancel = useCancelReservation();
  const swap = useSwapSeats();
  const refresh = useRefreshData();
  const [picks, setPicks] = useState<Pick[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const busy = useRef(false);
  const [working, setWorking] = useState(false);

  const seats = q.data ?? [];
  // Reconcile: keep only picks still matching the same booking at the same seat.
  const chosen = picks
    .map((p) => seats.find((s) => s.occupied && s.position === p.position && s.reservationId === p.id))
    .filter((s): s is Seat => !!s);
  const octuple = launch?.boat.type === "Octuple Scull";

  const toggle = (s: Seat) => {
    if (working || !s.occupied || s.reservationId == null) return;
    setStatus(null); setError(null);
    const id = s.reservationId;
    const base = chosen.map((c) => ({ id: c.reservationId as number, position: c.position }));
    if (base.some((p) => p.id === id && p.position === s.position)) setPicks(base.filter((p) => p.position !== s.position));
    else if (base.length < 2) setPicks([...base, { id, position: s.position }]);
  };

  const fail = (e: unknown) => {
    busy.current = false; setWorking(false);
    setError(errMsg(e)); setPicks([]); setPending(null);
    refresh(); q.refetch();
  };
  const ok = (msg: string) => {
    busy.current = false; setWorking(false);
    setPicks([]); setPending(null); setError(null); setStatus(msg);
    refresh(); q.refetch();
  };

  const run = () => {
    const p = pending;
    if (!p || busy.current || !launch) return;
    busy.current = true; setWorking(true); setError(null);
    if (p.kind === "cancel") {
      cancel.mutate({ reservationId: p.a.id, params: { expectedPosition: p.a.position } }, {
        onSuccess: () => ok(`Cancelled ${p.a.name} from seat ${p.a.position} (${p.a.label}).`),
        onError: fail,
      });
    } else {
      swap.mutate({ launchId: launch.id, data: { firstReservationId: p.a.id, firstPosition: p.a.position, secondReservationId: p.b.id, secondPosition: p.b.position } }, {
        onSuccess: (res) => {
          qc.setQueryData(getGetLaunchSeatsQueryKey(launch.id), res);
          ok(`Swapped ${p.a.name} and ${p.b.name}.`);
        },
        onError: fail,
      });
    }
  };

  const reset = () => { setPicks([]); setPending(null); setError(null); setStatus(null); };
  const posRole = (s: Seat) => `seat ${s.position} (${s.label})`;

  let body = "";
  if (pending?.kind === "cancel" && launch) {
    body = `Cancel ${pending.a.name} in seat ${pending.a.position} (${pending.a.label}) on ${fmtDate(launch.date)}, ${fmtShift(launch.shift)}, ${launch.boat.name}? The seat becomes open.`;
  } else if (pending?.kind === "swap") {
    const { a, b } = pending;
    body = `${a.name}: seat ${a.position} (${a.label}) to seat ${b.position} (${b.label}). ${b.name}: seat ${b.position} (${b.label}) to seat ${a.position} (${a.label}). Roles follow the seat positions.`;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !working) { reset(); onClose(); } }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto" data-testid="dialog-crew">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">{launch ? `${launch.boat.name} crew` : "Crew"}</DialogTitle>
          <DialogDescription>
            {launch ? `${launch.boat.type} / ${fmtDate(launch.date)} / ${fmtShift(launch.shift)}. ` : ""}
            Select one booked seat to cancel it, or two to swap them.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading && <Skeleton className="h-36 w-full" />}
        {q.isError && (
          <div className="space-y-2 text-sm text-destructive" role="alert">
            {errMsg(q.error)} <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-retry-crew">Retry</Button>
          </div>
        )}
        {q.data && seats.length === 0 && <p className="text-sm text-muted-foreground" data-testid="text-crew-empty">No seats to show for this outing.</p>}
        {q.data && seats.length > 0 && (
          <BoatSeatLayout
            variant="admin" seats={seats} octuple={!!octuple}
            isDisabled={(s) => working || !s.occupied || s.reservationId == null}
            isSelected={(s) => chosen.some((c) => c.position === s.position)}
            onSelect={toggle}
            note={<>{octuple ? "Coxswain faces the bow; every rower faces the stern." : "All rowers face the stern."} Only booked seats can be selected, up to two.</>}
          />
        )}
        <div className="rounded-md bg-secondary px-3 py-2 text-sm" aria-live="polite" data-testid="text-selection">
          {chosen.length === 0 ? "No seats selected." : chosen.map((c) => `${c.rowerName ?? "Rower"}, ${posRole(c)}`).join("  and  ")}
        </div>
        {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-crew-error">{error}</p>}
        {status && <p role="status" className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="text-crew-success">{status}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={working || chosen.length !== 1} onClick={() => setPending({ kind: "cancel", a: snap(chosen[0]) })} data-testid="button-cancel-reservation">Cancel reservation</Button>
          <Button disabled={working || chosen.length !== 2} onClick={() => setPending({ kind: "swap", a: snap(chosen[0]), b: snap(chosen[1]) })} data-testid="button-swap-seats">Swap seats</Button>
          <Button variant="ghost" disabled={working || chosen.length === 0} onClick={() => setPicks([])} data-testid="button-clear-selection">Clear selection</Button>
        </div>
        <Confirm
          open={!!pending} onOpenChange={(o) => { if (!o && !busy.current) setPending(null); }}
          testid="confirm-crew-action"
          title={pending?.kind === "swap" ? "Swap these seats?" : "Cancel this reservation?"}
          body={body} yes={pending?.kind === "swap" ? "Swap seats" : "Cancel reservation"} onYes={run}
        />
      </DialogContent>
    </Dialog>
  );
}
