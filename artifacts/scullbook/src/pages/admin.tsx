import { useState, type FormEvent } from "react";
import {
  useChangePassword, useCreateBoat, useCreateLaunch, useDeleteBoat, useDeleteLaunch,
  useGetAdminSummary, useListBoats, useListLaunches, useListRoster, useUpdateBoat,
  getGetAdminSummaryQueryKey, getListLaunchesQueryKey, getListRosterQueryKey,
  type Boat, type BoatInput, type Launch, type Shift,
} from "@workspace/api-client-react";
import { Shell } from "@/components/shell";
import { Confirm } from "@/components/confirm";
import { WeeklySeatChart } from "@/components/weekly-seat-chart";
import { aggregateWeek, currentLaWeekStart, filterByDay, shiftWeek, weekStartOf } from "@/lib/overview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CAPACITY, errMsg, fmtDate, fmtShift, passwordProblems, useRefreshData } from "@/lib/util";

const TYPES = Object.keys(CAPACITY) as BoatInput["type"][];
const selectCls = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";

function Err({ m }: { m: string | null }) {
  return m ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-error">{m}</p> : null;
}
function Stat({ n, label, id }: { n?: number; label: string; id: string }) {
  return (
    <div className="rise border-t-2 border-accent pt-3">
      <p className="font-serif text-5xl" data-testid={"stat-" + id}>{n ?? "-"}</p>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function Overview() {
  const s = useGetAdminSummary({ query: { queryKey: getGetAdminSummaryQueryKey(), refetchInterval: 10000 } });
  const [weekStart, setWeekStart] = useState(() => currentLaWeekStart());
  const [day, setDay] = useState<string | null>(null);
  const goWeek = (w: string) => { setWeekStart(w); setDay(null); };
  if (s.isLoading) return <Skeleton className="h-40 w-full" />;
  if (s.isError) return <p className="text-sm text-destructive">{errMsg(s.error)} <Button size="sm" variant="outline" onClick={() => s.refetch()}>Retry</Button></p>;
  const d = s.data;
  const all = d?.nextLaunches ?? [];
  const shown = filterByDay(all, day);
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat n={d?.rowerCount} label="Rowers" id="rowers" />
        <Stat n={d?.boatCount} label="Boats" id="boats" />
        <Stat n={d?.upcomingLaunchCount} label="Upcoming outings" id="launches" />
        <Stat n={d?.reservationCount} label="Reservations" id="reservations" />
      </div>
      <WeeklySeatChart
        data={aggregateWeek(all, weekStart)} weekStart={weekStart} selectedDay={day}
        onSelectDay={setDay}
        onPrev={() => goWeek(shiftWeek(weekStart, -1))}
        onNext={() => goWeek(shiftWeek(weekStart, 1))}
        onPickWeek={(v) => goWeek(weekStartOf(v))}
        onReset={() => { setDay(null); setWeekStart(currentLaWeekStart()); }}
      />
      <div>
        <h3 id="next-on-the-water-heading" className="font-serif text-2xl">Next on the water</h3>
        {all.length === 0 && <p className="mt-2 text-muted-foreground">Nothing scheduled.</p>}
        {all.length > 0 && shown.length === 0 && <p className="mt-2 text-muted-foreground" data-testid="text-day-empty">No outings on this day.</p>}
        <div className="mt-3 rounded-lg border border-border bg-card">
          <Table aria-labelledby="next-on-the-water-heading" data-testid="table-next-on-the-water">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead scope="col">Date</TableHead>
                <TableHead scope="col">Time</TableHead>
                <TableHead scope="col">Boat Name</TableHead>
                <TableHead scope="col" className="text-right">Seats</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((l) => (
                <TableRow key={l.id} data-testid={"row-next-" + l.id}>
                  <TableCell className="whitespace-nowrap">{fmtDate(l.date)}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtShift(l.shift)}</TableCell>
                  <TableCell className="font-medium">{l.boat.name}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted-foreground" aria-label={`${l.bookedSeats} booked out of ${l.boat.seats} seats`}>{l.bookedSeats}/{l.boat.seats}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function Boats() {
  const boats = useListBoats();
  const create = useCreateBoat();
  const update = useUpdateBoat();
  const remove = useDeleteBoat();
  const refresh = useRefreshData();
  const [edit, setEdit] = useState<Boat | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<BoatInput["type"]>("Octuple Scull");
  const [del, setDel] = useState<Boat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = () => { setEdit(null); setName(""); setType("Octuple Scull"); };
  const done = () => { reset(); refresh(); };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const data: BoatInput = { name: name.trim(), type, seats: CAPACITY[type] };
    const opts = { onSuccess: done, onError: (er: unknown) => setError(errMsg(er)) };
    if (edit) update.mutate({ boatId: edit.id, data }, opts); else create.mutate({ data }, opts);
  };
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="space-y-2">
        {boats.isLoading && <Skeleton className="h-24" />}
        {boats.isError && <p className="text-sm text-destructive">{errMsg(boats.error)} <Button size="sm" variant="outline" onClick={() => boats.refetch()}>Retry</Button></p>}
        {boats.data?.length === 0 && <p className="text-muted-foreground" data-testid="empty-boats">No boats in the fleet. Add the first one.</p>}
        {boats.data?.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-4" data-testid={"row-boat-" + b.id}>
            <div><p className="font-serif text-xl">{b.name}</p><p className="text-sm text-muted-foreground">{b.type} / {b.seats} seats</p></div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" data-testid={"button-edit-boat-" + b.id} onClick={() => { setEdit(b); setName(b.name); setType(b.type); }}>Edit</Button>
              <Button size="sm" variant="outline" data-testid={"button-delete-boat-" + b.id} onClick={() => setDel(b)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3 self-start rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-xl">{edit ? "Edit boat" : "Add a boat"}</h3>
        <div className="space-y-1.5"><Label htmlFor="b-name">Name</Label><Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} data-testid="input-boat-name" /></div>
        <div className="space-y-1.5"><Label htmlFor="b-type">Type</Label>
          <select id="b-type" className={selectCls} value={type} onChange={(e) => setType(e.target.value as BoatInput["type"])} data-testid="select-boat-type">
            {TYPES.map((t) => <option key={t} value={t}>{t} ({CAPACITY[t]})</option>)}
          </select></div>
        <Err m={error} />
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending || update.isPending} data-testid="button-save-boat">{edit ? "Save" : "Add boat"}</Button>
          {edit && <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>}
        </div>
      </form>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} testid="confirm-delete-boat" title="Delete this boat?"
        body={del ? del.name + " will be removed from the fleet." : ""} yes="Delete"
        onYes={() => del && remove.mutate({ boatId: del.id }, { onSuccess: () => { setDel(null); refresh(); }, onError: (e) => { setDel(null); setError(errMsg(e)); } })} />
    </div>
  );
}

