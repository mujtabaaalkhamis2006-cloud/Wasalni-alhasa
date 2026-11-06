import React, { useState, useEffect } from 'react';
import { transitStore } from '../services/transitStore';
import { User, Announcement } from '../types/transit';
import {
  Bus,
  UserPlus,
  LogIn,
  Shield,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  Lock,
  User as UserIcon,
  Truck,
  Hash,
  Users,
  KeyRound
} from 'lucide-react';

interface AuthFormsProps {
  currentPath: string;
  announcement: Announcement;
  onLoginSuccess: (user: User) => void;
  onNavigate: (path: string) => void;
}

export const AuthForms: React.FC<AuthFormsProps> = ({
  currentPath,
  announcement,
  onLoginSuccess,
  onNavigate
}) => {
  // Determine initial role and tab based on current path
  const initialRole: 'passenger' | 'driver' =
    currentPath === '/driver-login.html' || currentPath === '/driver-register.html'
      ? 'driver'
      : 'passenger';

  const initialTab: 'login' | 'register' =
    currentPath === '/driver-register.html' ? 'register' : 'login';

  const [authRole, setAuthRole] = useState<'passenger' | 'driver'>(initialRole);
  const [authTab, setAuthTab] = useState<'login' | 'register'>(initialTab);

  // Synchronize state if URL path changes externally
  useEffect(() => {
    if (currentPath === '/driver-register.html') {
      setAuthRole('driver');
      setAuthTab('register');
    } else if (currentPath === '/driver-login.html') {
      setAuthRole('driver');
      setAuthTab('login');
    } else if (currentPath === '/') {
      // Keep selected role or default to passenger
    }
  }, [currentPath]);

  // Form input states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Driver bus details
  const [plateNumber, setPlateNumber] = useState('');
  const [model, setModel] = useState('');
  const [seatsCount, setSeatsCount] = useState<number>(24);
  const [busType, setBusType] = useState('حافلة نقل جماعي مكيفة');

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Clear messages when switching tabs or roles
  const resetFeedback = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // General Passenger Login
  const handlePassengerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.loginAsync(identifier, password, 'passenger');
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
    }
  };

  // Passenger Register
  const handlePassengerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.registerPassenger(name, phone, email, password);
    await transitStore.syncWithServer();
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'حدث خطأ أثناء إنشاء الحساب');
    }
  };

  // Driver Login
  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.loginAsync(identifier, password, 'driver');
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
    }
  };

  // Driver Register
  const handleDriverRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.registerDriver({
      name,
      phone,
      email,
      pass: password,
      plateNumber,
      model,
      seatsCount,
      busType
    });
    await transitStore.syncWithServer();
    setIsLoading(false);

    if (result.success) {
      setSuccessMsg('تم إرسال طلب تسجيل السائق والحافلة بنجاح! سيبقى الحساب قيد المراجعة (معلّق) حتى توافق الإدارة.');
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setPlateNumber('');
      setModel('');
    } else {
      setErrorMsg(result.error || 'حدث خطأ أثناء إرسال طلب تسجيل السائق');
    }
  };

  // Admin tab & name states for /admin-login.html
  const [adminTab, setAdminTab] = useState<'login' | 'register'>('login');
  const [adminName, setAdminName] = useState('');

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.loginAsync(identifier, password, 'admin');
    setIsLoading(false);

    if (result.success && result.user) {
      if (adminName.trim()) {
        transitStore.updateAdminName(result.user.id, adminName.trim());
      }
      onLoginSuccess(transitStore.getCurrentUser() || result.user);
    } else {
      setErrorMsg(result.error || 'بيانات دخول الإدارة غير صحيحة');
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    resetFeedback();

    const result = await transitStore.registerAdmin(adminName, phone, email, password);
    await transitStore.syncWithServer();
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'حدث خطأ أثناء تسجيل حساب الإدارة');
    }
  };

  // 1. Dedicated Admin Page (/admin-login.html)
  if (currentPath === '/admin-login.html') {
    return (
      <div className="max-w-lg mx-auto py-10 px-4 sm:px-6">
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-center text-white mb-1">إدارة العمليات المركزية</h2>
          <p className="text-xs text-center text-slate-400 mb-6">شبكة وصلني في الأحساء - تسجيل ودخول مسؤولي الإدارة</p>

          <div className="flex p-1 bg-slate-800/80 rounded-xl mb-6">
            <button
              onClick={() => {
                setAdminTab('login');
                resetFeedback();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'login'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول الإدارة</span>
            </button>
            <button
              onClick={() => {
                setAdminTab('register');
                resetFeedback();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'register'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>تسجيل مسؤول إدارة جديد</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3.5 mb-6 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {adminTab === 'register' ? (
            <form onSubmit={handleAdminRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">اسم مسؤول الإدارة الكامل *</label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="مثال: م. عبدالمحسن البشير"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني الرسمي *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@hasa-transit.sa"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'جاري التسجيل...' : 'تسجيل حساب واعتماد اسم مسؤول الإدارة'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني أو رقم الجوال</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="admin@hasa-bus.sa أو 0500000001"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 text-sm"
              >
                {isLoading ? 'جاري التحقق...' : 'دخول لوحة الإدارة'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            الرجوع إلى{' '}
            <button
              onClick={() => onNavigate('/')}
              className="text-sky-400 font-bold hover:underline"
            >
              الصفحة الرئيسية وحسابات الركاب والسائقين
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Unified Registration & Login View for Both Passenger and Driver on the SAME page
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {/* Realtime Announcement Banner */}
      {announcement?.active && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-sky-500/20 to-emerald-500/20 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <span className="font-bold text-white ml-2">إعلان هام:</span>
              <span>{announcement.text}</span>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 font-mono">
            {new Date(announcement.publishedAt).toLocaleDateString('ar-SA')}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Hero side */}
        <div className="md:col-span-5 lg:col-span-6 space-y-4 text-right pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-400 text-xs font-semibold">
            <Bus className="w-3.5 h-3.5" />
            <span>نظام النقل الترددي الأحدث في واحة الأحساء</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            تنقل بذكاء وسرعة بين مدن وقرى <span className="text-sky-400">الأحساء</span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            منصة موحدة لحجز مقاعد الركاب ولتسجيل وانطلاق سائقي الحافلات. تنقل بسهولة بين جامعة الملك فيصل ومحطة قطار سار وسوق القيصرية وجبل القارة والمبرز ومطار الأحساء، مع تتبع حي ومباشر للحافلات عبر الأجهزة.
          </p>

          <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>تتبع GPS حي ومباشر</span>
              </div>
              <div className="text-slate-400">تحديث فوري لموقع الحافلة الفعلي عبر Supabase</div>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>تسجيل موحد للسائق والراكب</span>
              </div>
              <div className="text-slate-400">من نفس الصفحة بضغطة زر واحدة بكل سهولة</div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-2 text-xs text-slate-400">
            <div className="font-bold text-white text-xs flex items-center gap-1.5">
              <Bus className="w-4 h-4 text-amber-400" />
              <span>مسارات الأحساء المعتمدة:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-sky-300 border border-slate-700">مسار 101: الهفوف - المبرز</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 border border-slate-700">مسار 102: جامعة الملك فيصل</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-purple-300 border border-slate-700">مسار 103: سار - المطار</span>
              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">مسار 104: جبل القارة</span>
            </div>
          </div>
        </div>

        {/* Right Form Card: Unified Passenger & Driver Register and Login */}
        <div className="md:col-span-7 lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* 1. Primary Role Switcher: Passenger vs Driver */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold text-slate-400 mb-2">نوع الحساب:</label>
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAuthRole('passenger');
                  resetFeedback();
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  authRole === 'passenger'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/30 ring-2 ring-sky-400/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>👤 أنا راكب (Passenger)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAuthRole('driver');
                  resetFeedback();
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  authRole === 'driver'
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Bus className="w-4 h-4" />
                <span>🚌 أنا كابتن حافلة (Driver)</span>
              </button>
            </div>
          </div>

          {/* 2. Secondary Tab Switcher: Login vs Register */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                resetFeedback();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authTab === 'login'
                  ? authRole === 'driver'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{authRole === 'driver' ? 'دخول السائق' : 'دخول الراكب'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                resetFeedback();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                authTab === 'register'
                  ? authRole === 'driver'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                    : 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{authRole === 'driver' ? 'تسجيل سائق جديد' : 'تسجيل راكب جديد'}</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 mb-5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 mb-5 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* =================== PASSENGER VIEWS =================== */}
          {authRole === 'passenger' && authTab === 'login' && (
            <form onSubmit={handlePassengerLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال أو البريد</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="0544455566 أو بريدك"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'جاري التحقق...' : 'دخول للوحة الراكب'}</span>
              </button>
            </form>
          )}

          {authRole === 'passenger' && authTab === 'register' && (
            <form onSubmit={handlePassengerRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="مثال: أحمد العبدالعزيز"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'جاري التسجيل...' : 'تسجيل حساب راكب جديد'}</span>
              </button>
            </form>
          )}

          {/* =================== DRIVER VIEWS =================== */}
          {authRole === 'driver' && authTab === 'login' && (
            <form onSubmit={handleDriverLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
                <Bus className="w-4 h-4 text-amber-400 shrink-0" />
                <span>دخول كباتن وسائقي "وصلني في الأحساء" المعتمدين من الإدارة</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال أو البريد</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    placeholder="0554433221 أو fahad@driver.sa"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'جاري التحقق...' : 'دخول لوحة السائق'}</span>
              </button>
            </form>
          )}

          {authRole === 'driver' && authTab === 'register' && (
            <form onSubmit={handleDriverRegister} className="space-y-3.5">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>ملاحظة تنظيمية:</strong> بعد إرسال الطلب، يبقى حساب السائق قيد المراجعة <strong>(معلّق - pending)</strong> حتى توافق عليه الإدارة وتعتمد الحافلة.
                </span>
              </div>

              <div className="border-b border-slate-800 pb-2 mb-2">
                <h4 className="text-xs font-bold text-sky-400 mb-2">1. بيانات السائق الشخصية</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">الاسم الثلاثي *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="مثال: صالح محمد الهاشم"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="driver@hasa-bus.sa"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور *</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-amber-400 mb-2">2. بيانات الحافلة المخصصة</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">رقم لوحة الحافلة *</label>
                    <input
                      type="text"
                      required
                      value={plateNumber}
                      onChange={e => setPlateNumber(e.target.value)}
                      placeholder="مثال: أ ح س 4022"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">موديل الحافلة والمصنع *</label>
                    <input
                      type="text"
                      required
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="مثال: مرسيدس توريزمو 2024"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">سعة المقاعد *</label>
                    <input
                      type="number"
                      required
                      min={10}
                      max={60}
                      value={seatsCount}
                      onChange={e => setSeatsCount(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 text-left"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">نوع الحافلة</label>
                    <select
                      value={busType}
                      onChange={e => setBusType(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="حافلة نقل جماعي مكيفة">حافلة نقل جماعي مكيفة (عادية)</option>
                      <option value="حافلة كبار الشخصيات VIP">حافلة فاخرة VIP</option>
                      <option value="حافلة كهربائية صديقة للبيئة">حافلة كهربائية صديقة للبيئة</option>
                      <option value="ميني باص تردد سريع">ميني باص تردد سريع</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm mt-2 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'جاري الإرسال...' : 'إرسال طلب تسجيل السائق (Pending)'}</span>
              </button>
            </form>
          )}

          {/* Quick link to admin operations */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span>مسؤولو إدارة العمليات:</span>
            <button
              type="button"
              onClick={() => onNavigate('/admin-login.html')}
              className="text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 hover:underline"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>دخول الإدارة (/admin-login.html)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
