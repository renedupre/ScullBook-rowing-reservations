import { Link } from "wouter";
import { LoginDialog, RegisterDialog } from "@/components/auth-dialogs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const steps = [
  ["Pick a date", "See every upcoming outing and which boat is going out."],
  ["Choose your seat", "From coxswain to bow, tap the exact place you want in the crew."],
  ["Show up at the dock", "Your seat is held. Cancel any time if plans change."],
];

export default function Splash() {
  const { user } = useAuth();
  return (
    <div className="min-h-[100dvh]">
      <section className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-primary text-white">
        <img src={import.meta.env.BASE_URL + "splash.jpg"} alt="A nine-person scull gliding across a misty lake at dawn" className="drift absolute inset-0 h-full w-full scale-110 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/40 to-primary/30" />
        <nav className="relative z-10 flex items-center justify-end gap-2 p-4 sm:p-6">
          {user ? (
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href={user.role === "admin" ? "/admin" : "/rower"} data-testid="link-dashboard">Open dashboard</Link>
            </Button>
          ) : (<><LoginDialog /><RegisterDialog /></>)}
        </nav>
        <div className="relative z-10 mt-auto px-6 pb-16 sm:px-12">
          <p className="rise mb-3 text-xs uppercase tracking-[0.35em] text-white/70">Rowing club bookings</p>
          <h1 className="rise font-serif text-[clamp(3.5rem,14vw,10rem)] font-semibold leading-[0.9] tracking-tight" data-testid="text-title">ScullBook</h1>
          <p className="rise mt-5 max-w-xl text-lg text-white/85" style={{ animationDelay: "150ms" }}>
            Nine seats, one boat, one dawn. Choose exactly where you sit in the crew.
          </p>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-10 px-6 py-20 md:grid-cols-3">
        {steps.map(([t, d], i) => (
          <div key={t} className="border-t-2 border-accent pt-4">
            <span className="font-serif text-4xl text-accent">{i + 1}</span>
            <h2 className="mt-2 font-serif text-2xl">{t}</h2>
            <p className="mt-2 text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
