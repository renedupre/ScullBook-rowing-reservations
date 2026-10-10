import { useState } from "react";
import { Bell } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListMyNoticesQueryKey, useListMyNotices, useMarkNoticeRead, type BookingNotice } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errMsg, fmtDate, fmtShift } from "@/lib/util";

export function BookingNotices() {
  const qc = useQueryClient();
  const notices = useListMyNotices({ query: { queryKey: getListMyNoticesQueryKey(), refetchInterval: 10000 } });
  const markRead = useMarkNoticeRead();
  const [showRead, setShowRead] = useState(false);
  const unread = notices.data?.filter((n) => !n.readAt) ?? [];
  const visible = showRead ? notices.data : unread;

  function read(noticeId: number) {
    markRead.mutate({ noticeId }, {
      onSuccess: (updated) => {
        qc.setQueryData<BookingNotice[]>(getListMyNoticesQueryKey(), (old) => old?.map((n) => n.id === updated.id ? updated : n));
        void qc.invalidateQueries({ queryKey: getListMyNoticesQueryKey() });
      },
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-primary/30 bg-card p-4" aria-labelledby="booking-notices-title" data-testid="booking-notices">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="booking-notices-title" className="flex items-center gap-2 font-serif text-2xl">
          <Bell className="h-5 w-5" /> Booking notices
          {notices.data && <span className="font-sans text-xs text-muted-foreground" aria-live="polite" data-testid="notice-unread-count">{unread.length} unread</span>}
        </h2>
        <Button size="sm" variant="outline" onClick={() => setShowRead(!showRead)} aria-pressed={showRead}>
          {showRead ? "Show unread only" : "Show all notices"}
        </Button>
      </div>
      {notices.isLoading && <Skeleton className="mt-3 h-16 w-full" />}
      {notices.isError && <p role="alert" className="mt-3 text-sm text-destructive">{errMsg(notices.error)} <Button size="sm" variant="outline" onClick={() => notices.refetch()}>Retry</Button></p>}
      {markRead.isError && <p role="alert" className="mt-3 text-sm text-destructive">Could not mark notice read: {errMsg(markRead.error)}. Please try again.</p>}
      {notices.data && visible?.length === 0 && <p className="mt-3 text-sm text-muted-foreground">{showRead ? "No booking notices yet." : "No unread booking notices."}</p>}
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
        {visible?.map((n) => (
          <article key={n.id} className={"rounded-md border p-3 " + (n.readAt ? "border-input" : "border-accent bg-accent/5")} data-testid={"notice-" + n.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{n.kind === "cancellation" ? "An administrator cancelled your booking" : "An administrator changed your seat"}</p>
                <p className="mt-1 text-sm">{n.boatName} / {fmtDate(n.date)} / {fmtShift(n.shift)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {n.kind === "cancellation"
                    ? `Cancelled: seat ${n.oldPosition}, ${n.oldSeatLabel}.`
                    : `Moved from seat ${n.oldPosition}, ${n.oldSeatLabel} to seat ${n.newPosition}, ${n.newSeatLabel}.`}
                </p>
              </div>
              {n.readAt ? <span className="text-xs text-muted-foreground">Read</span> : (
                <Button size="sm" variant="outline" disabled={markRead.isPending} onClick={() => read(n.id)} data-testid={"button-read-notice-" + n.id}>
                  {markRead.isPending && markRead.variables?.noticeId === n.id ? "Saving…" : "Mark read"}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
