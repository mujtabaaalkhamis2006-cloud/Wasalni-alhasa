import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, MessageCircle, Send, QrCode, X, ExternalLink, Edit2, Globe, Save, RefreshCw, Smartphone } from 'lucide-react';
import { getSavedShareUrl, setSavedShareUrl, PRIMARY_STUDIO_URL } from '../utils/urlConfig';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sharedUrl
}) => {
  const currentBrowserOrigin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : '';
  const [activeUrl, setActiveUrl] = useState<string>(() => sharedUrl || getSavedShareUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const handleUrlUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveUrl(customEvent.detail);
      }
    };
    window.addEventListener('alahsa_url_updated', handleUrlUpdate);
    return () => window.removeEventListener('alahsa_url_updated', handleUrlUpdate);
  }, []);

  if (!isOpen) return null;

  const appTitle = 'حافلات الأحساء | Al-Ahsa Buses Transit';
  const shareText = `🚌 تطبيق حافلات الأحساء للنقل العام\nاحجز مقعدك وتتبع مسار الحافلة ومواعيد الرحلات مباشرة في الأحساء (الهفوف، المبرز، جامعة الملك فيصل، محطة سار):`;
  const fullShareMessage = `${shareText}\n${activeUrl}`;

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

  const handleCopy = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(activeUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = activeUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
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
        // User cancelled or not supported
      }
    } else {
      handleCopy();
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
              <h3 className="text-base font-black text-white">مشاركة تطبيق حافلات الأحساء</h3>
              <p className="text-xs text-slate-400">شارك الرابط مع الركاب أو السائقين لفتح التطبيق مباشرة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share Link Box with Edit & Copy */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>رابط التطبيق:</span>
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
                onClick={handleCopy}
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

          {/* Quick Actions & Direct Test Link */}
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
              className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-bold underline"
            >
              <span>فتح الرابط في صفحة جديدة</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Quick Social Share Buttons */}
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

        {/* QR Code Section */}
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
              يمكن لأي راكب أو زميل مسح الرمز بكاميرا هاتفه لفتح التطبيق فوراً والبدء بحجز المقاعد ومتابعة الحافلات.
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
