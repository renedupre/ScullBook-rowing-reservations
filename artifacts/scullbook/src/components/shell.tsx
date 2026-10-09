import { type ReactNode } from "react";
import { Link } from "wouter";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useSignOut } from "@/lib/auth";

export function Shell({ children, label }: { children: ReactNode; label: string }) {
  const { user } = useAuth();
  const { signOut, pending } = useSignOut();
  return (
    <div className="min-h-[100dvh]">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/" className="flex items-baseline gap-3" data-testid="link-home">
            <span className="font-serif text-2xl font-semibold tracking-tight">ScullBook</span>
            <span className="hidden text-xs uppercase tracking-[0.25em] text-primary-foreground/60 sm:inline">{label}</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-primary-foreground/80" data-testid="text-username">
              {user?.firstName} {user?.lastName}
            </span>
            <Button size="sm" variant="secondary" disabled={pending} onClick={signOut} data-testid="button-logout">
              <LogOut className="mr-1 h-4 w-4" /> Log out
            </Button>
          </div>
        </div>
        <div className="h-1.5 bg-accent" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