function Schedule() {
  const boats = useListBoats();
  const launches = useListLaunches(undefined, { query: { queryKey: getListLaunchesQueryKey(), refetchInterval: 10000 } });
  const create = useCreateLaunch();
  const remove = useDeleteLaunch();
  const refresh = useRefreshData();
  const [date, setDate] = useState("");
  const [boatId, setBoatId] = useState("");
  const [shift, setShift] = useState<Shift | "both">("08:00");
  const [del, setDel] = useState<Launch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate({ data: { date, boatId: Number(boatId), shifts: shift === "both" ? ["08:00", "13:00"] : [shift] } }, {
      onSuccess: () => { setDate(""); refresh(); },
      onError: (er) => setError(errMsg(er)),
    });
  };
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="space-y-2">
        {launches.isLoading && <Skeleton className="h-24" />}
        {launches.isError && <p className="text-sm text-destructive">{errMsg(launches.error)} <Button size="sm" variant="outline" onClick={() => launches.refetch()}>Retry</Button></p>}
        {launches.data?.length === 0 && <p className="text-muted-foreground" data-testid="empty-schedule">No dates scheduled.</p>}
        {launches.data?.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card p-4" data-testid={"row-launch-" + l.id}>
            <div><p className="font-serif text-xl">{fmtDate(l.date)} / {fmtShift(l.shift)}</p><p className="text-sm text-muted-foreground">{l.boat.name} / {l.bookedSeats}/{l.boat.seats} booked{l.full ? " / full" : ""}</p></div>
            <Button size="sm" variant="outline" onClick={() => setDel(l)} data-testid={"button-delete-launch-" + l.id}>Delete</Button>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3 self-start rounded-lg border border-border bg-card p-4">
        <h3 className="font-serif text-xl">Schedule a boat shift</h3>
        <div className="space-y-1.5"><Label htmlFor="s-date">Date</Label><Input id="s-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required data-testid="input-launch-date" /></div>
        <div className="space-y-1.5"><Label htmlFor="s-boat">Boat</Label>
          <select id="s-boat" className={selectCls} value={boatId} onChange={(e) => setBoatId(e.target.value)} required data-testid="select-launch-boat">
            <option value="" disabled>Choose a boat</option>
            {boats.data?.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.type})</option>)}
          </select></div>
        <div className="space-y-1.5"><Label htmlFor="s-shift">Launch shift (four hours)</Label>
          <select id="s-shift" className={selectCls} value={shift} onChange={(e) => setShift(e.target.value as Shift | "both")} data-testid="select-launch-shift">
            <option value="08:00">8am–12pm</option>
            <option value="13:00">1pm–5pm</option>
            <option value="both">Both shifts</option>
          </select>
          <p className="text-xs text-muted-foreground">If one shift is already scheduled, choose only the missing shift. Both shifts are saved together or neither is saved.</p>
        </div>
        <Err m={error} />
        <Button type="submit" disabled={create.isPending} data-testid="button-create-launch">Schedule</Button>
      </form>
      <Confirm open={!!del} onOpenChange={(o) => !o && setDel(null)} testid="confirm-delete-launch" title="Delete this shift?"
        body={del ? "Remove " + del.boat.name + " on " + fmtDate(del.date) + ", " + fmtShift(del.shift) + "? Booked shifts cannot be removed until their rowers cancel." : ""} yes="Delete"
        onYes={() => del && remove.mutate({ launchId: del.id }, { onSuccess: () => { setDel(null); refresh(); }, onError: (e) => { setDel(null); setError(errMsg(e)); } })} />
    </div>
  );
}

