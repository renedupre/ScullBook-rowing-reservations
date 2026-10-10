import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Seat } from "@workspace/api-client-react";

export function BoatSeatLayout({ seats, octuple, variant = "rower", isDisabled, isSelected, onSelect, note }: {
  seats: Seat[]; octuple: boolean; variant?: "rower" | "admin";
  isDisabled: (s: Seat) => boolean; isSelected: (s: Seat) => boolean;
  onSelect: (s: Seat) => void; note?: ReactNode;
}) {
  const sorted = [...seats].sort((a, b) => a.position - b.position);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="mb-1 flex min-w-max justify-between px-6 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        <span>Stern</span><span>Bow</span>
      </div>
      <div className="relative flex min-w-max items-center gap-2 rounded-[3rem] border-2 border-primary/70 bg-secondary/50 px-8 py-6">
        <div className="absolute left-6 right-6 top-1/2 h-px bg-primary/20" />
        {sorted.map((s, i) => {
          const forward = octuple && s.position === 1;
          const Dir = forward ? ArrowRight : ArrowLeft;
          const isSel = isSelected(s);
          const admin = variant === "admin";
          const look = admin
            ? (isSel
              ? "-translate-y-1 scale-105 border-accent bg-accent text-accent-foreground"
              : "border-primary bg-card text-primary hover:-translate-y-1")
            : (s.occupied
              ? "stripe cursor-not-allowed border-border bg-muted text-muted-foreground"
              : isSel
                ? "-translate-y-1 scale-105 border-accent bg-accent text-accent-foreground"
                : "border-primary bg-card text-primary hover:-translate-y-1");
          return (
            <button
              key={s.position}
              type="button"
              disabled={isDisabled(s)}
              onClick={() => onSelect(s)}
              title={s.occupied ? (s.rowerName ?? "Taken") : s.label}
              aria-label={`Seat ${s.position}, ${s.label}: ${s.occupied ? s.rowerName ?? "Occupied" : "Available"}`}
              aria-pressed={isSel}
              data-testid={"seat-" + s.position}
              style={{ animationDelay: i * 40 + "ms" }}
              className={"rise relative z-10 flex min-h-32 w-24 flex-col items-center justify-between gap-1 rounded-xl border-2 px-1 py-2 text-center transition-transform duration-200 disabled:cursor-not-allowed " + look}
            >
              <span className="font-serif text-lg leading-none">{s.position}</span>
              <Dir className="h-4 w-4" aria-hidden />
              <span className="text-[10px] font-medium leading-tight">{s.label}</span>
              <span className="w-full break-words text-xs font-medium leading-tight" data-testid={"seat-name-" + s.position}>{s.occupied ? s.rowerName : "Open"}</span>
            </button>
          );
        })}
      </div>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
