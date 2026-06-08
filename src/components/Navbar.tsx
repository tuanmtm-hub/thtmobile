'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import Breadcrumb from '@/components/Breadcrumb';
import {
  Bell,
  Repeat,
  LogOut,
  Key,
  ChevronDown,
  ChevronLeft,
  User,
  Check,
  X,
  ShieldAlert,
  Clock,
  Menu,
} from 'lucide-react';

interface NotificationItem {
  id: string;
  category: 'transfer_request' | 'trial_eval' | 'general';
  icon: string;
  title: string;
  body: string;
  timestamp: number;
  timeLabel?: string;
  hsName?: string;
  oldClass?: string;
  newClass?: string;
  note?: string;
  className?: string;
  dueCount?: number;
}

export default function Navbar() {
  const { user, logout, updatePassword } = useAuth();
  const { breadcrumbs } = useBreadcrumb();
  const [lang, setLang] = useState('vi');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const [showTrialDropdown, setShowTrialDropdown] = useState(false);
  const [showBellDropdown, setShowBellDropdown] = useState(false);

  // Loading indicator for action processes
  const [actionLoading, setActionLoading] = useState(false);

  // Toast states for Approval/Rejection notifications
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successTitle, setSuccessTitle] = useState('Thành công!');
  const [toastType, setToastType] = useState<'success' | 'reject'>('success');

  const triggerToast = (title: string, msg: string, type: 'success' | 'reject') => {
    setSuccessTitle(title);
    setSuccessMessage(msg);
    setToastType(type);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 2000);
  };

  // Change Password Modal States
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Dropdown refs for click-outside handlers
  const userRef = useRef<HTMLDivElement>(null);
  const transferRef = useRef<HTMLDivElement>(null);
  const trialRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load language preference
    const savedLang = localStorage.getItem('appLang') || 'vi';
    setLang(savedLang);

    // Initial notifications load
    if (user?.email) {
      loadAllNotifications();
    }

    // Refresh notifications every 60 seconds
    const interval = setInterval(() => {
      if (user?.email) {
        loadAllNotifications();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (userRef.current && !userRef.current.contains(target)) setShowUserMenu(false);
      if (transferRef.current && !transferRef.current.contains(target)) setShowTransferDropdown(false);
      if (trialRef.current && !trialRef.current.contains(target)) setShowTrialDropdown(false);
      if (bellRef.current && !bellRef.current.contains(target)) setShowBellDropdown(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) return null;

  const userPerms = user.permissions || {};
  const isAdmin = user.role === 'Admin' || userPerms['perm_admin'] === true;
  const isConsultantDept = String(user.department || '').trim().toLowerCase() === 'tư vấn';
  const isITDept = String(user.department || '').trim().toLowerCase() === 'it';
  const hasApproveTransferPerm = userPerms['perm_student_approve_transfer_trial_esl'] || userPerms['perm_student_approve_transfer_trial_efl'];

  const loadAllNotifications = async () => {
    try {
      const email = user.email;
      const combinedNotifs: NotificationItem[] = [];

      // 1. Fetch dismissed keys from server
      let dismissedList: string[] = [];
      try {
        const resDismissed = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/notifications',
            action: 'getDismissedNotifications',
            email,
          }),
        });
        if (resDismissed.ok) {
          const dataDismissed = await resDismissed.json();
          if (dataDismissed.success && Array.isArray(dataDismissed.data)) {
            dismissedList = dataDismissed.data;
          }
        }
      } catch (err) {
        console.error('Error fetching dismissed list:', err);
      }

      // Helper to check if item is dismissed
      const isDismissed = (id: string) => dismissedList.includes(id);

      // 2. Fetch pending transfer requests if authorized
      if (isAdmin || hasApproveTransferPerm) {
        try {
          const res = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: '/api/v1/notifications',
              action: 'getPendingTransferRequests',
              email,
            }),
          });
          if (res.ok) {
            const result = await res.json();
            if (result.success && Array.isArray(result.data)) {
              // Apply ESL/EFL authorization logic
              const canESL = userPerms['perm_student_approve_transfer_trial_esl'] || isAdmin;
              const canEFL = userPerms['perm_student_approve_transfer_trial_efl'] || isAdmin;

              const filtered = result.data.filter((req: any) => {
                return (req.newClassBlock === 'ESL' && canESL) ||
                  (req.newClassBlock === 'EFL' && canEFL);
              });

              filtered.forEach((req: any) => {
                if (!isDismissed(req.id)) {
                  combinedNotifs.push({
                    id: req.id,
                    category: 'transfer_request',
                    icon: '🔄',
                    title: `Yêu cầu chuyển lớp: ${req.studentName}`,
                    body: `Từ ${req.oldClass} ➔ ${req.newClass}${req.note ? `\nLý do: ${req.note}` : ''}`,
                    timestamp: req.timestamp || Date.now(),
                    timeLabel: req.time,
                    hsName: req.studentName,
                    oldClass: req.oldClass,
                    newClass: req.newClass,
                    note: req.note,
                  });
                }
              });
            }
          }
        } catch (err) {
          console.error('Error fetching transfer requests:', err);
        }
      }

      // 3. Fetch trial evaluations
      try {
        const trialAction = (isAdmin || isConsultantDept || isITDept) ? 'getAllTrialNotifications' : 'getTrialNotificationsForTeacher';
        const res = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/notifications',
            action: trialAction,
            email,
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (result.success && Array.isArray(result.data)) {
            result.data.forEach((item: any) => {
              if (item.students && Array.isArray(item.students)) {
                item.students.forEach((student: any) => {
                  const id = `trial_eval_${item.className}_${student.name}`;
                  if (!isDismissed(id)) {
                    combinedNotifs.push({
                      id,
                      category: 'trial_eval',
                      icon: '⚠️',
                      title: `Đánh giá học thử — ${student.name}`,
                      body: `Lớp ${item.className}: Đã học ${student.count} buổi.`,
                      timestamp: item.timestamp || Date.now(),
                      className: item.className,
                      dueCount: student.count,
                      hsName: student.name,
                    });
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('Error fetching trial evals:', err);
      }

      // 4. Fetch general notifications (absence alert or new student notification)
      // New student alerts
      try {
        const resNew = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/notifications',
            action: 'getTrialNotificationsForTeacher',
            email,
          }),
        });
        if (resNew.ok) {
          const result = await resNew.json();
          if (result.success && Array.isArray(result.data)) {
            result.data.forEach((item: any) => {
              if (item.students && Array.isArray(item.students)) {
                item.students.forEach((student: any) => {
                  const id = `newstudent_${item.className}_${student.name}`;
                  if (!isDismissed(id)) {
                    combinedNotifs.push({
                      id,
                      category: 'general',
                      icon: '📋',
                      title: `Học sinh mới — ${item.className}`,
                      body: `${student.name}${student.isTrial ? ' (Học thử)' : ''} vừa được thêm vào lớp!`,
                      timestamp: item.timestamp || Date.now(),
                    });
                  }
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('Error fetching new student alerts:', err);
      }

      // Absence alerts for all users
      try {
        const resAbs = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/notifications',
            action: 'getAbsenceNotifications',
            email,
          }),
        });
        if (resAbs.ok) {
          const result = await resAbs.json();
          if (result.success && Array.isArray(result.data)) {
            result.data.forEach((item: any) => {
              const id = `absence_${item.className}`;
              if (!isDismissed(id)) {
                const names = item.students.map((s: any) => `${s.name} (${s.phone || 'Không SĐT'}) — nghỉ ${s.count} buổi`).join(', ');
                combinedNotifs.push({
                  id,
                  category: 'general',
                  icon: '🚨',
                  title: `HS nghỉ liên tiếp — ${item.className}`,
                  body: `${item.students.length} HS nghỉ liên tiếp: ${names}`,
                  timestamp: item.timestamp || Date.now(),
                });
              }
            });
          }
        }
      } catch (err) {
        console.error('Error fetching absence alerts:', err);
      }

      // Sort notifications by timestamp descending
      combinedNotifs.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(combinedNotifs);

    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  // Change Language
  const changeLanguage = (langVal: string) => {
    setLang(langVal);
    localStorage.setItem('appLang', langVal);
    
    const domain = window.location.hostname;
    if (langVal === 'en') {
      document.cookie = "googtrans=/vi/en; path=/;";
      document.cookie = "googtrans=/vi/en; path=/; domain=" + domain + ";";
    } else {
      document.cookie = "googtrans=/vi/vi; path=/;";
      document.cookie = "googtrans=/vi/vi; path=/; domain=" + domain + ";";
    }
    
    window.location.reload();
  };

  // Process Class Transfer Request (Approve/Reject)
  const handleProcessTransfer = async (requestId: string, actionState: 'Approved' | 'Rejected', studentName: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/notifications',
          action: 'processTransferRequest',
          requestId,
          actionState,
          email: user.email,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (actionState === 'Approved') {
            triggerToast('Thành công!', `Đã duyệt chuyển lớp cho học viên ${studentName} thành công.`, 'success');
          } else {
            triggerToast('Đã từ chối!', `Đã từ chối chuyển lớp cho học viên ${studentName} thành công.`, 'reject');
          }
          // Remove from local list
          setNotifications(prev => prev.filter(n => n.id !== requestId));
        } else {
          alert(`Lỗi: ${data.message || 'Không thể xử lý yêu cầu'}`);
        }
      } else {
        alert('Lỗi kết nối máy chủ khi xử lý yêu cầu.');
      }
    } catch (err) {
      console.error('Error processing transfer:', err);
      alert('Đã xảy ra lỗi hệ thống.');
    } finally {
      setActionLoading(false);
    }
  };

  // Dismiss a notification
  const handleDismissNotification = async (id: string) => {
    try {
      // Opt-out from logging trial evals permanently if they need to evaluate them
      if (!id.startsWith('trial_eval_')) {
        await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/notifications',
            action: 'saveDismissedNotification',
            email: user.email,
            notifId: id,
            notificationId: id,
            data: {
              notifId: id,
              notificationId: id,
            },
          }),
        });
      }

      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  };

  // Clear all General Notifications
  const handleClearAllGeneral = async () => {
    const generalNotifs = notifications.filter(n => n.category === 'general');
    const ids = generalNotifs.map(n => n.id);
    if (ids.length === 0) return;

    try {
      await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/notifications',
          action: 'clearAllNotifications',
          email: user.email,
          notifIds: ids,
        }),
      });

      setNotifications(prev => prev.filter(n => n.category !== 'general'));
      setShowBellDropdown(false);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  };

  // Change Password Modal Submit
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu nhập lại không khớp!');
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await updatePassword(oldPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Cập nhật mật khẩu mới thành công!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          setShowPasswordModal(false);
          setPasswordSuccess('');
        }, 1500);
      } else {
        setPasswordError(res.message || 'Lỗi đổi mật khẩu.');
      }
    } catch (err) {
      setPasswordError('Lỗi kết nối máy chủ.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Trigger mobile menu open (dispatches custom event for Sidebar to listen to)
  const openMobileSidebar = () => {
    // We trigger click on the sidebar mobile menu button
    const btn = document.querySelector('.md\\:hidden.fixed.top-4.left-4 button') as HTMLButtonElement;
    if (btn) btn.click();
  };

  // Filter Notification segments
  const transferNotifs = notifications.filter(n => n.category === 'transfer_request');
  const trialNotifs = notifications.filter(n => n.category === 'trial_eval');
  const generalNotifs = notifications.filter(n => n.category === 'general');

  return (
    <>
      <nav className="sticky top-0 z-30 w-full bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 py-3.5 flex items-center justify-between shadow-xs">

        {/* Mobile menu trigger & Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={openMobileSidebar}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="hidden md:block">
            <Breadcrumb items={breadcrumbs} />
          </div>

          {(() => {
            const backItem = breadcrumbs.find((item, idx) => idx > 0 && item.onClick);
            return backItem ? (
              <button
                type="button"
                onClick={backItem.onClick}
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-600 hover:text-[#21398A] border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs animate-fade-in"
              >
                <ChevronLeft size={14} />
                <span>Quay lại danh sách</span>
              </button>
            ) : null;
          })()}
        </div>

        {/* Action Widgets Container */}
        <div className="flex items-center gap-4 md:gap-5">

          {/* 1. Language Toggle (Button style) */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => changeLanguage('vi')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === 'vi'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              🇻🇳 VI
            </button>
            <button
              onClick={() => changeLanguage('en')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${lang === 'en'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              🇬🇧 EN
            </button>
          </div>

          {/* 2. Transfer Request segment */}
          {(isAdmin || hasApproveTransferPerm) && (
            <div className="relative" ref={transferRef}>
              <button
                onClick={() => setShowTransferDropdown(!showTransferDropdown)}
                className="relative p-2 text-slate-500 hover:text-[#21398A] hover:bg-slate-50 rounded-xl transition-all"
                title="Duyệt chuyển lớp"
              >
                <Repeat size={20} />
                {transferNotifs.length > 0 && (
                  <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-[#21398A] text-white text-[9px] font-bold leading-none ring-2 ring-white">
                    {transferNotifs.length}
                  </span>
                )}
              </button>

              {showTransferDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                      <Repeat size={16} className="text-[#21398A]" />
                      Duyệt chuyển lớp
                    </span>
                    <span className="text-xs bg-[#21398A]/10 text-[#21398A] font-semibold px-2 py-0.5 rounded-full">
                      {transferNotifs.length} chờ duyệt
                    </span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
                    {transferNotifs.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">
                        Không có yêu cầu chuyển lớp nào
                      </div>
                    ) : (
                      transferNotifs.map(n => (
                        <div key={n.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[180px]">{n.hsName}</span>
                            {n.timeLabel && <span className="text-[10px] text-slate-400">🕒 {n.timeLabel}</span>}
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-3 mb-3 leading-relaxed" dangerouslySetInnerHTML={{ __html: n.body }}></p>
                          <div className="flex gap-2.5">
                            <button
                              disabled={actionLoading}
                              onClick={() => handleProcessTransfer(n.id, 'Approved', n.hsName || 'Học viên')}
                              className="flex-1 py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Duyệt (OK)
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => handleProcessTransfer(n.id, 'Rejected', n.hsName || 'Học viên')}
                              className="flex-1 py-1.5 px-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                            >
                              Từ chối
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Trial Evaluation notifications */}
          <div className="relative" ref={trialRef}>
            <button
              onClick={() => setShowTrialDropdown(!showTrialDropdown)}
              className="relative p-2 text-slate-500 hover:text-amber-500 hover:bg-slate-50 rounded-xl transition-all"
              title="Đánh giá học thử"
            >
              <Clock size={20} />
              {trialNotifs.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-amber-500 text-white text-[9px] font-bold leading-none ring-2 ring-white">
                  {trialNotifs.length}
                </span>
              )}
            </button>

            {showTrialDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <ShieldAlert size={16} className="text-amber-500" />
                    Đánh giá học thử
                  </span>
                  <span className="text-xs bg-amber-500/10 text-amber-600 font-semibold px-2 py-0.5 rounded-full">
                    {trialNotifs.length} cần đánh giá
                  </span>
                </div>
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
                  {trialNotifs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      Không có học sinh học thử cần đánh giá
                    </div>
                  ) : (
                    trialNotifs.map(n => (
                      <Link
                        key={n.id}
                        href={`/students?name=${encodeURIComponent(n.hsName || '')}&tab=evals`}
                        onClick={() => setShowTrialDropdown(false)}
                        className="p-4 hover:bg-slate-50/50 transition-colors flex justify-between items-start gap-2 block border-b border-slate-50 last:border-b-0 cursor-pointer"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 text-xs block truncate">{n.title}</span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">{n.body}</span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 4. General Notifications */}
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setShowBellDropdown(!showBellDropdown)}
              className="relative p-2 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-xl transition-all"
              title="Thông báo chung"
            >
              <Bell size={20} />
              {generalNotifs.length > 0 && (
                <span className="absolute top-1 right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-white">
                  {generalNotifs.length}
                </span>
              )}
            </button>

            {showBellDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                  <span className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <Bell size={16} className="text-red-500" />
                    Thông báo chung
                  </span>
                  {generalNotifs.length > 0 && (
                    <button
                      onClick={handleClearAllGeneral}
                      className="text-xs text-slate-500 hover:text-red-600 transition-colors font-medium"
                    >
                      Xóa tất cả
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-50">
                  {generalNotifs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">
                      Không có thông báo mới
                    </div>
                  ) : (
                    generalNotifs.map(n => (
                      <div key={n.id} className="p-4 hover:bg-slate-50/50 transition-colors flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 text-xs block truncate flex items-center gap-1">
                            <span>{n.icon}</span>
                            <span className="truncate">{n.title}</span>
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-1 leading-normal">{n.body}</span>
                        </div>
                        <button
                          onClick={() => handleDismissNotification(n.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all self-center"
                          title="Xóa"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Vertical divider */}
          <div className="h-6 w-px bg-slate-100" />

          {/* 5. User Profile Dropdown */}
          <div className="relative" ref={userRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 p-1 rounded-full md:rounded-xl md:py-1.5 md:px-3 hover:bg-slate-50 transition-colors"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8.5 h-8.5 rounded-full object-cover shadow-inner border border-slate-100"
                />
              ) : (
                <div className="w-8.5 h-8.5 rounded-full bg-[#21398A]/10 text-[#21398A] flex items-center justify-center font-bold text-sm shadow-inner">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden md:block text-left">
                <p className="text-xs font-semibold text-slate-800 whitespace-nowrap leading-tight">
                  {user.name}
                </p>
                <p className="text-[10px] text-slate-400 whitespace-nowrap leading-none mt-0.5">
                  {user.role}
                </p>
              </div>
              <ChevronDown size={14} className="hidden md:block text-slate-400 ml-0.5" />
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
                {/* Header User info */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover shadow-sm border border-slate-100"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#21398A]/15 text-[#21398A] flex items-center justify-center font-bold text-base shadow-sm">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate leading-tight">{user.name}</p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{user.email}</p>
                    <p className="text-[10px] inline-block bg-[#21398A]/10 text-[#21398A] font-semibold px-2 py-0.5 rounded-full mt-1.5">
                      {user.role} ({user.department || 'THT'})
                    </p>
                  </div>
                </div>

                {/* Dropdown Menu actions */}
                <div className="p-1.5 divide-y divide-slate-50">
                  <button
                    onClick={() => {
                      setShowPasswordModal(true);
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium"
                  >
                    <Key size={16} className="text-slate-400" />
                    <span>Đổi mật khẩu</span>
                  </button>
                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-colors text-sm font-semibold"
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </nav>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in border border-slate-100">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                <Key size={18} className="text-[#21398A]" />
                Đổi mật khẩu tài khoản
              </span>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
                  ⚠️ {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl font-medium">
                  ✓ {passwordSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Mật khẩu cũ
                </label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="Nhập mật khẩu đang sử dụng"
                  className="w-full text-slate-800 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#21398a] focus:ring-1 focus:ring-[#21398a] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới mong muốn"
                  className="w-full text-slate-800 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#21398a] focus:ring-1 focus:ring-[#21398a] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Nhập lại mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại chính xác mật khẩu mới"
                  className="w-full text-slate-800 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#21398a] focus:ring-1 focus:ring-[#21398a] transition-all"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl text-sm font-semibold transition-colors"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-[#21398A] hover:bg-[#1a2d6e] text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {passwordLoading ? 'Đang cập nhật...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className={`bg-white rounded-2xl border ${toastType === 'success' ? 'border-emerald-100' : 'border-red-100'} shadow-2xl p-6 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300`}>
            <div className={`w-16 h-16 ${toastType === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'} rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 animate-bounce`}>
              {toastType === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 mb-1">{successTitle}</h3>
            <p className="text-sm font-semibold text-slate-500 leading-relaxed">{successMessage}</p>
            <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className={`h-full ${toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'} animate-[shrinkBar_2s_linear_forwards]`} style={{ animation: 'shrinkBar 2s linear forwards' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
