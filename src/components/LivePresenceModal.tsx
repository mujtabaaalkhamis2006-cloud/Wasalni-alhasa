import React from 'react';
import { ActivePresence } from '../types/transit';
import { Smartphone, Laptop, Tablet, Bus, Shield, User, Radio, X, MapPin, Sparkles, CheckCircle } from 'lucide-react';
import { transitStore } from '../services/transitStore';

interface LivePresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  presenceList: ActivePresence[];
}

export const LivePresenceModal: React.FC<LivePresenceModalProps> = ({
  isOpen,
  onClose,
  presenceList
}) => {
  if (!isOpen) return null;

  const currentSessionId = transitStore.getSessionId();
  const driversCount = presenceList.filter(p => p.role === 'driver').length;
  const passengersCount = presenceList.filter(p => p.role === 'passenger').length;
  const adminCount = presenceList.filter(p => p.role === 'admin').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-base font-black text-white">
                  الأجهزة والمستخدمون المتصلون الآن بالمنصة
                </h3>
              </div>
              <p className="text-[11px] text-slate-400">
                بث مباشر فوري عبر كافة الهواتف والحواسيب الذكية بواحة الأحساء
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Counters summary */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/50">
            <div className="text-[10px] text-amber-300 font-bold mb-0.5">سائقون متصلون 🚌</div>
            <div className="text-lg font-black text-white">{driversCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-sky-950/30 border border-sky-800/50">
            <div className="text-[10px] text-sky-300 font-bold mb-0.5">ركاب متصلون 👤</div>
            <div className="text-lg font-black text-white">{passengersCount}</div>
          </div>
          <div className="p-3 rounded-2xl bg-rose-950/30 border border-rose-800/50">
            <div className="text-[10px] text-rose-300 font-bold mb-0.5">إدارة العمليات 🛡️</div>
            <div className="text-lg font-black text-white">{adminCount}</div>
          </div>
        </div>

        {/* Supabase Status Banner */}
        {(() => {
          const sbStatus = transitStore.getSupabaseStatus();
          return (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-sky-950/30 to-slate-900 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${sbStatus.isConnected ? 'bg-emerald-400 animate-ping' : sbStatus.isConfigured ? 'bg-amber-400 animate-pulse' : 'bg-sky-400'}`} />
                <span className="font-bold text-white">
                  {sbStatus.isConnected
                    ? 'شبكة المزامنة الفورية نشطة: Supabase Realtime (WebSockets) ⚡'
                    : sbStatus.isConfigured
                    ? 'جاري الربط مع قنوات Supabase Realtime... 🔄'
                    : 'نظام المزامنة: يقرأ تلقائياً SUPABASE_URL و SUPABASE_ANON_KEY من Vercel 🚀'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {sbStatus.isConfigured ? 'Supabase Connected 🟢' : 'Vercel Env Ready ⚡'}
              </span>
            </div>
          );
        })()}

        {/* Presence List */}
        <div className="space-y-2.5">
          <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>قائمة الأجهزة النشطة حالياً ({presenceList.length}):</span>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Supabase WebSockets Realtime ⚡</span>
            </span>
          </div>

          {presenceList.length === 0 ? (
            <div className="p-8 text-center bg-slate-800/40 border border-slate-800 rounded-2xl text-xs text-slate-400">
              جاري فحص وتحديث الأجهزة المتصلة عبر Supabase...
            </div>
          ) : (
            presenceList.map(item => {
              const isCurrent = item.sessionId === currentSessionId;
              const isDriver = item.role === 'driver';
              const isAdmin = item.role === 'admin';
              const isTablet = item.deviceType === 'tablet';
              const isDesktop = item.deviceType === 'desktop';

              return (
                <div
                  key={item.sessionId}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-wrap items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-slate-800/80 border-amber-500/50 shadow-md'
                      : isDriver
                      ? 'bg-amber-950/20 border-amber-800/40'
                      : isAdmin
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : 'bg-slate-800/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        isDriver
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : isAdmin
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}
                    >
                      {isDesktop ? (
                        <Laptop className="w-5 h-5" />
                      ) : isTablet ? (
                        <Tablet className="w-5 h-5" />
                      ) : (
                        <Smartphone className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">{item.userName}</span>
                        {isCurrent && (
                          <span className="text-[10px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.2 rounded">
                            جهازك الحالي ★
                          </span>
                        )}
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isDriver
                              ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                              : isAdmin
                              ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                              : 'bg-sky-950 text-sky-300 border border-sky-700/60'
                          }`}
                        >
                          {isDriver ? 'سائق حافلة 🚌' : isAdmin ? 'إدارة 🛡️' : 'راكب 👤'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                        <span>الجهاز: <strong className="text-slate-300">{item.deviceName}</strong></span>
                        <span>•</span>
                        <span>الحالة: <strong className="text-emerald-400">{item.statusText || 'متصل الآن 🟢'}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-left">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-1 rounded-xl">
                      متصل الآن 🟢
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span>بمجرد تسجيل الدخول من أي هاتف أو كمبيوتر، تظهر الحالة فوراً للجميع.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
