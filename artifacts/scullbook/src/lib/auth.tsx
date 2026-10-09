import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useLogout,
  touchSession,
  type User,
} from "@workspace/api-client-react";

export function useAuth() {
  const q = useGetCurrentUser({
    query: { queryKey: getGetCurrentUserQueryKey(), retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
  });
  return { user: (q.data ?? null) as User | null, isLoading: q.isLoading };
}

export function useSignedIn() {
  const qc = useQueryClient();
  return (user: User) => {
    qc.clear();
    qc.setQueryData<User | null>(getGetCurrentUserQueryKey(), user);
  };
}

export function useSignOut() {
  const qc = useQueryClient();
  const m = useLogout();
  const [, nav] = useLocation();
  return {
    pending: m.isPending,
    signOut: () =>
      m.mutate(undefined, {
        onSettled: () => {
          qc.clear();
          qc.setQueryData<User | null>(getGetCurrentUserQueryKey(), null);
          nav("/");
        },
      }),
  };
}

const IDLE_MS = 15 * 60 * 1000;
const EVENTS = ["click", "keydown", "scroll", "pointerdown", "pointermove", "touchstart"];

/** Logs the browser out after 15 minutes without user input. */
export function IdleGuard() {
  const { user } = useAuth();
  const { signOut } = useSignOut();
  const ref = useRef(signOut);
  ref.current = signOut;
  const signedIn = !!user;
  useEffect(() => {
    if (!signedIn) return;
    let t = window.setTimeout(() => ref.current(), IDLE_MS);
    let lastHeartbeat = Date.now();
    const reset = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => ref.current(), IDLE_MS);
      // Renew only on actual input, never on a background interval.
      if (Date.now() - lastHeartbeat > 60_000) {
        lastHeartbeat = Date.now();
        void touchSession().catch((error: { status?: number }) => {
          if (error.status === 401) ref.current();
        });
      }
    };
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true, capture: true }));
    return () => {
      window.clearTimeout(t);
      EVENTS.forEach((e) => window.removeEventListener(e, reset, { capture: true }));
    };
  }, [signedIn]);
  return null;
}
