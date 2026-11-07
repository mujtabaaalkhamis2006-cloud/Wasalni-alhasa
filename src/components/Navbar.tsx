import React, { useState, useEffect } from 'react';
import { User, ActivePresence } from '../types/transit';
import { Bus, UserCheck, Shield, LogOut, UserCircle, RefreshCw, Share2, Radio } from 'lucide-react';
import { transitStore } from '../services/transitStore';
import { LivePresenceModal } from './LivePresenceModal';

interface NavbarProps {
  currentUser: User | null;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onOpenShareModal: () => void;
  onQuickSwitchUser: (userId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onNavigate,
  onLogout,
  onOpenShareModal
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [presenceList, setPresenceList] = useState<ActivePresence[]>(() => transitStore.getActivePresence());
  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      setPresenceList(transitStore.getActivePresence());
    };
    const unsub = transitStore.subscribe(update);
    return unsub;
  }, []);

  const handleNavRefresh = () => {
    setIsRefreshing(true);
    transitStore.triggerRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => onNavigate('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-sky-600/30 group-hover:scale-105 transition-transform">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">وصلني في الأحساء</span>
                <span className="bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  النقل الذكي
                </span>
              </div>
              <p className="text-[11px] text-slate-400">شبكة النقل الذكي لواحة الأحساء</p>
            </div>
          </div>

          {/* Right Action buttons & Auth Status */}
          <div className="flex items-center gap-2">
            {/* Live Presence Device Badge */}
            <button
              onClick={() => setIsPresenceModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 text-xs font-bold hover:bg-emerald-900/60 transition-all shadow-sm"
              title="الأجهزة والمستخدمون المتصلون الآن عبر الشبكة"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">متصل الآن:</span>
              <span className="font-mono">{presenceList.length || 1}</span>
              <span className="hidden md:inline text-[10px] text-emerald-400/80">أجهزة 📡</span>
            </button>

            {/* Quick Refresh Button */}
            <button
              onClick={handleNavRefresh}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 text-sky-400 border border-slate-700 text-xs font-medium hover:bg-slate-700 transition-colors shadow-sm"
              title="تحديث الرحلات والبيانات فوراً"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>

            {/* Share App button */}
            <button
              onClick={onOpenShareModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 active:scale-95"
              title="مشاركة رابط التطبيق"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مشاركة</span>
            </button>

            {currentUser ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-xs">
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                    {currentUser.role === 'admin' ? (
                      <Shield className="w-3.5 h-3.5 text-rose-400" />
                    ) : currentUser.role === 'driver' ? (
                      <Bus className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-white text-xs leading-none">{currentUser.name.split(' ')[0]}</div>
                    <span className="text-[10px] text-slate-400">
                      {currentUser.role === 'admin'
                        ? 'إدارة'
                        : currentUser.role === 'driver'
                        ? 'سائق'
                        : 'راكب'}
                    </span>
                  </div>
                </div>

                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('/')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 shadow-sm transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                <span>دخول</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Cross-Device Connected Presence Modal */}
      <LivePresenceModal
        isOpen={isPresenceModalOpen}
        onClose={() => setIsPresenceModalOpen(false)}
        presenceList={presenceList}
      />
    </header>
  );
};
