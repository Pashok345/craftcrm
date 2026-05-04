import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { useAuth } from '@/hooks/useAuth';

export const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { user, profile, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Server-enforced gate: unverified self-registered users must complete approval flow
  if (profile && profile.is_verified === false) {
    return <Navigate to="/complete-profile" replace />;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header 
          profile={profile} 
          onSignOut={signOut} 
          onMobileMenuClick={() => setMobileSidebarOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 min-w-0">
          <div className="min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
      <AIAssistant />
    </div>
  );
};
