import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/lib/store";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Layout from "@/components/layout";
import CreateRequestPage from "@/pages/create-request";
import RequestDetailsPage from "@/pages/request-details";
import ReportsDashboard from "@/pages/reports/index";
import SettingsDashboard from "@/pages/settings/index";

function Router() {
  const { currentUser, isLoading } = useApp();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/login" component={() => <AuthPage />} />
      <Route path="/create" component={() => <Layout><CreateRequestPage /></Layout>} />
      <Route path="/requests" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/requests/:id">{(params) => <Layout><RequestDetailsPage id={params.id} /></Layout>}</Route>
      <Route path="/reports" component={() => <Layout><ReportsDashboard /></Layout>} />
      <Route path="/settings" component={() => <Layout><SettingsDashboard /></Layout>} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppProvider>
          <Toaster />
          <Router />
        </AppProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