function Rosters() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = from || to ? { ...(from ? { from } : {}), ...(to ? { to } : {}) } : undefined;
  const r = useListRoster(params, { query: { queryKey: getListRosterQueryKey(params), refetchInterval: 10000 } });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor="f-from">From</Label><Input id="f-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-roster-from" /></div>
        <div className="space-y-1.5"><Label htmlFor="f-to">To</Label><Input id="f-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-roster-to" /></div>
        {(from || to) && <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }} data-testid="button-clear-filter">Clear</Button>}
      </div>
      {r.isLoading && <Skeleton className="h-32" />}
      {r.isError && <p className="text-sm text-destructive">{errMsg(r.error)} <Button size="sm" variant="outline" onClick={() => r.refetch()}>Retry</Button></p>}
      {r.data?.length === 0 && <p className="text-muted-foreground" data-testid="empty-roster">No outings in this range.</p>}
      {r.data?.map((e) => (
        <div key={e.launchId} className="rounded-lg bg-card p-4" data-testid={"roster-" + e.launchId}>
          <p className="font-serif text-xl">{fmtDate(e.date)} / {fmtShift(e.shift)} <span className="text-base text-muted-foreground">/ {e.boat.name}, {e.boat.type}</span></p>
          <ol className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {[...e.seats].sort((a, b) => a.position - b.position).map((s) => (
              <li key={s.position} className="flex justify-between border-b border-border/60 py-1">
                <span className="text-muted-foreground">{s.position}. {s.label}</span>
                <span className={s.occupied ? "font-medium" : "text-muted-foreground/60"}>{s.occupied ? s.rowerName : "open"}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

function Security() {
  const m = useChangePassword();
  const [f, setF] = useState({ currentPassword: "", newPassword: "", newPasswordConfirm: "" });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null); setOk(false);
    const p = passwordProblems(f.newPassword);
    if (p.length) return setError("New password needs " + p.join(", ") + ".");
    if (f.newPassword !== f.newPasswordConfirm) return setError("Passwords do not match.");
    m.mutate({ data: f }, {
      onSuccess: () => { setOk(true); setF({ currentPassword: "", newPassword: "", newPasswordConfirm: "" }); },
      onError: (er) => setError(errMsg(er)),
    });
  };
  return (
    <form onSubmit={submit} className="max-w-sm space-y-3">
      <div className="space-y-1.5"><Label htmlFor="c-cur">Current password</Label><Input id="c-cur" type="password" value={f.currentPassword} onChange={set("currentPassword")} required autoComplete="current-password" data-testid="input-current-password" /></div>
      <div className="space-y-1.5"><Label htmlFor="c-new">New password</Label><Input id="c-new" type="password" value={f.newPassword} onChange={set("newPassword")} required autoComplete="new-password" data-testid="input-new-password" /></div>
      <div className="space-y-1.5"><Label htmlFor="c-conf">Confirm new password</Label><Input id="c-conf" type="password" value={f.newPasswordConfirm} onChange={set("newPasswordConfirm")} required autoComplete="new-password" data-testid="input-new-password-confirm" /></div>
      <Err m={error} />
      {ok && <p className="rounded-md bg-secondary px-3 py-2 text-sm" data-testid="text-password-changed">Password updated.</p>}
      <Button type="submit" disabled={m.isPending} data-testid="button-change-password">Change password</Button>
    </form>
  );
}

export default function Admin() {
  return (
    <Shell label="Administration">
      <Tabs defaultValue="overview">
        <TabsList className="mb-6 flex h-auto flex-wrap justify-start">
          {[["overview", "Overview"], ["boats", "Boats"], ["schedule", "Schedule"], ["rosters", "Rosters"], ["security", "Password"]].map(([v, l]) => (
            <TabsTrigger key={v} value={v} data-testid={"tab-" + v}>{l}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="boats"><Boats /></TabsContent>
        <TabsContent value="schedule"><Schedule /></TabsContent>
        <TabsContent value="rosters"><Rosters /></TabsContent>
        <TabsContent value="security"><Security /></TabsContent>
      </Tabs>
    </Shell>
  );
}
