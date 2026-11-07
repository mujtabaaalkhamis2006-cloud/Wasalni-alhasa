import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  Send,
  QrCode,
  X,
  ExternalLink,
  Edit2,
  Globe,
  Save,
  RefreshCw,
  Smartphone,
  Download,
  AlertCircle,
  Lock,
  Unlock,
  ShieldCheck,
  KeyRound
} from 'lucide-react';
import {
  getSavedShareUrl,
  setSavedShareUrl,
  getSavedApkUrl,
  setSavedApkUrl,
  PRIMARY_STUDIO_URL
} from '../utils/urlConfig';
import { User } from '../types/transit';
import { transitStore } from '../services/transitStore';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl?: string;
  currentUser?: User | null;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sharedUrl,
  currentUser
}) => {
  const currentBrowserOrigin =
    typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';

  // Track user & admin state
  const [storeUser, setStoreUser] = useState<User | null>(() => transitStore.getCurrentUser());
  const [adminUnlockedSession, setAdminUnlockedSession] = useState(false);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  const effectiveUser = currentUser || storeUser;
  const isLoggedAdmin = effectiveUser?.role === 'admin';
  const canEditApk = isLoggedAdmin || adminUnlockedSession;

  // Web Share URL state
  const [activeUrl, setActiveUrl] = useState<string>(() => sharedUrl || getSavedShareUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // APK Download URL state (Only Admin can edit)
  const [apkUrl, setApkUrl] = useState<string>(() => getSavedApkUrl());
  const [isEditingApkUrl, setIsEditingApkUrl] = useState<boolean>(false);
  const [copiedApk, setCopiedApk] = useState(false);
  const [saveApkSuccess, setSaveApkSuccess] = useState(false);
  const [apkError, setApkError] = useState<string | null>(null);

  const apkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleUrlUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveUrl(customEvent.detail);
      }
    };
    const handleApkUrlUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setApkUrl(customEvent.detail);
      }
    };

    window.addEventListener('alahsa_url_updated', handleUrlUpdate);
    window.addEventListener('alahsa_apk_url_updated', handleApkUrlUpdate);

    // Subscribe to store updates for role changes
    const unsub = transitStore.subscribe(() => {
      setStoreUser(transitStore.getCurrentUser());
    });

    return () => {
      window.removeEventListener('alahsa_url_updated', handleUrlUpdate);
      window.removeEventListener('alahsa_apk_url_updated', handleApkUrlUpdate);
      unsub();
    };
  }, []);

  // Admin Verification Handler
  const handleVerifyAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = adminPasswordInput.trim();
    if (pin === '123456' || pin === 'admin123' || pin === 'admin') {
      setAdminUnlockedSession(true);
      setShowAdminAuthModal(false);
      setIsEditingApkUrl(true);
      setAdminAuthError(null);
      setAdminPasswordInput('');
      setTimeout(() => apkInputRef.current?.focus(), 100);
    } else {
      setAdminAuthError('كلمة مرور الإدارة غير صحيحة، يرجى المحاولة مجدداً.');
    }
  };

  if (!isOpen) return null;

  const appTitle = 'وصلني في الأحساء | تطبيق النقل وحجز الرحلات';
  const shareText = `🚌 تطبيق "وصلني في الأحساء" للنقل العام والذكي\nاحجز مقعدك وتتبع مسار الحافلة ومواعيد الرحلات مباشرة في الأحساء (الهفوف، المبرز، جامعة الملك فيصل، محطة سار):`;
  const fullShareMessage = apkUrl.trim()
    ? `${shareText}\n${activeUrl}\n\nرابط تحميل APK المباشر:\n${apkUrl}`
    : `${shareText}\n${activeUrl}`;

  // Save Web URL
  const handleSaveUrl = (urlToSave: string) => {
    const trimmed = urlToSave.trim();
    if (trimmed) {
      setActiveUrl(trimmed);
      setSavedShareUrl(trimmed);
      setIsEditingUrl(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  // Save APK URL
  const handleSaveApkUrl = (urlToSave: string) => {
    const trimmed = urlToSave.trim();
    if (trimmed) {
      setApkUrl(trimmed);
      setSavedApkUrl(trimmed);
      setIsEditingApkUrl(false);
      setSaveApkSuccess(true);
      setApkError(null);
      setTimeout(() => setSaveApkSuccess(false), 2500);
    } else {
      setApkUrl('');
      setSavedApkUrl('');
      setIsEditingApkUrl(true);
    }
  };

  const copyToClipboard = (text: string, onDone: () => void) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      onDone();
    } catch {
      onDone();
    }
  };

  const handleCopyWebUrl = () => {
    copyToClipboard(activeUrl, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyApkUrl = () => {
    if (!apkUrl.trim()) {
      setIsEditingApkUrl(true);
      setApkError('يرجى وضع رابط التحميل أولاً ثم الضغط على حفظ');
      apkInputRef.current?.focus();
      return;
    }
    copyToClipboard(apkUrl, () => {
      setCopiedApk(true);
      setTimeout(() => setCopiedApk(false), 2500);
    });
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: appTitle,
          text: shareText,
          url: activeUrl
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyWebUrl();
    }
  };

  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullShareMessage)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(activeUrl)}`;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(activeUrl)}&text=${encodeURIComponent(shareText)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(activeUrl)}&margin=8`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-right max-h-[90vh] overflow-y-auto"
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600/20 text-sky-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">مشاركة تطبيق وصلني في الأحساء</h3>
              <p className="text-xs text-slate-400">شارك الرابط مع الركاب أو السائقين أو ضع رابط تحميل ملف الـ APK المباشر</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. SECTION: Web App Link Box (Just like before, editable by user) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>رابط المنصة والموقع (Web):</span>
            </label>
            <div className="flex items-center gap-2">
              {saveSuccess && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  تم الحفظ!
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isEditingUrl) {
                    handleSaveUrl(activeUrl);
                  } else {
                    setIsEditingUrl(true);
                  }
                }}
                className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 flex items-center gap-1 text-[11px] font-bold transition-all"
              >
                {isEditingUrl ? <Save className="w-3 h-3 text-emerald-400" /> : <Edit2 className="w-3 h-3" />}
                <span>{isEditingUrl ? 'حفظ الرابط' : 'تعديل الرابط'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl p-2 pr-3">
            <input
              type="text"
              readOnly={!isEditingUrl}
              value={activeUrl}
              onChange={(e) => setActiveUrl(e.target.value.trim())}
              placeholder="https://..."
              className={`bg-transparent text-xs text-sky-300 font-mono flex-1 outline-none select-all text-left ${
                isEditingUrl ? 'border-b border-sky-500 py-1 bg-slate-900/50 rounded px-2' : ''
              }`}
              dir="ltr"
            />
            {isEditingUrl ? (
              <button
                onClick={() => handleSaveUrl(activeUrl)}
                className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-all shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>حفظ</span>
              </button>
            ) : (
              <button
                onClick={handleCopyWebUrl}
                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/20'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم النسخ!' : 'نسخ الرابط'}</span>
              </button>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveUrl(PRIMARY_STUDIO_URL)}
                className="px-2 py-0.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] flex items-center gap-1"
                title="استعادة الرابط الأصلي"
              >
                <RefreshCw className="w-3 h-3 text-sky-400" />
                <span>الرابط الأساسي</span>
              </button>
              {currentBrowserOrigin && currentBrowserOrigin !== activeUrl && (
                <button
                  type="button"
                  onClick={() => handleSaveUrl(currentBrowserOrigin)}
                  className="px-2 py-0.5 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px]"
                >
                  استخدام رابط المتصفح
                </button>
              )}
            </div>

            <a
              href={activeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-bold underline mr-auto"
            >
              <span>فتح الموقع في صفحة جديدة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* 2. SECTION: Dedicated Download APK Box ("تحميل apk") - Only Admin can Edit */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-teal-950/40 border-2 border-emerald-500/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>خانة رابط تحميل ملف الـ APK:</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold">
                    APK
                  </span>
                  {canEditApk ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      إدارة النظام
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-400" />
                      خاص بالإدارة
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {canEditApk
                    ? 'بصفتك مسؤول الإدارة، يمكنك تعديل وحفظ رابط ملف الـ APK المباشر هنا'
                    : 'رابط التحميل المباشر لتطبيق وصلني في الأحساء المعتمَد من إدارة المنصة'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {saveApkSuccess && (
                <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" />
                  تم الحفظ بنجاح!
                </span>
              )}

              {canEditApk ? (
                <button
                  type="button"
                  onClick={() => {
                    if (isEditingApkUrl) {
                      handleSaveApkUrl(apkUrl);
                    } else {
                      setIsEditingApkUrl(true);
                      setTimeout(() => apkInputRef.current?.focus(), 50);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 text-[11px] font-bold transition-all"
                >
                  {isEditingApkUrl ? <Save className="w-3 h-3 text-emerald-400" /> : <Edit2 className="w-3 h-3" />}
                  <span>{isEditingApkUrl ? 'حفظ الرابط' : 'تعديل الرابط'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminAuthModal(true);
                    setAdminAuthError(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 text-[11px] font-bold transition-all"
                  title="تسجيل دخول الإدارة لتعديل الرابط"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>دخول الإدارة للتعديل</span>
                </button>
              )}
            </div>
          </div>

          {/* Inline Admin Verification Prompt */}
          {showAdminAuthModal && !canEditApk && (
            <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <KeyRound className="w-4 h-4" />
                  <span>التحقق من هوية الإدارة لتعديل الرابط</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                تعديل وتحديد رابط تحميل الـ APK مخصص لإدارة المنصة فقط. يرجى إدخال كلمة مرور الإدارة للمتابعة:
              </p>
              <form onSubmit={handleVerifyAdmin} className="flex items-center gap-2">
                <input
                  type="password"
                  value={adminPasswordInput}
                  onChange={(e) => {
                    setAdminPasswordInput(e.target.value);
                    if (adminAuthError) setAdminAuthError(null);
                  }}
                  placeholder="كلمة مرور الإدارة..."
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 flex-1 outline-none focus:border-amber-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition-all"
                >
                  تحقق وتفعيل
                </button>
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                >
                  إلغاء
                </button>
              </form>
              {adminAuthError && (
                <div className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{adminAuthError}</span>
                </div>
              )}
            </div>
          )}

          {/* APK URL Input */}
          <div className={`flex items-center gap-2 bg-slate-950 border rounded-2xl p-2 pr-3 ${
            canEditApk ? 'border-emerald-500/40' : 'border-slate-800'
          }`}>
            <input
              ref={apkInputRef}
              type="text"
              readOnly={!canEditApk || !isEditingApkUrl}
              value={apkUrl}
              onChange={(e) => {
                if (canEditApk) {
                  setApkUrl(e.target.value.trim());
                  if (apkError) setApkError(null);
                }
              }}
              placeholder={canEditApk ? 'ضع أو الصق رابط تحميل ملف الـ APK المباشر هنا...' : 'بانتظار تحديد رابط التحميل من إدارة المنصة'}
              className={`bg-transparent text-xs text-emerald-300 placeholder-slate-500 font-mono flex-1 outline-none text-left ${
                canEditApk && isEditingApkUrl ? 'border-b border-emerald-500 py-1 bg-slate-900/60 rounded px-2 select-all' : 'cursor-default'
              }`}
              dir="ltr"
            />
            {canEditApk && isEditingApkUrl ? (
              <button
                type="button"
                onClick={() => handleSaveApkUrl(apkUrl)}
                className="px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white transition-all shrink-0 shadow"
              >
                <Save className="w-4 h-4" />
                <span>حفظ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCopyApkUrl}
                className={`px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                  copiedApk
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700'
                }`}
              >
                {copiedApk ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedApk ? 'تم النسخ!' : 'نسخ'}</span>
              </button>
            )}
          </div>

          {apkError && (
            <div className="text-[11px] text-amber-300 flex items-center gap-1 bg-amber-950/40 border border-amber-800/60 p-2 rounded-xl">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{apkError}</span>
            </div>
          )}

          {/* Prominent "تحميل apk" Button */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {apkUrl.trim() ? (
              <a
                href={apkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition-all"
              >
                <Download className="w-4 h-4 animate-bounce" />
                <span>تحميل apk</span>
              </a>
            ) : canEditApk ? (
              <button
                type="button"
                onClick={() => {
                  setIsEditingApkUrl(true);
                  setApkError('بصفتك مسؤول الإدارة، الصق رابط الـ APK في الخانة أعلاه واضغط على "حفظ"');
                  apkInputRef.current?.focus();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 border border-emerald-500/50 text-emerald-300 font-black text-xs flex items-center justify-center gap-2 shadow transition-all"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>تحميل apk (انقر لتحديد رابط التحميل بصفتك إدارة)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 opacity-80 cursor-not-allowed"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>تحميل apk (بانتظار إضافة الرابط من إدارة المنصة)</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopyApkUrl}
              className={`py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                copiedApk
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {copiedApk ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedApk ? 'تم نسخ رابط APK!' : 'نسخ رابط APK'}</span>
            </button>
          </div>
        </div>

        {/* 3. SECTION: Quick Social Share Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">المشاركة المباشرة عبر التطبيقات:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* WhatsApp */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800/80 text-emerald-300 text-xs font-bold transition-all group hover:scale-[1.02]"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                <MessageCircle className="w-4 h-4" />
              </div>
              <span>واتساب WhatsApp</span>
            </a>

            {/* X / Twitter */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-200 text-xs font-bold transition-all group hover:scale-[1.02]"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-700/60 flex items-center justify-center text-white">
                <ExternalLink className="w-4 h-4" />
              </div>
              <span>منصة X (تويتر)</span>
            </a>

            {/* Telegram */}
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-sky-950/60 hover:bg-sky-900/60 border border-sky-800/80 text-sky-300 text-xs font-bold transition-all group hover:scale-[1.02]"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                <Send className="w-4 h-4" />
              </div>
              <span>تيليجرام</span>
            </a>

            {/* Native Mobile Share */}
            <button
              onClick={handleNativeShare}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-amber-950/50 hover:bg-amber-900/50 border border-amber-800/80 text-amber-300 text-xs font-bold transition-all group hover:scale-[1.02]"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <span>مشاركة الجوال</span>
            </button>
          </div>
        </div>

        {/* 4. SECTION: QR Code Section */}
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center gap-4">
          <div className="bg-white p-2 rounded-xl shadow-md shrink-0">
            <img
              src={qrCodeUrl}
              alt="QR Code"
              className="w-28 h-28 object-contain rounded"
              loading="lazy"
            />
          </div>
          <div className="space-y-1.5 text-center sm:text-right">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-amber-400">
              <QrCode className="w-4 h-4" />
              <span>امسح الرمز بكاميرا الجوال</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              يمكن لأي راكب أو سائق مسح الرمز بكاميرا هاتفه لفتح التطبيق فوراً والبدء بحجز المقاعد ومتابعة الحافلات.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <span className="text-[11px] text-slate-400">يعمل الرابط على أي متصفح هاتف أو كمبيوتر دون تحميل</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
