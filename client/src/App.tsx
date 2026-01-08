import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import VenturrDetail from "@/pages/venturr-detail";
import Profile from "@/pages/profile";
import Search from "@/pages/search";
import SavedPosts from "@/pages/saved-posts";
import Landing from "@/pages/landing";
import PublicPlan from "@/pages/public-plan";
import PublicVenturr from "@/pages/public-venturr";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={Search} />
      <Route path="/profile" component={Profile} />
      <Route path="/saved" component={SavedPosts} />
      <Route path="/venturr/:id" component={VenturrDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isLoading, isAuthenticated } = useAuth();
  const [location] = useLocation();

  // Public routes don't require auth
  if (location.startsWith('/plan/')) {
    return (
      <Switch>
        <Route path="/plan/:slug" component={PublicPlan} />
      </Switch>
    );
  }

  if (location.startsWith('/v/')) {
    return (
      <Switch>
        <Route path="/v/:slug" component={PublicVenturr} />
      </Switch>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <AuthenticatedRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
