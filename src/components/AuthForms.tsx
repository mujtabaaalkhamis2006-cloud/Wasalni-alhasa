import React, { useState } from 'react';
import { transitStore } from '../services/transitStore';
import { User, Announcement } from '../types/transit';
import { Bus, UserPlus, LogIn, Shield, CheckCircle, AlertCircle, Sparkles, Phone, Mail, Lock, User as UserIcon } from 'lucide-react';

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
  // Tabs for default home view: 'login' or 'register'
  const [passengerTab, setPassengerTab] = useState<'login' | 'register'>('login');

  // Form states
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

  // Clear messages on path change
  const resetForm = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // General Passenger Login
  const handlePassengerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

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
    setErrorMsg(null);

    const result = await transitStore.registerPassenger(name, phone, email, password);
    await transitStore.syncWithServer();
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'حدث خطأ أثناء إنشاء الحساب');
    }
  };

  // Driver Login (/driver-login.html)
  const handleDriverLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const result = await transitStore.loginAsync(identifier, password, 'driver');
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
    }
  };

  // Driver Register (/driver-register.html)
  const handleDriverRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

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
      setSuccessMsg('تم إرسال طلب تسجيل السائق والحافلة بنجاح! سيبقى الحساب قيد المراجعة (pending) حتى توافق الإدارة.');
      // Clear inputs
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      setPlateNumber('');
      setModel('');
    } else {
      setErrorMsg(result.error || 'حدث خطأ في التسجيل');
    }
  };

  // Admin tab & name states
  const [adminTab, setAdminTab] = useState<'login' | 'register'>('login');
  const [adminName, setAdminName] = useState('');

  // Admin Login (/admin-login.html)
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const result = await transitStore.loginAsync(identifier, password, 'admin');
    setIsLoading(false);

    if (result.success && result.user) {
      if (adminName.trim()) {
        transitStore.updateAdminName(result.user.id, adminName.trim());
      }
      onLoginSuccess(transitStore.getCurrentUser() || result.user);
    } else {
      setErrorMsg(result.error || 'بيانات الدخول غير صحيحة، يرجى التأكد والمحاولة مرة أخرى');
    }
  };

  // Admin Register (/admin-login.html)
  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const result = await transitStore.registerAdmin(adminName, phone, email, password);
    await transitStore.syncWithServer();
    setIsLoading(false);

    if (result.success && result.user) {
      onLoginSuccess(result.user);
    } else {
      setErrorMsg(result.error || 'حدث خطأ أثناء تسجيل حساب الإدارة');
    }
  };

  // 1. Driver Register View
  if (currentPath === '/driver-register.html') {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">تسجيل سائق جديد لحافلات الأحساء</h2>
              <p className="text-xs text-slate-400">انضم لأسطول حافلات واحة الأحساء وقدم خدمات النقل الذكي</p>
            </div>
          </div>

          <div className="p-3.5 mb-6 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>ملاحظة تنظيمية:</strong> بعد إرسال الطلب، يبقى حساب السائق الجديد بحالة <strong>معلّق (pending)</strong> حتى تتم مراجعته واعتماده من قبل الإدارة المركزية.
            </span>
          </div>

          {successMsg && (
            <div className="p-4 mb-6 rounded-xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 mb-6 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleDriverRegister} className="space-y-4">
            <div className="border-b border-slate-800 pb-3 mb-3">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3">1. البيانات الشخصية للسائق</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">الاسم الثلاثي *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="مثال: صالح محمد الهاشم"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-left"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-left"
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
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-1">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-3">2. بيانات الحافلة المخصصة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">رقم لوحة الحافلة *</label>
                  <input
                    type="text"
                    required
                    value={plateNumber}
                    onChange={e => setPlateNumber(e.target.value)}
                    placeholder="مثال: أ ح س 4412"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">موديل الحافلة وطرازها *</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={e => setModel(e.target.value)}
                    placeholder="مرسيدس سيتارو / هيونداي 2024"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">عدد المقاعد الإجمالي *</label>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    required
                    value={seatsCount}
                    onChange={e => setSeatsCount(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">نوع وتجهيز الحافلة</label>
                  <input
                    type="text"
                    value={busType}
                    onChange={e => setBusType(e.target.value)}
                    placeholder="مكيفة، كاميرات مراقبة، شاشات"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-4 bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-bold py-3 rounded-xl hover:from-amber-500 hover:to-amber-400 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading ? 'جاري الإرسال...' : 'إرسال طلب تسجيل السائق (Pending)'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-400">
            لديك حساب سائق معتمد بالفعل؟{' '}
            <button
              onClick={() => onNavigate('/driver-login.html')}
              className="text-amber-400 font-bold hover:underline"
            >
              سجل الدخول من هنا
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Driver Login View
  if (currentPath === '/driver-login.html') {
    return (
      <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
        <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
            <Bus className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-center text-white mb-1">دخول السائقين</h2>
          <p className="text-xs text-center text-slate-400 mb-6">لوحة متابعة رحلات وركاب حافلات الأحساء</p>

          {errorMsg && (
            <div className="p-3.5 mb-6 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleDriverLogin} className="space-y-4">
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
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 text-sm"
            >
              {isLoading ? 'جاري التحقق...' : 'دخول لوحة السائق'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
            سائق جديد؟{' '}
            <button
              onClick={() => onNavigate('/driver-register.html')}
              className="text-amber-400 font-bold hover:underline"
            >
              سجّل بياناتك وحافلتك من هنا (تتطلب موافقة الإدارة)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Admin Login & Registration View (/admin-login.html)
  if (currentPath === '/admin-login.html') {
    return (
      <div className="max-w-lg mx-auto py-10 px-4 sm:px-6">
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-500/30">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-center text-white mb-1">إدارة العمليات المركزية</h2>
          <p className="text-xs text-center text-slate-400 mb-6">شبكة حافلات الأحساء - تسجيل ودخول مسؤولي الإدارة</p>

          {/* Admin Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-800/80 rounded-2xl border border-slate-700 mb-6">
            <button
              type="button"
              onClick={() => {
                setAdminTab('login');
                resetForm();
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                adminTab === 'login'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول حساب إدارة</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminTab('register');
                resetForm();
              }}
              className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
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
            /* Admin Register Form with Mandatory Name Field */
            <form onSubmit={handleAdminRegister} className="space-y-4">
              <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-300">
                <strong>تسجيل حساب مسؤول إدارة جديد:</strong> قم بتعبئة اسمك وبياناتك الرسمية لتسجيلها واعتمادها في لوحة التحكم المركزية.
              </div>

              <div>
                <label className="block text-xs font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-rose-400" />
                  <span>اسم مسؤول الإدارة الكامل * (خانة تسجيل الاسم)</span>
                </label>
                <input
                  type="text"
                  required
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="مثال: م. فهد العبدالله (مسؤول العمليات)"
                  className="w-full bg-slate-800 border border-rose-500/50 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">رقم الجوال الإداري *</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني الإداري *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin.name@hasa-bus.sa"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور المشفرة *</label>
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
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isLoading ? 'جاري التسجيل...' : 'تسجيل حساب واعتماد اسم مسؤول الإدارة'}</span>
              </button>
            </form>
          ) : (
            /* Admin Login Form with optional/editable name confirmation */
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">البريد الإلكتروني الإداري</label>
                <input
                  type="email"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="admin@hasa-bus.sa"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">كلمة المرور المشفرة</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
                  <span>تأكيد / تسجيل اسم المدير في هذه الجلسة (اختياري):</span>
                  <span className="text-[10px] text-rose-400">حفظ الاسم الرسمي</span>
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={e => setAdminName(e.target.value)}
                  placeholder="أدخل اسمك لتحديثه في لوحة الإدارة..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoading ? 'جاري التحقق...' : 'دخول لوحة التحكم المركزية'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 4. Default Home View: Passenger Register / General Login + Announcement
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
      {/* General Announcement from Admin */}
      {announcement.active && announcement.text && (
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-sky-950/80 via-slate-900 to-teal-950/80 border border-sky-500/40 shadow-xl flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-sky-400 mb-0.5">إعلان عام للركاب والجمهور</div>
            <p className="text-sm text-slate-200 font-medium leading-relaxed">{announcement.text}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left Hero side */}
        <div className="md:col-span-6 space-y-4 text-right">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-950/70 border border-sky-800/60 text-sky-400 text-xs font-semibold">
            <Bus className="w-3.5 h-3.5" />
            <span>نظام النقل الترددي الأحدث في واحة الأحساء</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            تنقل بذكاء وسرعة بين مدن وقرى <span className="text-sky-400">الأحساء</span>
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            احجز مقعدك بضغطة زر من جامعة الملك فيصل ومحطة القطار وسوق القيصرية وجبل القارة والمبرز ومطار الأحساء. أسعار تبدأ من 4 إلى 8 ريال كحد أقصى مع تتبع حي للحافلات.
          </p>

          <div className="pt-2 grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="font-bold text-sky-400 mb-1">تتبع مباشر 10s</div>
              <div className="text-slate-400">مواقع الحافلات محدثة لحظياً كل 10 ثواني</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="font-bold text-emerald-400 mb-1">سقف السعر 8 ريال</div>
              <div className="text-slate-400">أسعار مدعومة لجميع أهالي وزوار الواحة</div>
            </div>
          </div>
        </div>

        {/* Right Form Card: Passenger Login & Register */}
        <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          {/* Segmented control tabs */}
          <div className="flex p-1 bg-slate-800/80 rounded-xl mb-6">
            <button
              onClick={() => {
                setPassengerTab('login');
                resetForm();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                passengerTab === 'login'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>دخول عام</span>
            </button>
            <button
              onClick={() => {
                setPassengerTab('register');
                resetForm();
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                passengerTab === 'register'
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>تسجيل راكب جديد</span>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 mb-5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {passengerTab === 'login' ? (
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
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50 text-sm"
              >
                {isLoading ? 'جاري التحقق...' : 'دخول للوحة الراكب'}
              </button>
            </form>
          ) : (
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
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-sky-600/20 disabled:opacity-50 text-sm mt-2"
              >
                {isLoading ? 'جاري التسجيل...' : 'تسجيل حساب راكب جديد'}
              </button>
            </form>
          )}

          {/* Driver Registration Quick Box for Mobile & Desktop */}
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                <Bus className="w-4 h-4" />
                <span>سائق حافلة جديد بالأحساء؟</span>
              </span>
              <span className="text-[10px] text-slate-500 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">تتطلب اعتماد الإدارة</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              سجّل بياناتك وبيانات حافلتك للانضمام إلى أسطول النقل الترددي وإطلاق رحلاتك للركاب.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('/driver-register.html')}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل سائق جديد وبيانات الحافلة</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/driver-login.html')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>دخول السائق</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
