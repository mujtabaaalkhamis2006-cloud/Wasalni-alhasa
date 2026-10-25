import React, { useState } from 'react';
import { User } from '../types/transit';
import { Bus, UserCheck, Shield, LogOut, UserCircle, RefreshCw, Share2, Menu, X, KeyRound, UserPlus } from 'lucide-react';
import { transitStore } from '../services/transitStore';

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
  currentPath,
  onNavigate,
  onLogout,
  onOpenShareModal
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavRefresh = () => {
    setIsRefreshing(true);
    transitStore.triggerRefresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const handleMobileNav = (path: string) => {
    setIsMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => handleMobileNav('/')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-sky-600/30 group-hover:scale-105 transition-transform">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">حافلات الأحساء</span>
                <span className="bg-sky-500/10 border border-sky-500/30 text-sky-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                  النقل العام
                </span>
              </div>
              <p className="text-[11px] text-slate-400">شبكة النقل الذكي لواحة الأحساء</p>
            </div>
          </div>

          {/* Desktop Direct URLs Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5">
            <button
              onClick={() => onNavigate('/')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentPath === '/'
                  ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              الرئيسية
            </button>
            <button
              onClick={() => onNavigate('/driver-register.html')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentPath === '/driver-register.html'
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              تسجيل سائق (/driver-register.html)
            </button>
            <button
              onClick={() => onNavigate('/driver-login.html')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentPath === '/driver-login.html'
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              دخول السائق (/driver-login.html)
            </button>
            <button
              onClick={() => onNavigate('/admin-login.html')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                currentPath === '/admin-login.html'
                  ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              دخول الإدارة (/admin-login.html)
            </button>
          </nav>

          {/* Right Action buttons & Auth Status */}
          <div className="flex items-center gap-2">
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
                onClick={() => handleMobileNav('/')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-bold hover:bg-sky-500 shadow-sm transition-colors"
              >
                <UserCircle className="w-4 h-4" />
                <span>دخول</span>
              </button>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white border border-slate-700 lg:hidden"
              title="القائمة"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dedicated Quick-Action Bar: Always accessible on phones */}
        <div className="lg:hidden py-2 border-t border-slate-800/80 flex items-center justify-between gap-1.5 overflow-x-auto text-[11px]">
          <button
            onClick={() => handleMobileNav('/')}
            className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition-all ${
              currentPath === '/'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            الرئيسية
          </button>
          <button
            onClick={() => handleMobileNav('/driver-register.html')}
            className={`px-3 py-1 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1 ${
              currentPath === '/driver-register.html'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>تسجيل سائق</span>
          </button>
          <button
            onClick={() => handleMobileNav('/driver-login.html')}
            className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all flex items-center gap-1 ${
              currentPath === '/driver-login.html'
                ? 'bg-amber-600 text-white font-bold'
                : 'bg-slate-800 text-amber-400 hover:bg-slate-700'
            }`}
          >
            <Bus className="w-3.5 h-3.5" />
            <span>دخول السائق</span>
          </button>
          <button
            onClick={() => handleMobileNav('/admin-login.html')}
            className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-all flex items-center gap-1 ${
              currentPath === '/admin-login.html'
                ? 'bg-rose-600 text-white font-bold'
                : 'bg-slate-800 text-rose-400 hover:bg-slate-700'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>الإدارة</span>
          </button>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-800 space-y-1.5 animate-in slide-in-from-top duration-200">
            <button
              onClick={() => handleMobileNav('/')}
              className="w-full text-right px-3.5 py-2 rounded-xl text-xs font-bold text-white hover:bg-slate-800 flex items-center justify-between"
            >
              <span>الرئيسية (لوحة الراكب والرحلات)</span>
              <span className="text-[10px] text-slate-500" dir="ltr">/</span>
            </button>
            <button
              onClick={() => handleMobileNav('/driver-register.html')}
              className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black text-amber-300 bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/50 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Bus className="w-4 h-4 text-amber-400" />
                <span>تسجيل سائق جديد وبيانات الحافلة</span>
              </div>
              <span className="text-[10px] text-amber-400" dir="ltr">/driver-register.html</span>
            </button>
            <button
              onClick={() => handleMobileNav('/driver-login.html')}
              className="w-full text-right px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>دخول السائق المعتمد</span>
              </div>
              <span className="text-[10px] text-slate-500" dir="ltr">/driver-login.html</span>
            </button>
            <button
              onClick={() => handleMobileNav('/admin-login.html')}
              className="w-full text-right px-3.5 py-2 rounded-xl text-xs font-bold text-rose-300 hover:text-white hover:bg-slate-800 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span>دخول الإدارة المركزية</span>
              </div>
              <span className="text-[10px] text-slate-500" dir="ltr">/admin-login.html</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
