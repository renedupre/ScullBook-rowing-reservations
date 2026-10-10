import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { weekDates, type DayTotals } from "@/lib/overview";

interface Props {
  data: DayTotals[];
  weekStart: string;
  selectedDay: string | null;
  onSelectDay: (d: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onPickWeek: (d: string) => void;
  onReset: () => void;
}

const BOOKED = "hsl(var(--chart-1))";
const AVAILABLE = "hsl(var(--chart-4))";

function Tip({ active, payload }: { active?: boolean; payload?: { payload: DayTotals }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover p-3 text-sm" data-testid="chart-tooltip">
      <p className="font-medium">{format(parseISO(d.date), "EEE d MMM yyyy")}</p>
      <p>Booked: {d.booked}</p>
      <p>Available: {d.available}</p>
      <p>Total: {d.total}</p>
    </div>
  );
}

export function WeeklySeatChart({ data, weekStart, selectedDay, onSelectDay, onPrev, onNext, onPickWeek, onReset }: Props) {
  const dates = weekDates(weekStart);
  const empty = data.every((d) => d.total === 0);
  const pick = (d?: { date?: string; payload?: { date?: string } }) => {
    const v = d?.date ?? d?.payload?.date;
    if (v) onSelectDay(v);
  };
  return (
    <section className="space-y-4" aria-label="Seats by day" data-testid="chart-weekly-seats">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl">Seats by day</h3>
          <p className="text-sm text-muted-foreground" data-testid="text-week-range">
            Week of {format(parseISO(dates[0]), "d MMM")} to {format(parseISO(dates[6]), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" onClick={onPrev} data-testid="button-week-prev">Previous week</Button>
          <Button size="sm" variant="outline" onClick={onNext} data-testid="button-week-next">Next week</Button>
          <div className="space-y-1">
            <Label htmlFor="week-pick" className="text-xs">Pick a week</Label>
            <Input id="week-pick" type="date" className="h-9 w-40" value={weekStart}
              onChange={(e) => e.target.value && onPickWeek(e.target.value)} data-testid="input-week-pick" />
          </div>
          <Button size="sm" variant="ghost" onClick={onReset} data-testid="button-reset-filters">Reset filters</Button>
        </div>
      </div>

      <div className="h-64 w-full sm:h-72" role="img"
        aria-label={"Stacked bar chart of booked and available seats per day. " + data.map((d) => `${d.label}: ${d.booked} booked, ${d.available} available`).join("; ")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} tick={{ fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={44}
              label={{ value: "Seats", angle: -90, position: "insideLeft", style: { fontSize: 12, textAnchor: "middle" } }} />
            <Tooltip content={<Tip />} cursor={{ fill: "hsl(var(--muted))" }} />
            <Legend verticalAlign="top" height={28} />
            <Bar dataKey="booked" name="Booked" stackId="s" fill={BOOKED} cursor="pointer" onClick={pick} isAnimationActive={false} />
            <Bar dataKey="available" name="Available" stackId="s" fill={AVAILABLE} cursor="pointer" onClick={pick} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {empty && <p className="text-sm text-muted-foreground" data-testid="text-week-empty">No outings scheduled this week.</p>}

      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Select a day">
        {data.map((d) => {
          const on = d.date === selectedDay;
          return (
            <button key={d.date} type="button" aria-pressed={on} onClick={() => onSelectDay(d.date)}
              data-testid={"button-day-" + d.date}
              className={"rounded-md border px-1 py-2 text-center text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
                (on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted")}>
              <span className="block font-medium">{d.label}</span>
              <span className="block opacity-80">{d.total} seats</span>
            </button>
          );
        })}
      </div>

      <p className="text-sm" data-testid="text-selected-day" aria-live="polite">
        {selectedDay ? "Showing " + format(parseISO(selectedDay), "EEEE d MMMM yyyy") : "Showing all upcoming outings"}
      </p>
    </section>
  );
}
