'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

type AlertTone = 'success' | 'error' | 'warning' | 'info';

type AlertItem = {
  id: number;
  message: string;
  tone: AlertTone;
};

const getAlertTone = (message: string): AlertTone => {
  const text = message.toLowerCase();
  if (text.includes('thành công') || text.includes('success') || text.includes('hoàn tất')) return 'success';
  if (text.includes('lỗi') || text.includes('thất bại') || text.includes('không thể') || text.includes('error')) return 'error';
  if (text.includes('vui lòng') || text.includes('cảnh báo') || text.includes('thiếu')) return 'warning';
  return 'info';
};

const toneStyles: Record<AlertTone, { border: string; iconBg: string; iconText: string; title: string }> = {
  success: {
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-50',
    iconText: 'text-emerald-600',
    title: 'Thành công',
  },
  error: {
    border: 'border-rose-100',
    iconBg: 'bg-rose-50',
    iconText: 'text-rose-600',
    title: 'Có lỗi xảy ra',
  },
  warning: {
    border: 'border-amber-100',
    iconBg: 'bg-amber-50',
    iconText: 'text-amber-600',
    title: 'Cần kiểm tra',
  },
  info: {
    border: 'border-blue-100',
    iconBg: 'bg-blue-50',
    iconText: 'text-[#21398A]',
    title: 'Thông báo',
  },
};

const AlertIcon = ({ tone }: { tone: AlertTone }) => {
  if (tone === 'success') return <CheckCircle size={18} />;
  if (tone === 'error') return <XCircle size={18} />;
  if (tone === 'warning') return <AlertCircle size={18} />;
  return <Info size={18} />;
};

export default function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const nextIdRef = useRef(1);
  const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }
    setAlerts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showAlert = useCallback((rawMessage?: unknown) => {
    const message = String(rawMessage ?? '').trim() || 'Có thông báo mới.';
    const id = nextIdRef.current++;
    const item: AlertItem = {
      id,
      message,
      tone: getAlertTone(message),
    };

    setAlerts((prev) => [...prev.slice(-3), item]);
    timersRef.current[id] = setTimeout(() => dismiss(id), 3200);
  }, [dismiss]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      showAlert(message);
    };

    return () => {
      window.alert = originalAlert;
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [showAlert]);

  return (
    <>
      {children}
      {mounted && createPortal(
        <div className="fixed top-5 right-5 z-[99999] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3 pointer-events-none">
          {alerts.map((item) => {
            const style = toneStyles[item.tone];
            return (
              <div
                key={item.id}
                className={`pointer-events-auto flex items-start gap-3 rounded-2xl border ${style.border} bg-white p-4 shadow-2xl animate-slide-in`}
              >
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${style.iconBg} ${style.iconText}`}>
                  <AlertIcon tone={item.tone} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-slate-800">{style.title}</div>
                  <div className="mt-1 whitespace-pre-line break-words text-xs font-semibold leading-relaxed text-slate-500">
                    {item.message}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-slate-50 hover:text-slate-500"
                  aria-label="Đóng thông báo"
                >
                  <X size={16} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
