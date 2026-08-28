import { Suspense } from "react";
import { lazyWithRetry as lazy } from "@/lib/lazyWithRetry";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CompleteProfile from "./pages/CompleteProfile";
import NotFound from "./pages/NotFound";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";

// Heavy / less frequently used routes are code-split
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const CreateTask = lazy(() => import("./pages/CreateTask"));
const EditTask = lazy(() => import("./pages/EditTask"));
const Meetings = lazy(() => import("./pages/Meetings"));
const Users = lazy(() => import("./pages/Users"));
const Projects = lazy(() => import("./pages/Projects"));
const CreateProject = lazy(() => import("./pages/CreateProject"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const Messages = lazy(() => import("./pages/Messages"));
const Processes = lazy(() => import("./pages/Processes"));
const ProcessEditor = lazy(() => import("./pages/ProcessEditor"));
const RunProcess = lazy(() => import("./pages/RunProcess"));
const ProcessRunEdit = lazy(() => import("./pages/ProcessRunEdit"));
const ProcessRunDetail = lazy(() => import("./pages/ProcessRunDetail"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Sales = lazy(() => import("./pages/Sales"));
const CreateDeal = lazy(() => import("./pages/CreateDeal"));
const DealDetail = lazy(() => import("./pages/DealDetail"));
const Whiteboards = lazy(() => import("./pages/Whiteboards"));
const Wiki = lazy(() => import("./pages/Wiki"));
const WikiArticle = lazy(() => import("./pages/WikiArticle"));
const WikiArticleEdit = lazy(() => import("./pages/WikiArticleEdit"));
const WhiteboardDetail = lazy(() => import("./pages/WhiteboardDetail"));
const AuditLog = lazy(() => import("./pages/AuditLog"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex justify-center py-16">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/complete-profile" element={<CompleteProfile />} />
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/new" element={<CreateTask />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/tasks/:id/edit" element={<EditTask />} />
              <Route path="/meetings" element={<Meetings />} />
              <Route path="/users" element={<Users />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/new" element={<CreateProject />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/processes" element={<Processes />} />
              <Route path="/processes/new" element={<ProcessEditor />} />
              <Route path="/processes/:id/edit" element={<ProcessEditor />} />
              <Route path="/processes/run/:id" element={<RunProcess />} />
              <Route path="/processes/runs/:id" element={<ProcessRunDetail />} />
              <Route path="/processes/runs/:id/edit" element={<ProcessRunEdit />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/sales/deals/new" element={<CreateDeal />} />
              <Route path="/sales/deals/:id" element={<DealDetail />} />
              <Route path="/sales/deals/:id/edit" element={<CreateDeal />} />
              <Route path="/wiki" element={<Wiki />} />
              <Route path="/wiki/new" element={<WikiArticleEdit />} />
              <Route path="/wiki/:id" element={<WikiArticle />} />
              <Route path="/wiki/:id/edit" element={<WikiArticleEdit />} />
              <Route path="/whiteboards" element={<Whiteboards />} />
              <Route path="/whiteboards/:id" element={<WhiteboardDetail />} />
              <Route path="/audit-log" element={<AuditLog />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/messages" element={<Messages />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
