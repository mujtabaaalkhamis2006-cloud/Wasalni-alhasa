import React from 'react';
import { AlertTriangle, Trash2, XCircle, CheckCircle, Info } from 'lucide-react';

export interface ConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmModalProps {
  dialog: ConfirmDialogState | null;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ dialog, onClose }) => {
  if (!dialog || !dialog.isOpen) return null;

  const type = dialog.type || 'danger';

  const icon =
    type === 'danger' ? (
      <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
        <Trash2 className="w-6 h-6" />
      </div>
    ) : type === 'warning' ? (
      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
        <AlertTriangle className="w-6 h-6" />
      </div>
    ) : (
      <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
        <Info className="w-6 h-6" />
      </div>
    );

  const confirmBtnClass =
    type === 'danger'
      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
      : type === 'warning'
      ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-600/30'
      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/30';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5 text-right"
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          {icon}
          <div className="flex-1">
            <h3 className="text-lg font-black text-white">{dialog.title}</h3>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{dialog.message}</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={() => {
              if (dialog.onCancel) dialog.onCancel();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
          >
            {dialog.cancelLabel || 'إلغاء الأمر'}
          </button>
          <button
            type="button"
            onClick={() => {
              dialog.onConfirm();
              onClose();
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 ${confirmBtnClass}`}
          >
            {type === 'danger' && <Trash2 className="w-3.5 h-3.5" />}
            {dialog.confirmLabel || 'تأكيد التنفيذ'}
          </button>
        </div>
      </div>
    </div>
  );
};
