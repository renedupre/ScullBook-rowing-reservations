import { useState } from "react";
import { CalendarDays, Ship, Users } from "lucide-react";
import {
  getListLaunchesQueryKey, getListMyReservationsQueryKey, useCancelReservation, useListLaunches, useListMyReservations, type Launch, type Reservation,
} from "@workspace/api-client-react";
import { Shell } from "@/components/shell";
import { BookingNotices } from "@/components/booking-notices";
import { SeatMap } from "@/components/seat-map";
import { Confirm } from "@/components/confirm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { errMsg, fmtDate, fmtShift, useRefreshData } from "@/lib/util";

export default function Rower() {
  const res = useListMyReservations({ query: { queryKey: getListMyReservationsQueryKey(), refetchInterval: 10000 } });
  const launches = useListLaunches(undefined, { query: { queryKey: getListLaunchesQueryKey(), refetchInterval: 10000 } });
  const cancel = useCancelReservation();
  const refresh = useRefreshData();
  const [pick, setPick] = useState<Launch | null>(null);
  const [del, setDel] = useState<Reservation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sameShift = (l: Launch) => res.data?.find((r) => r.date === l.date && r.shift === l.shift);
  const conflicting = res.data?.filter((r, i, all) => all.some((other, j) => i !== j && r.date === other.date && r.shift === other.shift));
  const booked = pick ? sameShift(pick) : undefined;

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
      <p className="mt-2 text-sm text-muted-foreground">Book one boat per date and shift: 8am–12pm and 1pm–5pm. You can book both shifts.</p>
      <BookingNotices />
      {!!conflicting?.length && <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm" data-testid="text-existing-conflicts">You have existing bookings that overlap in the same shift. Please cancel the extra seats below; your reservations have not been automatically removed.</p>}
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
              <p className="font-serif text-xl">{fmtDate(r.date)} / {fmtShift(r.shift)}</p>
              <p className="text-sm text-muted-foreground">{r.boat.name} / {r.boat.type} / seat {r.position}, {r.seatLabel}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { const l = launches.data?.find((l) => l.id === r.launchId); if (l) setPick(l); }} disabled={!launches.data?.some((l) => l.id === r.launchId)} data-testid={"button-view-own-crew-" + r.id}>View crew</Button>
              <Button variant="outline" size="sm" onClick={() => setDel(r)} data-testid={"button-cancel-reservation-" + r.id}>Cancel seat</Button>
            </div>
          </div>
        ))}
      </section>

      <h2 className="mt-12 font-serif text-3xl">Upcoming outings</h2>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {launches.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        {launches.isError && <p className="text-sm text-destructive">{errMsg(launches.error)} <Button size="sm" variant="outline" onClick={() => launches.refetch()}>Retry</Button></p>}
        {launches.data?.length === 0 && <p className="text-muted-foreground" data-testid="empty-launches">No outings scheduled yet. Check back soon.</p>}
        {launches.data?.map((l) => (
          <div key={l.id} className="rounded-lg border border-primary/30 bg-card">
          <button
            key={l.id}
            disabled={l.full}
            onClick={() => setPick(l)}
            data-testid={"card-launch-" + l.id}
            className={"rise w-full rounded-lg p-5 text-left transition-transform duration-200 " + (l.full ? "cursor-not-allowed bg-muted text-muted-foreground grayscale" : "hover:-translate-y-1")}
          >
            <p className="flex items-center gap-2 text-xs uppercase tracking-widest"><CalendarDays className="h-4 w-4" />{fmtDate(l.date)}</p>
            <p className="mt-1 text-sm font-semibold">{fmtShift(l.shift)}</p>
            <p className="mt-2 font-serif text-2xl">{l.boat.name}</p>
            <p className="text-sm">{l.boat.type}</p>
            <p className="mt-3 flex items-center gap-2 text-sm"><Users className="h-4 w-4" />{l.full ? "Fully booked" : l.availableSeats + " of " + l.boat.seats + " seats open"}</p>
            {sameShift(l) && <p className="mt-2 text-xs font-medium">{sameShift(l)?.launchId === l.id ? "Your seat is on this boat" : "You already booked another boat in this shift"}</p>}
          </button>
          <Button variant="outline" size="sm" className="mb-4 ml-5" onClick={() => setPick(l)} data-testid={"button-view-crew-" + l.id}>View crew</Button>
          </div>
        ))}
      </section>

      <Dialog open={!!pick} onOpenChange={(o) => !o && setPick(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
             <DialogTitle className="font-serif text-3xl">Boat seats &amp; crew</DialogTitle>
             <DialogDescription>See who’s rowing. Tap a free seat to book if you haven’t reserved this shift.</DialogDescription>
          </DialogHeader>
          {pick && <SeatMap key={pick.id} launch={pick} canReserve={!!res.data && !booked} bookingNotice={booked ? `You have a seat on ${booked.boat.name} for ${fmtShift(booked.shift)}. Cancel it before booking another seat in this shift.` : !res.data ? "Your bookings could not yet be checked. Close this window and retry your seats list before reserving." : undefined} onDone={() => setPick(null)} />}
        </DialogContent>
      </Dialog>

      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} testid="confirm-cancel-reservation"
        title="Cancel this seat?" body={del ? "You will give up " + del.seatLabel + " on " + fmtDate(del.date) + ", " + fmtShift(del.shift) + "." : ""}
        yes="Cancel seat" onYes={doCancel} />
    </Shell>
  );
}
