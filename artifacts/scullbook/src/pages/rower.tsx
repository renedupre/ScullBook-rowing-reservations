import { useState } from "react";
import { CalendarDays, Ship, Users } from "lucide-react";
import {
  useCancelReservation, useListLaunches, useListMyReservations, type Launch, type Reservation,
} from "@workspace/api-client-react";
import { Shell } from "@/components/shell";
import { SeatMap } from "@/components/seat-map";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMsg, fmtDate, useRefreshData } from "@/lib/util";

export default function Rower() {
  const res = useListMyReservations();
  const launches = useListLaunches();
  const cancel = useCancelReservation();
  const refresh = useRefreshData();
  const [pick, setPick] = useState<Launch | null>(null);
  const [del, setDel] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doCancel = () => {
    if (!del) return;
    setError(null);
    cancel.mutate({ reservationId: del.id }, {
      onSuccess: () => { setDel(null); refresh(); },
      onError: (e) => { setDel(null); setError(errMsg(e)); },
    });
  };

  return (
    <Shell label="Rower">
      <h1 className="font-serif text-4xl">Your seats</h1>
      {error && <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-error">{error}</p>}
      <section className="mt-4 space-y-3">
        {res.isLoading && <Skeleton className="h-20 w-full" />}
        {res.isError && <p className="text-sm text-destructive">{errMsg(res.error)} <Button size="sm" variant="outline" onClick={() => res.refetch()}>Retry</Button></p>}
        {res.data?.length === 0 && (
          <div className="flex items-center gap-4 rounded-lg border border-dashed border-input p-6 text-muted-foreground" data-testid="empty-reservations">
            <Ship className="h-8 w-8 text-accent" /> No seats booked yet. Pick a date below and claim your place.
          </div>
        )}
        {res.data?.map((r) => (
          <div key={r.id} className="rise flex flex-wrap items-center justify-between gap-3 rounded-lg border-l-4 border-accent bg-card p-4" data-testid={"card-reservation-" + r.id}>
            <div>
              <p className="font-serif text-xl">{fmtDate(r.date)}</p>
              <p className="text-sm text-muted-foreground">{r.boat.name} / {r.boat.type} / seat {r.position}, {r.seatLabel}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setDel(r)} data-testid={"button-cancel-reservation-" + r.id}>Cancel seat</Button>
          </div>
        ))}
      </section>

      <h2 className="mt-12 font-serif text-3xl">Upcoming outings</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {launches.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        {launches.isError && <p className="text-sm text-destructive">{errMsg(launches.error)} <Button size="sm" variant="outline" onClick={() => launches.refetch()}>Retry</Button></p>}
        {launches.data?.length === 0 && <p className="text-muted-foreground" data-testid="empty-launches">No outings scheduled yet. Check back soon.</p>}
        {launches.data?.map((l) => (
          <button
            key={l.id}
            disabled={l.full}
            onClick={() => setPick(l)}
            data-testid={"card-launch-" + l.id}
            className={"rise rounded-lg border p-5 text-left transition-transform duration-200 " + (l.full ? "cursor-not-allowed border-border bg-muted text-muted-foreground grayscale" : "border-primary/30 bg-card hover:-translate-y-1 hover:border-primary")}
          >
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest"><CalendarDays className="h-4 w-4" />{fmtDate(l.date)}</p>
            <p className="mt-2 font-serif text-2xl">{l.boat.name}</p>
            <p className="text-sm">{l.boat.type}</p>
            <p className="mt-3 flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{l.full ? "Fully booked" : l.availableSeats + " of " + l.boat.seats + " seats open"}</p>
          </button>
        ))}
      </section>

      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-3xl">Choose your seat</DialogTitle>
            <DialogDescription>Tap a free seat, then confirm.</DialogDescription>
          </DialogHeader>
          {pick && <SeatMap key={pick.id} launch={pick} onDone={() => setPick(null)} />}
        </DialogContent>
      </Dialog>

      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} testid="confirm-cancel-reservation"
        title="Cancel this seat?" body={del ? "You will give up " + del.seatLabel + " on " + fmtDate(del.date) + "." : ""}
        yes="Cancel seat" onYes={doCancel} />
    </Shell>
  );
}
