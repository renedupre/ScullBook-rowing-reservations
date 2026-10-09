import { useEffect, type ReactNode } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Splash from '@/pages/splash';
import Rower from '@/pages/rower';
import Admin from '@/pages/admin';
import { IdleGuard, useAuth } from '@/lib/auth';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

function handleSessionError(error: unknown) {
  const failure = error as { status?: number; url?: string };
  if (failure.status === 401 && !failure.url?.includes('/auth/login')) {
    // A cached identity must not leave an expired/blocked session in the admin UI.
    queryClient.setQueryData(getGetCurrentUserQueryKey(), null);
  }
}
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleSessionError }),
  mutationCache: new MutationCache({ onError: handleSessionError }),
  defaultOptions: {
    queries: { retry: (count, error) => (error as { status?: number }).status !== 401 && count < 2 },
  },
});

function Guard({ role, children }: { role: 'admin' | 'rower'; children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const [, nav] = useLocation();
  const allowed = !!user && user.role === role;
  useEffect(() => {
    if (isLoading) return;
    if (!user) nav('/');
    else if (user.role !== role) nav(user.role === 'admin' ? '/admin' : '/rower');
  }, [user, isLoading, role, nav]);
  if (!allowed) return <div className="min-h-[100dvh] bg-background" aria-busy="true" />;
  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  useEffect(() => {
    const title = location === '/admin' ? 'Club administration' : location === '/rower' ? 'My rowing reservations' : 'Find your place in the crew';
    document.title = `${title} | ScullBook`;
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      location === '/admin' ? 'Configure the ScullBook fleet, schedule rowing dates, and view crew rosters.' :
      location === '/rower' ? 'Reserve your scull seat and manage your upcoming rowing dates.' :
      'Choose your seat in the crew. ScullBook makes rowing club reservations simple.');
  }, [location]);
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Splash} />
        <Route path="/rower">
          <Guard role="rower"><Rower /></Guard>
        </Route>
        <Route path="/admin">
          <Guard role="admin"><Admin /></Guard>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <IdleGuard />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
