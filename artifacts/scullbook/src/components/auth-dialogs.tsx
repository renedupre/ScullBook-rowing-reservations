import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useLogin, useRegisterRower } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSignedIn } from "@/lib/auth";
import { errMsg, passwordProblems } from "@/lib/util";

function Err({ msg }: { msg: string | null }) {
  return msg ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="text-form-error">{msg}</p> : null;
}

export function LoginDialog() {
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const m = useLogin();
  const signedIn = useSignedIn();
  const [, nav] = useLocation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    m.mutate({ data: { login: login.trim(), password } }, {
      onSuccess: (r) => { signedIn(r.user); setOpen(false); nav(r.user.role === "admin" ? "/admin" : "/rower"); },
      onError: (er) => setError(errMsg(er)),
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setError(null); setPassword(""); } }}>
      <DialogTrigger asChild><Button variant="ghost" className="text-white hover:bg-white/15 hover:text-white" data-testid="button-open-login">Login</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Back to the water</DialogTitle>
          <DialogDescription>Sign in with your email, or your administrator ID.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="l-login">Email or ID</Label>
            <Input id="l-login" value={login} onChange={(e) => setLogin(e.target.value)} required autoComplete="username" data-testid="input-login" /></div>
          <div className="space-y-1.5"><Label htmlFor="l-pw">Password</Label>
            <Input id="l-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" data-testid="input-password" /></div>
          <Err msg={error} />
          <Button type="submit" className="w-full" disabled={m.isPending} data-testid="button-submit-login">{m.isPending ? "Signing in..." : "Login"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RegisterDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", password: "", passwordConfirm: "" });
  const [error, setError] = useState<string | null>(null);
  const m = useRegisterRower();
  const signedIn = useSignedIn();
  const [, nav] = useLocation();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const problems = passwordProblems(f.password);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (problems.length) return setError("Password needs " + problems.join(", ") + ".");
    if (f.password !== f.passwordConfirm) return setError("Passwords do not match.");
    m.mutate({ data: { ...f, email: f.email.trim(), firstName: f.firstName.trim(), lastName: f.lastName.trim() } }, {
      onSuccess: (r) => { signedIn(r.user); setOpen(false); nav("/rower"); },
      onError: (er) => setError(errMsg(er)),
    });
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setError(null); }}>
      <DialogTrigger asChild><Button className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-open-register">Register</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-3xl">Join the crew</DialogTitle>
          <DialogDescription>Create a rower account. You will be signed in straight away.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="r-fn">First name</Label><Input id="r-fn" value={f.firstName} onChange={set("firstName")} required maxLength={80} data-testid="input-first-name" /></div>
            <div className="space-y-1.5"><Label htmlFor="r-ln">Last name</Label><Input id="r-ln" value={f.lastName} onChange={set("lastName")} required maxLength={80} data-testid="input-last-name" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="r-em">Email</Label><Input id="r-em" type="email" value={f.email} onChange={set("email")} required autoComplete="email" data-testid="input-email" /></div>
          <div className="space-y-1.5"><Label htmlFor="r-pw">Password</Label><Input id="r-pw" type="password" value={f.password} onChange={set("password")} required autoComplete="new-password" data-testid="input-new-password" />
            <p className="text-xs text-muted-foreground">{f.password && problems.length ? "Still needs " + problems.join(", ") : "10+ characters with upper, lower, number and symbol."}</p></div>
          <div className="space-y-1.5"><Label htmlFor="r-pc">Confirm password</Label><Input id="r-pc" type="password" value={f.passwordConfirm} onChange={set("passwordConfirm")} required autoComplete="new-password" data-testid="input-confirm-password" /></div>
          <Err msg={error} />
          <Button type="submit" className="w-full" disabled={m.isPending} data-testid="button-submit-register">{m.isPending ? "Creating..." : "Create account"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
