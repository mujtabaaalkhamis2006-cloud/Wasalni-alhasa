import React, { useState, useEffect } from 'react';
import { transitStore } from './services/transitStore';
import { User, TransitRoute, Trip, Announcement } from './types/transit';
import { Navbar } from './components/Navbar';
import { AuthForms } from './components/AuthForms';
import { PassengerDashboard } from './components/PassengerDashboard';
import { DriverDashboard } from './components/DriverDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ShareModal } from './components/ShareModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(transitStore.getCurrentUser());
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  });
  const [routes, setRoutes] = useState<TransitRoute[]>(transitStore.getRoutes());
  const [trips, setTrips] = useState<Trip[]>(transitStore.getAllTrips());
  const [announcement, setAnnouncement] = useState<Announcement>(transitStore.getAnnouncement());
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Sync state with transit store
  useEffect(() => {
    const syncState = () => {
      setCurrentUser(transitStore.getCurrentUser());
      setRoutes(transitStore.getRoutes());
      setTrips(transitStore.getAllTrips());
      setAnnouncement(transitStore.getAnnouncement());
    };

    const unsub = transitStore.subscribe(syncState);
    return unsub;
  }, []);

  // Handle browser popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Navigation handler that updates address bar
  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    try {
      window.history.pushState({}, '', path);
    } catch (e) {
      // ignore
    }
  };

  const handleLogout = () => {
    transitStore.logout();
    setCurrentUser(null);
    handleNavigate('/');
  };

  const handleQuickSwitchUser = (userId: string) => {
    transitStore.switchUser(userId);
    const u = transitStore.getCurrentUser();
    setCurrentUser(u);
    if (u?.role === 'admin') {
      handleNavigate('/admin-login.html');
    } else if (u?.role === 'driver') {
      handleNavigate('/driver-login.html');
    } else {
      handleNavigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Tajawal',sans-serif] selection:bg-sky-500 selection:text-white" dir="rtl">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        currentPath={currentPath}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onQuickSwitchUser={handleQuickSwitchUser}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentUser ? (
          /* Role Guard: If logged in, open respective dashboard directly per requirement */
          currentUser.role === 'admin' ? (
            <AdminDashboard currentUser={currentUser} routes={routes} trips={trips} />
          ) : currentUser.role === 'driver' ? (
            <DriverDashboard currentUser={currentUser} routes={routes} />
          ) : (
            <PassengerDashboard currentUser={currentUser} routes={routes} trips={trips} />
          )
        ) : (
          /* If not logged in, render Auth & Registration forms for the route */
          <AuthForms
            currentPath={currentPath}
            announcement={announcement}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              if (user.role === 'admin') handleNavigate('/admin-login.html');
              else if (user.role === 'driver') handleNavigate('/driver-login.html');
              else handleNavigate('/');
            }}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      {/* Share App modal */}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} />

      {/* Modern Footer */}
      <footer className="bg-slate-900/60 border-t border-slate-800/80 py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-300">حافلات الأحساء © 2026</span>
            <span>·</span>
            <span>نظام النقل الترددي العام</span>
            <span>·</span>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="text-sky-400 hover:text-sky-300 font-bold underline underline-offset-4"
            >
              مشاركة التطبيق
            </button>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>الهفوف · المبرز · جامعة الملك فيصل · محطة قطار سار · الكلية التقنية · جبل القارة · العيون</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
