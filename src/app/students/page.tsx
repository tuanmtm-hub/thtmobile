'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useAbortController } from '@/hooks/useAbortController';
import { useStudentsData } from '@/hooks/useGasData';
import {
  Search,
  Users,
  RefreshCw,
  Phone,
  User,
  GraduationCap,
  UserPlus,
  Edit,
  Trash2,
  Mail,
  Briefcase,
  X,
  Plus,
  Settings,
  Shield,
  Tag,
  Coffee,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  Pause,
  XCircle,
  ChevronLeft,
  Eye
} from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';


const viCollator = new Intl.Collator(['vi', 'en'], {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true,
});

const compareVietnameseNames = (a: string, b: string) => {
  return viCollator.compare(a.trim(), b.trim());
};

interface PortalProps {
  children: React.ReactNode;
}

const Portal = ({ children }: PortalProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return 'Chưa cập nhật';
  const s = String(dateStr).trim();
  if (s.includes('T')) {
    const datePart = s.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return datePart;
  }
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return s;
};

const standardizeStatus = (statusStr: string): string => {
  const s = statusStr.trim().toLowerCase();
  if (s.includes('đang học') || s.includes('dang hoc') || s.includes('chính thức') || s.includes('chinh thuc')) return 'Đang học';
  if (s.includes('học thử (không đạt)') || s.includes('hoc thu (khong dat)')) return 'Học thử (không đạt)';
  if (s.includes('học thử') || s.includes('hoc thu')) return 'Học thử';
  if (s.includes('chờ lớp') || s.includes('cho lop') || s.includes('đang chờ lớp') || s.includes('dang cho lop')) return 'Đang chờ lớp';
  if (s.includes('tạm ngưng') || s.includes('tam ngung')) return 'Tạm ngưng';
  if (s.includes('bảo lưu') || s.includes('bao luu')) return 'Bảo lưu';
  if (s.includes('nghỉ học') || s.includes('nghi hoc')) return 'Nghỉ học';
  if (s.includes('chăm sóc') || s.includes('cham soc')) return 'Chăm sóc';
  return statusStr || 'Đang học'; // Default fallback
};


interface Student {
  id: string;
  name: string;
  nickName: string;
  gender: string;
  birthday: string;
  parentName: string;
  phone: string;
  email: string;
  status: string;
  className: string;
  homeroomTeacher: string;
  counselor: string;
  noteTV: string;
  source: string;
  voucherId: string;
  mealConfig: string;
}

function StudentsContent() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const userPerms = user?.permissions || {};
  const isAdmin = user?.role === 'Admin' || userPerms['perm_admin'] === true;

  const [showPermModal, setShowPermModal] = useState(false);

  const checkPermission = (permKey: string) => {
    if (isAdmin) return true;
    if (userPerms[permKey] === true) return true;
    setShowPermModal(true);
    return false;
  };

  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('id');
  const studentNameParam = searchParams.get('name');
  const getStudentsSignal = useAbortController();
  const getConsultantsSignal = useAbortController();
  const getVouchersSignal = useAbortController();
  const getEnrollsSignal = useAbortController();
  const { students, classesList, isLoading, refresh } = useStudentsData(user?.email || '');
  const [localLoading, setLocalLoading] = useState(false);
  const loading = isLoading || localLoading;
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [searchQuery, setSearchQuery] = useState('');
  const [consultants, setConsultants] = useState<string[]>([]);
  const [vouchers, setVouchers] = useState<{ id: string; name: string }[]>([]);
  const [selectedConsultantFilter, setSelectedConsultantFilter] = useState('');

  // Trạng thái điều hướng SPA và Tabs chi tiết
  const [activeView, setActiveView] = useState<'list' | 'detail' | 'add' | 'edit'>('list');
  const [detailTab, setDetailTab] = useState<'classes' | 'evals'>('classes');

  // 3 vouchers for Add Modal
  const [addVoucher1, setAddVoucher1] = useState('');
  const [addVoucher2, setAddVoucher2] = useState('');
  const [addVoucher3, setAddVoucher3] = useState('');

  // 3 vouchers for Edit Modal
  const [editVoucher1, setEditVoucher1] = useState('');
  const [editVoucher2, setEditVoucher2] = useState('');
  const [editVoucher3, setEditVoucher3] = useState('');

  // Meal Config states for Add Modal
  const [addMealConfigSelected, setAddMealConfigSelected] = useState<string[]>([]);
  const [addMealPriceMorning, setAddMealPriceMorning] = useState(0);
  const [addMealPriceLunch, setAddMealPriceLunch] = useState(0);
  const [addMealPriceAfternoon, setAddMealPriceAfternoon] = useState(0);

  // Meal Config states for Edit Modal
  const [editMealConfigSelected, setEditMealConfigSelected] = useState<string[]>([]);
  const [editMealPriceMorning, setEditMealPriceMorning] = useState(0);
  const [editMealPriceLunch, setEditMealPriceLunch] = useState(0);
  const [editMealPriceAfternoon, setEditMealPriceAfternoon] = useState(0);

  // Detail Modal States
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedStudentEnrolls, setSelectedStudentEnrolls] = useState<any[]>([]);
  const [loadingEnrolls, setLoadingEnrolls] = useState(false);

  // Evaluation Modal States
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalEnrollInfo, setEvalEnrollInfo] = useState<{ enrollId: string, className: string, currentNote: string, studentId: string } | null>(null);
  const [newEvalNote, setNewEvalNote] = useState('');
  const [savingEval, setSavingEval] = useState(false);

  // Status Modal States
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalStudent, setStatusModalStudent] = useState<Student | null>(null);
  const [statusModalNewValue, setStatusModalNewValue] = useState('');

  // Classes list for dropdowns (loaded dynamically from useStudentsData)

  // New Modals for Enroll Action Buttons
  const [showConvertOfficialModal, setShowConvertOfficialModal] = useState(false);
  const [showConvertTrialModal, setShowConvertTrialModal] = useState(false);
  const [showChangeStartDateModal, setShowChangeStartDateModal] = useState(false);
  const [showStopClassModal, setShowStopClassModal] = useState(false);
  const [showTransferClassModal, setShowTransferClassModal] = useState(false);

  // State for active item in actions
  const [activeEnrollAction, setActiveEnrollAction] = useState<any | null>(null);

  // Form states for Stop Class
  const [stopClassStatus, setStopClassStatus] = useState('Tạm ngưng');
  const [stopClassDate, setStopClassDate] = useState('');
  const [stopClassReason, setStopClassReason] = useState('');
  const [savingStopClass, setSavingStopClass] = useState(false);

  // Form states for Transfer Class
  const [transferNewClassName, setTransferNewClassName] = useState('');
  const [transferNewStatus, setTransferNewStatus] = useState('Đang học');
  const [transferNote, setTransferNote] = useState('');
  const [transferSendEmail, setTransferSendEmail] = useState(true);
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Form states for Change Start Date
  const [changeStartDateValue, setChangeStartDateValue] = useState('');
  const [savingStartDate, setSavingStartDate] = useState(false);

  // Saving states for Official/Trial convert
  const [savingConvertOfficial, setSavingConvertOfficial] = useState(false);
  const [savingConvertTrial, setSavingConvertTrial] = useState(false);

  // Email Preview state hooks
  const [stopClassSendEmail, setStopClassSendEmail] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('');
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  // States for email editability
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailSubjectInput, setEmailSubjectInput] = useState('');
  const [emailHtmlInput, setEmailHtmlInput] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const emailHtmlRef = useRef<HTMLDivElement>(null);
  const [usersList, setUsersList] = useState<{ id: string; name: string; email?: string; dept?: string; status?: string }[]>([]);
  const [previewTeacher, setPreviewTeacher] = useState('');

  const [pendingEmailAction, setPendingEmailAction] = useState<(recipients?: string[], subject?: string, html?: string) => Promise<void>>(() => async () => { });

  // Add Modal States
  const [addName, setAddName] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [addGender, setAddGender] = useState('Nam');
  const [addBirthday, setAddBirthday] = useState('');
  const [addParentName, setAddParentName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addStatus, setAddStatus] = useState('Đang chờ lớp');
  const [addSource, setAddSource] = useState('Facebook');
  const [addConsultant, setAddConsultant] = useState('');
  const [addVoucherId, setAddVoucherId] = useState('');
  const [addMealConfig, setAddMealConfig] = useState('');
  const [addKhNote, setAddKhNote] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [warningTitle, setWarningTitle] = useState('Trùng tên học sinh!');
  const [warningMessage, setWarningMessage] = useState('');
  const [showWarningToast, setShowWarningToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<{ id: string; name: string } | null>(null);

  const generateID = (prefix: string): string => {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}${rand}`;
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 2000);
  };

  const triggerWarning = (msg: string, title: string = 'Trùng tên học sinh!') => {
    setWarningTitle(title);
    setWarningMessage(msg);
    setShowWarningToast(true);
  };

  // Edit Modal States
  const [editName, setEditName] = useState('');
  const [editNickname, setEditNickname] = useState('');
  const [editGender, setEditGender] = useState('Nam');
  const [editBirthday, setEditBirthday] = useState('');
  const [editParentName, setEditParentName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState('Đang chờ lớp');
  const [editSource, setEditSource] = useState('Facebook');
  const [editConsultant, setEditConsultant] = useState('');
  const [editVoucherId, setEditVoucherId] = useState('');
  const [editMealConfig, setEditMealConfig] = useState('');
  const [editKhNote, setEditKhNote] = useState('');

  const tabs = [
    { name: 'Tất cả', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
    { name: 'Đang học', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { name: 'Đang chờ lớp', color: 'bg-slate-100 text-slate-700 hover:bg-slate-200' },
    { name: 'Học thử', color: 'bg-sky-50 text-sky-700 hover:bg-sky-100' },
    { name: 'Tạm ngưng', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { name: 'Bảo lưu', color: 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200' },
    { name: 'Nghỉ học', color: 'bg-red-50 text-red-700 hover:bg-red-100' },
    { name: 'Chăm sóc', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
  ];

  const fetchConsultants = useCallback(async () => {
    const signal = getConsultantsSignal();
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/users',
          method: 'GET',
          loginEmail: email,
        }),
        signal,
      });
      const res = await response.json();
      if (res.success && Array.isArray(res.data)) {
        // Map all users
        const allUsers = res.data.slice(1).map((u: any) => ({
          id: String(u[0] || ''),
          name: String(u[1] || ''),
          email: String(u[2] || ''),
          status: String(u[4] || ''),
          dept: String(u[6] || ''),
        }));
        setUsersList(allUsers);

        // Map all unique usernames whose department is 'Tư Vấn' and status is active
        const list: string[] = allUsers
          .filter((item: any) => {
            const dept = String(item.dept || '').trim().toLowerCase();
            const status = String(item.status || '').trim();
            return (dept === 'tư văn' || dept === 'tư vấn') && status === 'Đang hoạt động';
          })
          .map((item: any) => item.name)
          .filter(Boolean);
        setConsultants(Array.from(new Set(list)));
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching consultants:', e);
    }
  }, [user, getConsultantsSignal]);

  const fetchVouchersList = useCallback(async () => {
    const signal = getVouchersSignal();
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/vouchers',
          method: 'GET',
          loginEmail: email,
        }),
        signal,
      });
      const res = await response.json();
      if (res.success && Array.isArray(res.data)) {
        // Data format: [ [id, name, discountType, discountValue, description, status], ... ]
        const list = res.data
          .slice(1) // Skip header row
          .map((v: any) => ({
            id: String(v[0] || '').trim(),
            name: String(v[1] || '').trim(),
            status: String(v[5] || 'Đang hoạt động').trim(),
          }))
          .filter((v: any) => v.id && v.status === 'Đang hoạt động');
        setVouchers(list);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching vouchers list:', e);
    }
  }, [user, getVouchersSignal]);

  const parseMealConfig = (configStr: string) => {
    const defaultData = {
      prices: { morning: 0, lunch: 0, afternoon: 0 },
      selected: [] as string[],
    };
    if (!configStr) return defaultData;
    try {
      const c = JSON.parse(configStr);
      if (c && (c.selected || c.prices)) {
        return {
          prices: {
            morning: Number(c.prices?.morning) || 0,
            lunch: Number(c.prices?.lunch) || 0,
            afternoon: Number(c.prices?.afternoon) || 0,
          },
          selected: Array.isArray(c.selected) ? c.selected : [],
        };
      }
      if (c && c.days && c.sessions) {
        const selected: string[] = [];
        c.days.forEach((day: string) => {
          ['morning', 'lunch', 'afternoon'].forEach((sess) => {
            if (c.sessions[sess]?.active) {
              selected.push(`${day}_${sess}`);
            }
          });
        });
        return {
          prices: {
            morning: Number(c.sessions.morning?.price) || 0,
            lunch: Number(c.sessions.lunch?.price) || 0,
            afternoon: Number(c.sessions.afternoon?.price) || 0,
          },
          selected,
        };
      }
    } catch (e) {
      console.error('Failed to parse mealConfig JSON:', e);
    }
    return defaultData;
  };

  const renderMealGrid = (
    selectedList: string[],
    onToggle?: (day: string, session: string) => void,
    disabled = false
  ) => {
    const days = [
      { key: 'Mon', label: 'T2' },
      { key: 'Tue', label: 'T3' },
      { key: 'Wed', label: 'T4' },
      { key: 'Thu', label: 'T5' },
      { key: 'Fri', label: 'T6' },
      { key: 'Sat', label: 'T7' },
      { key: 'Sun', label: 'CN' },
    ];
    const sessions = [
      { key: 'morning', label: 'Sáng' },
      { key: 'lunch', label: 'Trưa' },
      { key: 'afternoon', label: 'Chiều' },
    ];

    return (
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="min-w-full text-center border-collapse text-xs font-semibold">
          <thead>
            <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <th className="py-2.5 px-3 border-r border-slate-100 font-bold">Thứ</th>
              <th className="py-2.5 px-3 border-r border-slate-100 font-bold">Sáng</th>
              <th className="py-2.5 px-3 border-r border-slate-100 font-bold">Trưa</th>
              <th className="py-2.5 px-3 font-bold">Chiều</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {days.map((day) => (
              <tr key={day.key} className="hover:bg-slate-50/50">
                <td className="py-2 px-3 border-r border-slate-100 font-bold bg-slate-50/30 text-slate-600">{day.label}</td>
                {sessions.map((session, idx) => {
                  const valKey = `${day.key}_${session.key}`;
                  const isChecked = selectedList.includes(valKey);
                  return (
                    <td key={session.key} className={`py-2 px-3 ${idx < 2 ? 'border-r border-slate-100' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => onToggle && onToggle(day.key, session.key)}
                        className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer disabled:cursor-not-allowed"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderMealPrices = (
    prices: { morning: number; lunch: number; afternoon: number },
    onChange?: (session: 'morning' | 'lunch' | 'afternoon', value: number) => void,
    disabled = false
  ) => {
    return (
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div>
          <label className="block font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Sáng (đ/ngày)
          </label>
          <input
            type="number"
            value={prices.morning}
            disabled={disabled}
            onChange={(e) => onChange && onChange('morning', Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-[#21398A] text-xs font-semibold"
            min={0}
            placeholder="Sáng"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Trưa (đ/ngày)
          </label>
          <input
            type="number"
            value={prices.lunch}
            disabled={disabled}
            onChange={(e) => onChange && onChange('lunch', Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-[#21398A] text-xs font-semibold"
            min={0}
            placeholder="Trưa"
          />
        </div>
        <div>
          <label className="block font-bold text-slate-500 mb-1.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-500" /> Chiều (đ/ngày)
          </label>
          <input
            type="number"
            value={prices.afternoon}
            disabled={disabled}
            onChange={(e) => onChange && onChange('afternoon', Number(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-slate-800 focus:border-[#21398A] text-xs font-semibold"
            min={0}
            placeholder="Chiều"
          />
        </div>
      </div>
    );
  };

  const renderDetailVouchers = (voucherIdStr: string) => {
    if (!voucherIdStr) return <span className="text-sm font-semibold text-slate-700">Không sử dụng</span>;
    const ids = voucherIdStr.split(',').map(s => s.trim()).filter(Boolean);
    const names = ids.map(id => {
      const v = vouchers.find(item => item.id === id);
      return v ? v.name : id;
    });
    return (
      <div className="flex flex-col items-end gap-1">
        {names.map((name, idx) => (
          <span key={idx} className="text-sm font-semibold text-slate-700 block text-right">
            {name}
          </span>
        ))}
      </div>
    );
  };

  const fetchStudents = useCallback(async (studentIdToRefresh?: string) => {
    await refresh();
    if (studentIdToRefresh) {
      const updated = students.find(s => s.id === studentIdToRefresh);
      if (updated) setSelectedStudent(updated);
    }
  }, [refresh, students]);

  useEffect(() => {
    if (user) {
      fetchConsultants();
      fetchVouchersList();
    }
  }, [user, fetchConsultants, fetchVouchersList]);

  // Keep selectedStudent in sync with updated students list from SWR cache
  useEffect(() => {
    if (selectedStudent) {
      const updated = students.find(s => s.id === selectedStudent.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedStudent)) {
        setSelectedStudent(updated);
      }
    }
  }, [students, selectedStudent]);

  // (Tự động mở chi tiết học sinh di chuyển xuống dưới để gọi handleOpenDetailModal hợp lệ)

  // Đồng bộ Breadcrumbs Navbar toàn cục
  useEffect(() => {
    if (activeView === 'detail' && selectedStudent) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        {
          label: 'Học sinh',
          href: '/students',
          onClick: () => {
            setActiveView('list');
            setSelectedStudent(null);
            setSelectedStudentEnrolls([]);
          }
        },
        { label: selectedStudent.name }
      ]);
    } else if (activeView === 'add') {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        {
          label: 'Học sinh',
          href: '/students',
          onClick: () => {
            setActiveView('list');
            setSelectedStudent(null);
          }
        },
        { label: 'Thêm học sinh mới' }
      ]);
    } else if (activeView === 'edit' && selectedStudent) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        {
          label: 'Học sinh',
          href: '/students',
          onClick: () => {
            setActiveView('list');
            setSelectedStudent(null);
            setSelectedStudentEnrolls([]);
          }
        },
        {
          label: 'Chỉnh sửa hồ sơ'
        },
        { label: selectedStudent.name }
      ]);
    } else {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Học sinh' }
      ]);
    }
  }, [activeView, selectedStudent, setBreadcrumbs]);


  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(student.phone || '').includes(searchQuery) ||
      student.counselor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.className.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesConsultant = selectedConsultantFilter
      ? student.counselor === selectedConsultantFilter
      : true;

    const matchesTab = activeTab === 'Tất cả' ? true : student.status === activeTab;

    return matchesSearch && matchesConsultant && matchesTab;
  });

  // Statistics
  const totalCount = students.length;
  const dangHocCount = students.filter((s) => s.status === 'Đang học').length;
  const hocThuCount = students.filter((s) => s.status === 'Học thử').length;
  const choLopCount = students.filter((s) => s.status === 'Đang chờ lớp').length;
  const tamNgungCount = students.filter((s) => s.status === 'Tạm ngưng').length;

  // Sort alphabetically by Vietnamese rules
  const sortedStudents = [...filteredStudents].sort((a, b) =>
    compareVietnameseNames(a.name, b.name)
  );

  // Pagination (shared hook - 10 dòng/trang)
  const {
    paginatedData: paginatedStudents,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(sortedStudents, 10, [searchQuery, activeTab, selectedConsultantFilter]);

  const handleOpenAddModal = () => {
    if (!checkPermission('perm_kh_add')) return;
    setAddName('');
    setAddNickname('');
    setAddGender('Nam');
    setAddBirthday('');
    setAddParentName('');
    setAddPhone('');
    setAddEmail('');
    setAddStatus('Đang chờ lớp');
    setAddSource('FB/Zalo');
    setAddConsultant(user?.name || '');
    setAddVoucherId('');
    setAddVoucher1('');
    setAddVoucher2('');
    setAddVoucher3('');
    setAddMealConfig('');
    setAddMealConfigSelected([]);
    setAddMealPriceMorning(0);
    setAddMealPriceLunch(0);
    setAddMealPriceAfternoon(0);
    setAddKhNote('');
    setActiveView('add');
  };

  const handleOpenEditModal = (student: Student) => {
    if (!checkPermission('perm_kh_edit')) return;
    setSelectedStudent(student);
    setEditName(student.name);
    setEditNickname(student.nickName);
    setEditGender(student.gender || 'Nam');

    // Convert date string from ISO (T) or dd/MM/yyyy to yyyy-MM-dd for HTML date input
    let formattedBday = '';
    if (student.birthday) {
      const bdayStr = String(student.birthday).trim();
      if (bdayStr) {
        // 1. Check if it's already yyyy-MM-dd (possibly with T...)
        const yyyymmddMatch = bdayStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (yyyymmddMatch) {
          formattedBday = yyyymmddMatch[0];
        }
        // 2. Check if it's dd/MM/yyyy
        else if (bdayStr.includes('/')) {
          const parts = bdayStr.split('/');
          if (parts.length === 3) {
            let y = parts[2].trim();
            let m = parts[1].trim().padStart(2, '0');
            let d = parts[0].trim().padStart(2, '0');
            if (y.length === 2) {
              y = '20' + y;
            }
            formattedBday = `${y}-${m}-${d}`;
          }
        }
        // 3. Fallback to Date parser
        else {
          try {
            const dateObj = new Date(bdayStr);
            if (!isNaN(dateObj.getTime())) {
              const y = dateObj.getFullYear();
              const m = String(dateObj.getMonth() + 1).padStart(2, '0');
              const d = String(dateObj.getDate()).padStart(2, '0');
              formattedBday = `${y}-${m}-${d}`;
            } else {
              formattedBday = bdayStr;
            }
          } catch (e) {
            formattedBday = bdayStr;
          }
        }
      }
    }
    setEditBirthday(formattedBday);

    setEditParentName(student.parentName);
    setEditPhone(student.phone);
    setEditEmail(student.email);
    setEditStatus(student.status);

    // Normalize source
    const normSrc = (s: string) => {
      const val = String(s || '').trim();
      if (!val) return 'FB/Zalo';
      if (val.toLowerCase() === 'facebook') return 'FB/Zalo';
      if (val.toLowerCase() === 'giới thiệu') return 'Referral/HS Cũ';
      if (val.toLowerCase() === 'website' || val.toLowerCase() === 'hotline') return 'Call in';
      return val;
    };
    setEditSource(normSrc(student.source));

    setEditConsultant(student.counselor);

    // Parse vouchers
    const vIds = (student.voucherId || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    setEditVoucher1(vIds[0] || '');
    setEditVoucher2(vIds[1] || '');
    setEditVoucher3(vIds[2] || '');

    // Parse meal config
    const meal = parseMealConfig(student.mealConfig);
    setEditMealConfigSelected(meal.selected);
    setEditMealPriceMorning(meal.prices.morning);
    setEditMealPriceLunch(meal.prices.lunch);
    setEditMealPriceAfternoon(meal.prices.afternoon);
    setEditKhNote('');
    setActiveView('edit');
  };

  const handleOpenDetailModal = useCallback(async (student: Student) => {
    setSelectedStudent(student);
    setActiveView('detail');
    setSelectedStudentEnrolls([]);
    setLoadingEnrolls(true);
    const signal = getEnrollsSignal();
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'POST',
          action: 'getEnrolls',
          studentId: student.id,
          loginEmail: email
        }),
        signal,
      });
      if (response.ok) {
        const res = await response.json();
        if (res.success && Array.isArray(res.data)) {
          setSelectedStudentEnrolls(res.data.map((enroll: any) => ({
            ...enroll,
            start: enroll.start || enroll.startDate || '',
            end: enroll.end || enroll.endDate || '',
            status: standardizeStatus(String(enroll.status || '')),
          })));
        }
      }
      setLoadingEnrolls(false);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Error fetching enrolls:', err);
      setLoadingEnrolls(false);
    }
  }, [user, getEnrollsSignal]);

  // Tự động mở chi tiết học sinh nếu có tham số id hoặc name trên URL
  useEffect(() => {
    if (students.length > 0) {
      let matched: Student | undefined;
      if (studentIdParam) {
        matched = students.find(s => s.id === studentIdParam);
      } else if (studentNameParam) {
        matched = students.find(s => s.name.toLowerCase() === studentNameParam.toLowerCase());
      }

      if (matched) {
        handleOpenDetailModal(matched);
        const tabParam = searchParams.get('tab');
        if (tabParam === 'evals') {
          setDetailTab('evals');
        }
      }
    }
  }, [students, studentIdParam, studentNameParam, searchParams, handleOpenDetailModal]);

  const handleOpenEvalModal = (enroll: any) => {
    setEvalEnrollInfo({
      enrollId: enroll.enrollId,
      className: enroll.className,
      currentNote: enroll.teacherNote || '',
      studentId: selectedStudent?.id || ''
    });
    setNewEvalNote('');
    setShowDetailModal(false);
    setTimeout(() => {
      setShowEvalModal(true);
    }, 100);
  };

  const handleCloseEvalModal = () => {
    setShowEvalModal(false);
    setActiveView('detail');
  };

  const handleSaveEvalNote = async () => {
    if (!evalEnrollInfo || !newEvalNote.trim()) {
      alert('Vui lòng nhập nội dung đánh giá!');
      return;
    }

    setSavingEval(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'POST',
          action: 'updateEnrollTeacherNote',
          enrollId: evalEnrollInfo.enrollId,
          studentId: evalEnrollInfo.studentId,
          className: evalEnrollInfo.className,
          note: newEvalNote,
          loginEmail: email
        })
      });

      const res = await response.json();
      if (res.ok) {
        triggerSuccess('Đánh giá đã được thêm thành công.');
        if (selectedStudent) {
          handleOpenDetailModal(selectedStudent);
        }
        setShowEvalModal(false);
      } else {
        alert(res.error || 'Lỗi khi lưu đánh giá.');
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu đánh giá.');
    } finally {
      setSavingEval(false);
    }
  };

  const handleConvertOfficial = async () => {
    if (!selectedStudent || !activeEnrollAction) return;
    setSavingConvertOfficial(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'CONVERT_OFFICIAL',
          data: {
            khId: selectedStudent.id,
            className: activeEnrollAction.className,
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        setShowConvertOfficialModal(false);
        triggerSuccess('Đã chuyển học sinh sang Đang học thành công.');
        await fetchStudents();
        // Reload enrolls in detail modal
        handleOpenDetailModal(selectedStudent);
      } else {
        alert(res.message || 'Chuyển đổi sang Đang học thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingConvertOfficial(false);
    }
  };

  const handleConvertTrial = async () => {
    if (!selectedStudent || !activeEnrollAction) return;
    setSavingConvertTrial(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'CONVERT_TRIAL',
          data: {
            khId: selectedStudent.id,
            className: activeEnrollAction.className,
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        setShowConvertTrialModal(false);
        triggerSuccess('Đã chuyển học sinh về Học thử thành công.');
        await fetchStudents();
        handleOpenDetailModal(selectedStudent);
      } else {
        alert(res.message || 'Chuyển đổi về học thử thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingConvertTrial(false);
    }
  };

  const handleChangeStartDate = async () => {
    if (!selectedStudent || !activeEnrollAction || !changeStartDateValue) {
      alert('Vui lòng chọn ngày nhập học mới!');
      return;
    }
    setSavingStartDate(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'UPDATE_START_DATE',
          data: {
            className: activeEnrollAction.className,
            studentId: selectedStudent.id,
            enrollId: activeEnrollAction.enrollId,
            newDate: changeStartDateValue,
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || 'Cập nhật ngày nhập học thành công.');
        setShowChangeStartDateModal(false);
        await fetchStudents();
        handleOpenDetailModal(selectedStudent);
      } else {
        alert(res.message || 'Cập nhật ngày nhập học thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingStartDate(false);
    }
  };

  const handleStopClass = async (sendEmail: boolean = stopClassSendEmail) => {
    if (!selectedStudent || !activeEnrollAction || !stopClassDate) {
      alert('Vui lòng điền đầy đủ ngày kết thúc!');
      return;
    }
    setSavingStopClass(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'STOP_CLASS',
          data: {
            khId: selectedStudent.id,
            enrollId: activeEnrollAction.enrollId,
            className: activeEnrollAction.className,
            targetStatus: stopClassStatus,
            endDate: stopClassDate,
            reason: stopClassReason,
            sendEmail: sendEmail,
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Đã dừng lớp học của học sinh.');
        setShowStopClassModal(false);
        await fetchStudents();
        handleOpenDetailModal(selectedStudent);
      } else {
        alert(res.message || 'Dừng lớp học thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingStopClass(false);
    }
  };

  const handleTransferClass = async (sendEmail: boolean = transferSendEmail) => {
    if (!selectedStudent || !activeEnrollAction || !transferNewClassName) {
      alert('Vui lòng chọn lớp mới!');
      return;
    }
    if (transferNewClassName === activeEnrollAction.className) {
      alert('Lớp mới phải khác lớp hiện tại!');
      return;
    }
    setSavingTransfer(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'TRANSFER_CLASS',
          data: {
            khId: selectedStudent.id,
            oldEnrollId: activeEnrollAction.enrollId,
            oldClassName: activeEnrollAction.className,
            newClassName: transferNewClassName,
            note: transferNote,
            newStatus: transferNewStatus,
            sendEmail: sendEmail,
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thực hiện chuyển lớp thành công.');
        setShowTransferClassModal(false);
        await fetchStudents();
        handleOpenDetailModal(selectedStudent);
      } else {
        alert(res.message || 'Chuyển lớp thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingTransfer(false);
    }
  };

  const triggerStopClass = async () => {
    if (!selectedStudent || !activeEnrollAction || !stopClassDate) {
      alert('Vui lòng điền đầy đủ ngày kết thúc!');
      return;
    }
    if (!stopClassSendEmail) {
      await handleStopClass(false);
      return;
    }

    setEmailPreviewLoading(true);
    setShowEmailPreview(true);
    try {
      const email = user?.email || '';
      let formattedDate = stopClassDate;
      if (stopClassDate) {
        const parts = stopClassDate.split('-');
        if (parts.length === 3) {
          formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'previewEmail',
          data: {
            templateName: 'thong_bao_dung_lop',
            tplData: {
              studentName: selectedStudent.name,
              className: activeEnrollAction.className,
              stopDate: formattedDate,
              stopStatus: stopClassStatus,
              reason: stopClassReason || 'Theo nguyện vọng của gia đình học sinh.'
            }
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        setEmailPreviewSubject(res.subject || 'Thông báo dừng học');
        setEmailPreviewHtml(res.html || '');

        setEmailSubjectInput(res.subject || 'Thông báo dừng học');
        setEmailHtmlInput(res.html || '');

        const classObj = classesList.find(c => c.name === activeEnrollAction.className);
        const teacherName = classObj?.teacher || selectedStudent.homeroomTeacher || '';
        setPreviewTeacher(teacherName);

        const initialEmails: string[] = [];
        if (teacherName) {
          const names = teacherName.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          names.forEach(name => {
            const teacherObj = usersList.find(u => u.name.toLowerCase().trim() === name || u.id.toLowerCase().trim() === name);
            if (teacherObj?.email && teacherObj.status === 'Đang hoạt động') {
              const emailClean = teacherObj.email.toLowerCase().trim();
              if (emailClean && !initialEmails.includes(emailClean)) {
                initialEmails.push(emailClean);
              }
            }
          });
        }
        setEmailRecipients(initialEmails);

        setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
          // 1. Thực hiện dừng lớp, vô hiệu hóa email mặc định từ backend
          await handleStopClass(false);

          // 2. Gửi email từ frontend lên sử dụng HTML đã chỉnh sửa
          const targetRecipients = finalRecipients || initialEmails;
          if (targetRecipients.length > 0) {
            const emailSub = finalSubject || res.subject || 'Thông báo dừng học';
            const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

            await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheet: 'LH',
                action: 'sendEmailDirect',
                data: {
                  className: activeEnrollAction.className,
                  recipients: targetRecipients,
                  subject: emailSub,
                  html: formattedHtml
                },
                loginEmail: user?.email || ''
              })
            });
          }
        });
      } else {
        alert('Lỗi tải email preview: ' + res.message);
        setShowEmailPreview(false);
      }
    } catch (e: any) {
      alert('Lỗi kết nối preview: ' + e.message);
      setShowEmailPreview(false);
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const triggerTransferClass = async () => {
    if (!selectedStudent || !activeEnrollAction || !transferNewClassName) {
      alert('Vui lòng chọn lớp mới!');
      return;
    }
    if (transferNewClassName === activeEnrollAction.className) {
      alert('Lớp mới phải khác lớp hiện tại!');
      return;
    }
    if (!transferSendEmail) {
      await handleTransferClass(false);
      return;
    }

    setEmailPreviewLoading(true);
    setShowEmailPreview(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'previewEmail',
          data: {
            templateName: 'thong_bao_hoc_sinh_moi',
            tplData: {
              className: transferNewClassName,
              newStudents: [{ name: selectedStudent.name, isTrial: transferNewStatus === 'Học thử' }]
            }
          },
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success) {
        // Set correct subject representing the transfer
        const computedSubject = `THÔNG BÁO CHUYỂN LỚP: ${selectedStudent.name} từ ${activeEnrollAction.className} sang ${transferNewClassName}`;
        setEmailPreviewSubject(computedSubject);
        setEmailPreviewHtml(res.html || '');

        setEmailSubjectInput(computedSubject);
        setEmailHtmlInput(res.html || '');

        const classObj = classesList.find(c => c.name === transferNewClassName);
        const teacherName = classObj?.teacher || '';
        setPreviewTeacher(teacherName);

        const initialEmails: string[] = [];
        if (teacherName) {
          const names = teacherName.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
          names.forEach(name => {
            const teacherObj = usersList.find(u => u.name.toLowerCase().trim() === name || u.id.toLowerCase().trim() === name);
            if (teacherObj?.email && teacherObj.status === 'Đang hoạt động') {
              const emailClean = teacherObj.email.toLowerCase().trim();
              if (emailClean && !initialEmails.includes(emailClean)) {
                initialEmails.push(emailClean);
              }
            }
          });
        }
        setEmailRecipients(initialEmails);

        setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
          // 1. Thực hiện chuyển lớp, vô hiệu hóa email mặc định từ backend
          await handleTransferClass(false);

          // 2. Gửi email từ frontend lên sử dụng HTML đã chỉnh sửa
          const targetRecipients = finalRecipients || initialEmails;
          if (targetRecipients.length > 0) {
            const emailSub = finalSubject || computedSubject;
            const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

            await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheet: 'LH',
                action: 'sendEmailDirect',
                data: {
                  className: transferNewClassName,
                  recipients: targetRecipients,
                  subject: emailSub,
                  html: formattedHtml
                },
                loginEmail: user?.email || ''
              })
            });
          }
        });
      } else {
        alert('Lỗi tải email preview: ' + res.message);
        setShowEmailPreview(false);
      }
    } catch (e: any) {
      alert('Lỗi kết nối preview: ' + e.message);
      setShowEmailPreview(false);
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) {
      alert('Vui lòng điền Họ tên học sinh.');
      return;
    }
    const isDuplicate = students.some(
      (s) => s.name.trim().toLowerCase() === addName.trim().toLowerCase()
    );
    if (isDuplicate) {
      triggerWarning('Họ tên học sinh đã tồn tại trong hệ thống. Vui lòng nhập tên khác hoặc thêm hậu tố để phân biệt!');
      return;
    }
    if (!addParentName.trim() || !addPhone.trim() || !addEmail.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin phụ huynh: tên phụ huynh, số điện thoại và email.');
      return;
    }

    const v1 = addVoucher1 || '';
    const v2 = addVoucher2 || '';
    const v3 = addVoucher3 || '';
    if ((v1 && (v1 === v2 || v1 === v3)) || (v2 && v2 === v3)) {
      alert('Voucher không được chọn trùng nhau ở các ô.');
      return;
    }

    try {
      setSubmitting(true);
      const combinedVoucherId = [addVoucher1, addVoucher2, addVoucher3].filter(Boolean).join(',');
      const combinedMealConfig = (addMealConfigSelected.length > 0 || addMealPriceMorning > 0 || addMealPriceLunch > 0 || addMealPriceAfternoon > 0)
        ? JSON.stringify({
          prices: {
            morning: addMealPriceMorning,
            lunch: addMealPriceLunch,
            afternoon: addMealPriceAfternoon,
          },
          selected: addMealConfigSelected,
        })
        : '';

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('HS'),
            name: addName,
            nickname: addNickname,
            gender: addGender,
            birthday: addBirthday,
            phkhName: addParentName,
            phone: addPhone,
            phEmail: addEmail,
            status: addStatus,
            khNote: addKhNote,
            source: addSource,
            consulting: addConsultant,
            voucherId: combinedVoucherId,
            mealConfig: combinedMealConfig,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thêm học sinh mới thành công.');
        setActiveView('list');
        fetchStudents();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !editName.trim()) return;
    const isDuplicate = students.some(
      (s) => s.name.trim().toLowerCase() === editName.trim().toLowerCase() && s.id !== selectedStudent.id
    );
    if (isDuplicate) {
      triggerWarning('Họ tên học sinh đã tồn tại trong hệ thống. Vui lòng nhập tên khác hoặc thêm hậu tố để phân biệt!');
      return;
    }
    if (!editParentName.trim() || !editPhone.trim() || !editEmail.trim()) {
      alert('Vui lòng nhập đầy đủ thông tin phụ huynh: tên phụ huynh, số điện thoại và email.');
      return;
    }

    const ev1 = editVoucher1 || '';
    const ev2 = editVoucher2 || '';
    const ev3 = editVoucher3 || '';
    if ((ev1 && (ev1 === ev2 || ev1 === ev3)) || (ev2 && ev2 === ev3)) {
      alert('Voucher không được chọn trùng nhau ở các ô.');
      return;
    }

    try {
      setSubmitting(true);
      const combinedVoucherId = [editVoucher1, editVoucher2, editVoucher3].filter(Boolean).join(',');
      const combinedMealConfig = (editMealConfigSelected.length > 0 || editMealPriceMorning > 0 || editMealPriceLunch > 0 || editMealPriceAfternoon > 0)
        ? JSON.stringify({
          prices: {
            morning: editMealPriceMorning,
            lunch: editMealPriceLunch,
            afternoon: editMealPriceAfternoon,
          },
          selected: editMealConfigSelected,
        })
        : '';

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'PUT',
          loginEmail: user?.email || '',
          data: {
            id: selectedStudent.id,
            name: editName,
            nickName: editNickname,
            gender: editGender,
            birthday: editBirthday,
            phkhName: editParentName,
            phone: editPhone,
            phEmail: editEmail,
            status: editStatus,
            source: editSource,
            consulting: editConsultant,
            voucherId: combinedVoucherId,
            mealConfig: combinedMealConfig,
            khNote: editKhNote,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật thông tin học sinh thành công.');
        let updatedStudent = selectedStudent;
        if (selectedStudent) {
          updatedStudent = {
            ...selectedStudent,
            name: editName,
            nickName: editNickname,
            gender: editGender,
            birthday: editBirthday,
            parentName: editParentName,
            phone: editPhone,
            email: editEmail,
            status: editStatus,
            source: editSource,
            counselor: editConsultant,
            voucherId: combinedVoucherId,
            mealConfig: combinedMealConfig,
          };
          setSelectedStudent(updatedStudent);
        }
        if (updatedStudent) {
          handleOpenDetailModal(updatedStudent);
        } else {
          setActiveView('detail');
        }
        fetchStudents();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (studentId: string, newStatus: string) => {
    try {
      setLocalLoading(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'PATCH',
          loginEmail: user?.email || '',
          data: {
            id: studentId,
            status: newStatus,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        fetchStudents();
      } else {
        alert(res.message || 'Có lỗi xảy ra khi cập nhật trạng thái.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDeleteStudent = (student: Student) => {
    if (!checkPermission('perm_kh_delete')) return;

    // Chỉ được xóa học sinh ở trạng thái Đang chăm sóc (Chăm sóc), Nghỉ học, Bảo lưu
    const allowedStatuses = ['Chăm sóc', 'Đang chăm sóc', 'Nghỉ học', 'Bảo lưu'];
    if (!allowedStatuses.includes(student.status)) {
      triggerWarning(
        `Không thể xóa học sinh ở trạng thái "${student.status}". Chỉ được xóa học sinh ở trạng thái Đang chăm sóc, Nghỉ học hoặc Bảo lưu.`,
        'Không thể xóa học sinh'
      );
      return;
    }

    setStudentToDelete({ id: student.id, name: student.name });
    setShowDeleteModal(true);
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'DELETE',
          loginEmail: user?.email || '',
          data: {
            id: studentToDelete.id,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Xóa học sinh thành công.');
        fetchStudents();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
      setStudentToDelete(null);
    }
  };

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case 'Đang học':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      case 'Đang chờ lớp':
      case 'Chờ lớp':
        return 'bg-slate-50 text-slate-600 border border-slate-200/60';
      case 'Học thử':
        return 'bg-sky-50 text-sky-700 border border-sky-200/60';
      case 'Tạm ngưng':
        return 'bg-amber-50 text-amber-700 border border-amber-200/60';
      case 'Bảo lưu':
        return 'bg-zinc-50 text-zinc-700 border border-zinc-200/60';
      case 'Nghỉ học':
        return 'bg-red-50 text-red-700 border border-red-200/60';
      default:
        return 'bg-purple-50 text-purple-700 border border-purple-200/60';
    }
  };

  const renderAddView = () => {
    return (
      <div className="space-y-6 text-slate-800 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-[#21398A] tracking-tight">
              Thêm học sinh mới
            </h1>
            <p className="text-slate-500 mt-1">
              Tạo hồ sơ và thiết lập thông tin quản lý, tiền ăn cho học viên mới.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveView('list')}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              form="add-student-form"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d60] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-2 cursor-pointer"
            >
              {submitting && <RefreshCw size={16} className="animate-spin" />}
              <span>Lưu học sinh</span>
            </button>
          </div>
        </div>

        <div className="bg-transparent">
          <form id="add-student-form" onSubmit={handleAddStudent}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Cột trái (50%): Thông tin học viên & phụ huynh */}
              <div className="space-y-6">
                {/* THÔNG TIN HỌC VIÊN CARD */}
                <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="section-card-title section-title-green">
                    <User size={18} />
                    1. Thông tin học viên
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="tht-input-label">Họ và tên *</label>
                      <input
                        type="text"
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        placeholder="Nguyễn Văn A"
                        className="tht-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="tht-input-label">Biệt danh / Nickname</label>
                      <input
                        type="text"
                        value={addNickname}
                        onChange={(e) => setAddNickname(e.target.value)}
                        placeholder="Tom"
                        className="tht-input"
                      />
                    </div>

                    <div>
                      <label className="tht-input-label">Giới tính</label>
                      <select
                        value={addGender}
                        onChange={(e) => setAddGender(e.target.value)}
                        className="tht-select"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>

                    <div>
                      <label className="tht-input-label">Ngày sinh *</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={addBirthday}
                        onChange={(e) => setAddBirthday(e.target.value)}
                        className="tht-input"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="tht-input-label">Ghi chú tuyển sinh</label>
                      <textarea
                        value={addKhNote}
                        onChange={(e) => setAddKhNote(e.target.value)}
                        placeholder="Nhập ghi chú hoặc đánh giá ban đầu về học sinh..."
                        rows={3}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm font-medium transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5"
                      />
                    </div>
                  </div>
                </div>

                {/* THÔNG TIN PHỤ HUYNH CARD */}
                <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="section-card-title section-title-purple">
                    <Users size={18} />
                    2. Thông tin phụ huynh
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="tht-input-label">Tên phụ huynh *</label>
                      <input
                        type="text"
                        value={addParentName}
                        onChange={(e) => setAddParentName(e.target.value)}
                        placeholder="Phụ huynh"
                        className="tht-input"
                        required
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="tht-input-label">Số điện thoại *</label>
                      <input
                        type="text"
                        value={addPhone}
                        onChange={(e) => setAddPhone(e.target.value)}
                        placeholder="09XXXXXXXX"
                        className="tht-input"
                        required
                      />
                    </div>

                    <div className="md:col-span-1">
                      <label className="tht-input-label">Email phụ huynh *</label>
                      <input
                        type="email"
                        value={addEmail}
                        onChange={(e) => setAddEmail(e.target.value)}
                        placeholder="parent@gmail.com"
                        className="tht-input"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột phải (50%): Thông tin quản lý */}
              <div className="space-y-6">
                {/* CHI TIẾT NGHIỆP VỤ & QUẢN TRỊ CARD */}
                <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                  <span className="section-card-title section-title-green">
                    <Settings size={18} />
                    3. Thông tin quản lý
                  </span>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="tht-input-label">Trạng thái học sinh</label>
                      <select
                        value={addStatus}
                        onChange={(e) => setAddStatus(e.target.value)}
                        className="tht-select"
                      >
                        <option value="Đang chờ lớp">Đang chờ lớp</option>
                        <option value="Đang học">Đang học</option>
                        <option value="Học thử">Học thử</option>
                        <option value="Tạm ngưng">Tạm ngưng</option>
                        <option value="Bảo lưu">Bảo lưu</option>
                        <option value="Nghỉ học">Nghỉ học</option>
                        <option value="Chăm sóc">Chăm sóc</option>
                      </select>
                    </div>

                    <div>
                      <label className="tht-input-label">Nhân viên tư vấn</label>
                      <select
                        value={addConsultant}
                        onChange={(e) => setAddConsultant(e.target.value)}
                        className="tht-select"
                      >
                        <option value="">Chọn tư vấn viên</option>
                        {consultants.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="tht-input-label">Nguồn tuyển sinh</label>
                      <select
                        value={addSource}
                        onChange={(e) => setAddSource(e.target.value)}
                        className="tht-select"
                      >
                        <option value="FB/Zalo">FB/Zalo</option>
                        <option value="Referral/HS Cũ">Referral/HS Cũ</option>
                        <option value="Call in">Call in</option>
                        <option value="Walk in (POSM)">Walk in (POSM)</option>
                      </select>
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <label className="tht-input-label">Voucher sử dụng (tối đa 3 cái)</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <select
                          value={addVoucher1}
                          onChange={(e) => setAddVoucher1(e.target.value)}
                          className="tht-select text-xs"
                        >
                          <option value="">-- Voucher 1 --</option>
                          {vouchers.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <select
                          value={addVoucher2}
                          onChange={(e) => setAddVoucher2(e.target.value)}
                          className="tht-select text-xs"
                        >
                          <option value="">-- Voucher 2 --</option>
                          {vouchers.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                        <select
                          value={addVoucher3}
                          onChange={(e) => setAddVoucher3(e.target.value)}
                          className="tht-select text-xs"
                        >
                          <option value="">-- Voucher 3 --</option>
                          {vouchers.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="md:col-span-2 space-y-3">
                      <label className="tht-input-label">Quản lý tiền ăn theo tháng</label>
                      {renderMealGrid(addMealConfigSelected, (day, session) => {
                        setAddMealConfigSelected(prev => {
                          const valKey = `${day}_${session}`;
                          if (prev.includes(valKey)) {
                            return prev.filter(k => k !== valKey);
                          } else {
                            return [...prev, valKey];
                          }
                        });
                      }, false)}
                      {renderMealPrices(
                        {
                          morning: addMealPriceMorning,
                          lunch: addMealPriceLunch,
                          afternoon: addMealPriceAfternoon
                        },
                        (session, val) => {
                          if (session === 'morning') setAddMealPriceMorning(val);
                          if (session === 'lunch') setAddMealPriceLunch(val);
                          if (session === 'afternoon') setAddMealPriceAfternoon(val);
                        },
                        false
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderEditView = () => {
    return (
      <div className="space-y-6 text-slate-800 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h1 className="text-3xl font-extrabold text-[#21398A] tracking-tight">
              Chỉnh sửa Hồ sơ Học sinh
            </h1>
            <p className="text-slate-500 mt-1">
              Cập nhật thông tin cá nhân, liên hệ và cài đặt dịch vụ của học viên.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (selectedStudent) {
                  handleOpenDetailModal(selectedStudent);
                } else {
                  setActiveView('list');
                }
              }}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              form="edit-student-form"
              disabled={submitting}
              className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-2 cursor-pointer"
            >
              {submitting && <RefreshCw size={16} className="animate-spin" />}
              <span>Cập nhật thông tin</span>
            </button>
          </div>
        </div>

        <div className="bg-transparent">
          {selectedStudent && (
            <form id="edit-student-form" onSubmit={handleUpdateStudent}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Cột trái (50%): Thông tin học viên & phụ huynh */}
                <div className="space-y-6">
                  {/* THÔNG TIN HỌC VIÊN CARD */}
                  <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <span className="section-card-title section-title-green">
                      <User size={18} />
                      1. Thông tin học viên
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="tht-input-label">Họ và tên *</label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nguyễn Văn A"
                          className="tht-input"
                          required
                        />
                      </div>

                      <div>
                        <label className="tht-input-label">Biệt danh / Nickname</label>
                        <input
                          type="text"
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                          placeholder="Tom"
                          className="tht-input"
                        />
                      </div>

                      <div>
                        <label className="tht-input-label">Giới tính</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="tht-select"
                        >
                          <option value="Nam">Nam</option>
                          <option value="Nữ">Nữ</option>
                          <option value="Khác">Khác</option>
                        </select>
                      </div>

                      <div>
                        <label className="tht-input-label">Ngày sinh *</label>
                        <input
                          type="date"
                          max="9999-12-31"
                          value={editBirthday}
                          onChange={(e) => setEditBirthday(e.target.value)}
                          className="tht-input"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="tht-input-label">Ghi chú của Tư vấn</label>
                        <textarea
                          value={editKhNote}
                          onChange={(e) => setEditKhNote(e.target.value)}
                          placeholder="Nhập ghi chú mới hoặc bổ sung thông tin..."
                          rows={3}
                          className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm font-medium transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5"
                        />
                      </div>
                    </div>
                  </div>

                  {/* THÔNG TIN LIÊN HỆ CARD */}
                  <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <span className="section-card-title section-title-blue">
                      <User size={18} />
                      2. Thông tin liên hệ phụ huynh
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="tht-input-label">Tên phụ huynh *</label>
                        <input
                          type="text"
                          value={editParentName}
                          onChange={(e) => setEditParentName(e.target.value)}
                          placeholder="Nguyễn Văn B"
                          className="tht-input"
                          required
                        />
                      </div>

                      <div>
                        <label className="tht-input-label">Số điện thoại *</label>
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          placeholder="0901234567"
                          className="tht-input"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="tht-input-label">Email phụ huynh *</label>
                        <input
                          type="email"
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          placeholder="phuhuynh@example.com"
                          className="tht-input"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cột phải (50%): Thông tin quản lý */}
                <div className="space-y-6">
                  {/* THÔNG TIN QUẢN LÝ CARD */}
                  <div className="info-section-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <span className="section-card-title section-title-purple">
                      <Settings size={18} />
                      3. Thông tin quản lý
                    </span>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="tht-input-label">Nhân viên tư vấn</label>
                        <select
                          value={editConsultant}
                          onChange={(e) => setEditConsultant(e.target.value)}
                          className="tht-select"
                        >
                          <option value="">Chọn tư vấn viên</option>
                          {consultants.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="tht-input-label">Nguồn tuyển sinh</label>
                        <select
                          value={editSource}
                          onChange={(e) => setEditSource(e.target.value)}
                          className="tht-select"
                        >
                          <option value="FB/Zalo">FB/Zalo</option>
                          <option value="Referral/HS Cũ">Referral/HS Cũ</option>
                          <option value="Call in">Call in</option>
                          <option value="Walk in (POSM)">Walk in (POSM)</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 space-y-2">
                        <label className="tht-input-label">Voucher sử dụng (tối đa 3 cái)</label>
                        <div className="flex flex-col gap-2">
                          <select
                            value={editVoucher1}
                            onChange={(e) => setEditVoucher1(e.target.value)}
                            className="tht-select text-xs"
                          >
                            <option value="">-- Voucher 1 --</option>
                            {vouchers.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select
                            value={editVoucher2}
                            onChange={(e) => setEditVoucher2(e.target.value)}
                            className="tht-select text-xs"
                          >
                            <option value="">-- Voucher 2 --</option>
                            {vouchers.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                          <select
                            value={editVoucher3}
                            onChange={(e) => setEditVoucher3(e.target.value)}
                            className="tht-select text-xs"
                          >
                            <option value="">-- Voucher 3 --</option>
                            {vouchers.map((v) => (
                              <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-3">
                        <label className="tht-input-label">Quản lý tiền ăn theo tháng</label>
                        {renderMealGrid(editMealConfigSelected, (day, session) => {
                          setEditMealConfigSelected(prev => {
                            const valKey = `${day}_${session}`;
                            if (prev.includes(valKey)) {
                              return prev.filter(k => k !== valKey);
                            } else {
                              return [...prev, valKey];
                            }
                          });
                        }, false)}
                        {renderMealPrices(
                          {
                            morning: editMealPriceMorning,
                            lunch: editMealPriceLunch,
                            afternoon: editMealPriceAfternoon
                          },
                          (session, val) => {
                            if (session === 'morning') setEditMealPriceMorning(val);
                            if (session === 'lunch') setEditMealPriceLunch(val);
                            if (session === 'afternoon') setEditMealPriceAfternoon(val);
                          },
                          false
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {activeView === 'detail' && selectedStudent ? (
        <div className="space-y-6 text-slate-800 animate-fade-in">

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            {/* Left Column (35% - col-span-4): Personal Details Card & Meal Config */}
            <div className="lg:col-span-4 space-y-6">
              {/* Profile Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex flex-col items-center text-center py-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#21398A] to-[#122258] text-white flex items-center justify-center font-extrabold text-2xl shadow-md border-4 border-slate-50">
                    {selectedStudent.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(-2)
                      .join('')
                      .toUpperCase()}
                  </div>

                  <h4 className="mt-4 text-xl font-extrabold text-slate-800 leading-tight">
                    {selectedStudent.name}
                  </h4>
                  {selectedStudent.nickName && (
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                      Biệt danh: {selectedStudent.nickName}
                    </p>
                  )}
                  <span className={`mt-3 inline-block px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${getBadgeStyle(selectedStudent.status)}`}>
                    {selectedStudent.status}
                  </span>
                </div>

                {/* Personal fields list */}
                <div className="space-y-3 pt-2 text-xs font-medium text-slate-600">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Mã số ID</span>
                    <span className="text-sm font-bold text-[#21398A]">{selectedStudent.id}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Giới tính</span>
                    <span className="text-slate-700 font-semibold">{selectedStudent.gender || 'Chưa cập nhật'}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Ngày sinh</span>
                    <span className="text-slate-700 font-semibold">{formatDateDisplay(selectedStudent.birthday)}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Người tư vấn</span>
                    <span className="text-slate-700 font-semibold">{selectedStudent.counselor || 'THT Center'}</span>
                  </div>
                </div>

                {/* Action quick buttons */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenEditModal(selectedStudent);
                    }}
                    className="w-full py-2 bg-slate-50 hover:bg-[#21398A] text-slate-600 hover:text-white font-bold rounded-xl text-xs transition-all border border-slate-200 hover:border-[#21398A] flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Edit size={13} />
                    <span>Chỉnh sửa hồ sơ học sinh</span>
                  </button>
                </div>
              </div>

              {/* Parents Contact Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Users size={14} className="text-slate-400" />
                  <span>Thông tin phụ huynh</span>
                </h4>

                <div className="space-y-3 text-xs font-medium text-slate-600">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Họ tên phụ huynh</span>
                    <span className="text-slate-700 font-semibold">{selectedStudent.parentName || 'Chưa cập nhật'}</span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Số điện thoại</span>
                    {selectedStudent.phone ? (
                      <a href={`tel:${selectedStudent.phone}`} className="text-[#21398A] hover:underline font-bold">
                        {selectedStudent.phone}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Chưa cập nhật</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                    <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Hộp thư điện tử</span>
                    {selectedStudent.email ? (
                      <a href={`mailto:${selectedStudent.email}`} className="text-[#21398A] hover:underline font-bold">
                        {selectedStudent.email}
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Chưa cập nhật</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Meal Config Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Coffee size={14} className="text-slate-400" />
                  <span>Quản lý tiền ăn hàng tháng</span>
                </h4>
                {(() => {
                  const parsed = parseMealConfig(selectedStudent.mealConfig);
                  return (
                    <div className="space-y-3 pt-1">
                      {renderMealGrid(parsed.selected, undefined, true)}
                      {renderMealPrices(parsed.prices, undefined, true)}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column (65% - col-span-8): Tab grids for Enrolled Classes and evaluations */}
            <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              {/* Tab Selector */}
              <div className="flex border-b border-slate-100 pb-3 gap-6">
                <button
                  type="button"
                  onClick={() => setDetailTab('classes')}
                  className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${detailTab === 'classes'
                    ? 'border-[#21398A] text-[#21398A]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Lớp học & Lộ trình ({selectedStudentEnrolls.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('evals')}
                  className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${detailTab === 'evals'
                    ? 'border-[#21398A] text-[#21398A]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                  Nhận xét của Giáo viên
                </button>
              </div>

              {detailTab === 'classes' ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <GraduationCap size={14} className="text-slate-400" />
                      <span>Lịch sử ghi danh & lộ trình lớp học</span>
                    </h4>
                  </div>

                  {loadingEnrolls ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 animate-pulse">
                      <RefreshCw size={20} className="animate-spin text-[#21398A]" />
                      <span className="text-xs text-slate-400 font-semibold">Đang tải danh sách lớp học...</span>
                    </div>
                  ) : selectedStudentEnrolls.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 text-slate-400 text-xs font-semibold animate-fade-in">
                      Học sinh chưa tham gia lớp học nào.
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-slate-100 rounded-xl bg-white shadow-xs animate-fade-in">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                              <th className="p-3 text-center">Tên lớp học</th>
                              <th className="p-3 text-center">Ngày nhập học</th>
                              <th className="p-3 text-center">Ngày kết thúc</th>
                              <th className="p-3 text-center">Trạng thái</th>
                              <th className="p-3 text-center">Hành động</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {selectedStudentEnrolls.map((enroll, idx) => {
                              const statusRaw = standardizeStatus(String(enroll.status || '').trim());
                              const getStatusBadge = (status: string) => {
                                const rawStatus = String(enroll.status || '').trim();
                                if (status === 'Đang học') {
                                  return <span className="px-2 py-1 bg-green-50 text-green-600 rounded-md font-bold border border-green-100 text-[10px]">Đang học</span>;
                                }
                                if (rawStatus.toLowerCase().includes('không đạt')) {
                                  return <span className="px-2 py-1 bg-rose-50 text-rose-600 rounded-md font-bold border border-rose-100 text-[10px]">Học thử (không đạt)</span>;
                                }
                                if (status === 'Học thử') {
                                  return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md font-bold border border-amber-100 text-[10px]">Học thử</span>;
                                }
                                if (status === 'Dừng học' || status === 'Kết thúc' || status === 'Nghỉ học') {
                                  return <span className="px-2 py-1 bg-red-50 text-red-600 rounded-md font-bold border border-red-100 text-[10px]">{status}</span>;
                                }
                                return <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-md font-bold border border-slate-200/60 text-[10px]">{status || 'Khác'}</span>;
                              };


                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 text-center font-bold text-slate-800">
                                    {enroll.className}
                                    {enroll.courseName && (
                                      <div className="text-[9px] text-slate-400 font-extrabold italic mt-0.5">{enroll.courseName}</div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center text-slate-500 font-medium">{enroll.start || '—'}</td>
                                  <td className="p-3 text-center text-slate-500 font-medium">{enroll.end || '—'}</td>
                                  <td className="p-3 text-center">{getStatusBadge(statusRaw)}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (!checkPermission('perm_student_eval')) return;
                                          setEvalEnrollInfo({
                                            enrollId: enroll.enrollId,
                                            className: enroll.className,
                                            currentNote: enroll.teacherNote || '',
                                            studentId: selectedStudent?.id || ''
                                          });
                                          setNewEvalNote('');
                                          setShowEvalModal(true);
                                        }}
                                        className="px-2.5 py-1.5 bg-slate-50 hover:bg-[#21398A] text-slate-600 hover:text-white border border-slate-200 hover:border-[#21398A] rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                        title="Nhận xét"
                                      >
                                        <Edit size={10} />
                                        <span>Đánh giá</span>
                                      </button>
                                      {statusRaw === 'Học thử' && (
                                        <>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-600 hover:text-white border border-green-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Chuyển sang Đang học"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_convert_official')) return;
                                              setActiveEnrollAction(enroll);
                                              setShowConvertOfficialModal(true);
                                            }}
                                          >
                                            Đang học
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Sửa ngày nhập học"
                                            onClick={() => {
                                              if (!checkPermission('perm_kh_edit')) return;
                                              setActiveEnrollAction(enroll);
                                              let formattedDate = '';
                                              if (enroll.start && enroll.start.includes('/')) {
                                                const parts = enroll.start.split('/');
                                                if (parts.length === 3) {
                                                  formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                                                }
                                              }
                                              setChangeStartDateValue(formattedDate);
                                              setShowChangeStartDateModal(true);
                                            }}
                                          >
                                            Ngày nhập học
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Không đạt / Dừng học thử"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_stop')) return;
                                              setActiveEnrollAction(enroll);
                                              setStopClassStatus('Học thử (không đạt)');
                                              setStopClassDate(new Date().toISOString().split('T')[0]);
                                              setStopClassReason('');
                                              setShowStopClassModal(true);
                                            }}
                                          >
                                            Không đạt
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Chuyển lớp khác"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_transfer')) return;
                                              setActiveEnrollAction(enroll);
                                              setTransferNewClassName('');
                                              setTransferNewStatus('Học thử');
                                              setTransferNote('');
                                              setTransferSendEmail(true);
                                              setShowTransferClassModal(true);
                                            }}
                                          >
                                            Chuyển lớp
                                          </button>
                                        </>
                                      )}
                                      {statusRaw === 'Đang học' && (
                                        <>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Chuyển về học thử"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_roll_back_trial')) return;
                                              setActiveEnrollAction(enroll);
                                              setShowConvertTrialModal(true);
                                            }}
                                          >
                                            Về Học thử
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white border border-indigo-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Chuyển sang lớp khác"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_transfer')) return;
                                              setActiveEnrollAction(enroll);
                                              setTransferNewClassName('');
                                              setTransferNewStatus('Đang học');
                                              setTransferNote('');
                                              setTransferSendEmail(true);
                                              setShowTransferClassModal(true);
                                            }}
                                          >
                                            Chuyển lớp
                                          </button>
                                          <button
                                            type="button"
                                            className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer"
                                            title="Dừng học / Kết thúc"
                                            onClick={() => {
                                              if (!checkPermission('perm_student_stop')) return;
                                              setActiveEnrollAction(enroll);
                                              setStopClassStatus('Tạm ngưng');
                                              setStopClassDate(new Date().toISOString().split('T')[0]);
                                              setStopClassReason('');
                                              setShowStopClassModal(true);
                                            }}
                                          >
                                            Dừng học
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" />
                    <span>Lịch sử các nhận xét đánh giá của giáo viên</span>
                  </h4>
                  {selectedStudentEnrolls.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-semibold">Chưa có nhận xét nào.</div>
                  ) : (
                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 divide-y divide-slate-100">
                      {selectedStudentEnrolls.map((enroll, idx) => (
                        <div key={idx} className="pt-4 first:pt-0 flex flex-col gap-2">
                          <div className="flex items-center justify-between animate-fade-in">
                            <span className="font-extrabold text-[#21398A] text-sm bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100/50">
                              Lớp: {enroll.className}
                            </span>
                            {enroll.courseName && (
                              <span className="text-[10px] text-slate-400 font-extrabold italic">{enroll.courseName}</span>
                            )}
                          </div>
                          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-xs font-medium whitespace-pre-wrap leading-relaxed animate-fade-in">
                            {enroll.teacherNote ? enroll.teacherNote : <span className="italic text-slate-400">Chưa có nhận xét từ giáo viên lớp này.</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Notes from consultant */}
              {selectedStudent.noteTV && (
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={14} className="text-slate-400" />
                    <span>Ghi chú tuyển sinh & Tư vấn</span>
                  </span>
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-slate-700 text-xs font-medium whitespace-pre-wrap leading-relaxed animate-fade-in">
                    {selectedStudent.noteTV}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeView === 'add' ? (
        renderAddView()
      ) : activeView === 'edit' && selectedStudent ? (
        renderEditView()
      ) : (
        <div className="space-y-8 animate-fade-in text-slate-800">
          {/* Header Title Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                Danh sách học viên
              </h1>
              <p className="text-slate-500 mt-1">
                Quản lý và tra cứu thông tin trạng thái học tập của học sinh toàn trung tâm.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 self-start">
              <button
                onClick={() => fetchStudents()}
                disabled={loading}
                className="tht-btn-outline"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>Tải lại danh sách</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="tht-btn-primary"
              >
                <UserPlus size={16} />
                <span>Thêm học sinh mới</span>
              </button>
            </div>
          </div>

          {/* Summary Stats Widgets */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
                <Users size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Tổng học viên</div>
                <div className="tht-kpi-value"><AnimatedNumber value={totalCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Đang học</div>
                <div className="tht-kpi-value"><AnimatedNumber value={dangHocCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-sky">
                <Coffee size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Học thử</div>
                <div className="tht-kpi-value"><AnimatedNumber value={hocThuCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-slate">
                <Clock size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Đang chờ lớp</div>
                <div className="tht-kpi-value"><AnimatedNumber value={choLopCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-amber">
                <Pause size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Tạm ngưng</div>
                <div className="tht-kpi-value"><AnimatedNumber value={tamNgungCount} /></div>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar (with Integrated Tabs) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
            {/* Tabs Filters */}
            <div className="tht-mobile-tabs-container border-b border-slate-100 pb-4">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.name;
                return (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(tab.name)}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-[0.97] flex-shrink-0
                  ${isActive
                        ? 'bg-[#21398A] text-white shadow-md shadow-[#21398a]/20 scale-105'
                        : tab.color
                      }
                `}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Controls Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row flex-1 gap-3 max-w-2xl">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo Tên học sinh, Mã ID, Lớp..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
                  />
                </div>

                <select
                  value={selectedConsultantFilter}
                  onChange={(e) => setSelectedConsultantFilter(e.target.value)}
                  className="px-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-700 bg-white focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium min-w-[200px]"
                >
                  <option value="">Tất cả tư vấn viên</option>
                  {consultants.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
                <Users size={16} className="text-[#21398A]" />
                <span>Tìm thấy: <strong className="text-slate-800">{filteredStudents.length}</strong> học viên</span>
              </div>
            </div>
          </div>

          {/* Students Data Grid Table */}
          <div className="tht-table-container">
            {loading ? (
              <div className="tht-loading-state">
                <RefreshCw size={24} className="tht-loading-spinner" />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="tht-empty-state">
                <Users size={48} className="tht-empty-icon" />
                <span>Không tìm thấy thông tin học viên phù hợp.</span>
              </div>
            ) : (
              <>
                {/* Desktop View: Table */}
                <div className="hidden md:block tht-table-wrapper">
                  <table className="tht-table">
                    <thead className="tht-table-thead">
                      <tr>
                        <th className="tht-table-th text-center">Tên học viên</th>
                        <th className="tht-table-th text-center">Lớp học</th>
                        <th className="tht-table-th text-center">Giáo viên chủ nhiệm</th>
                        <th className="tht-table-th text-center">Số điện thoại</th>
                        <th className="tht-table-th text-center">Email</th>
                        <th className="tht-table-th text-center">Người tư vấn</th>
                        <th className="tht-table-th text-center">Trạng thái</th>
                        <th className="tht-table-th text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="tht-table-tbody">
                      {paginatedStudents.map((student) => {
                        const initials = student.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase();

                        return (
                          <tr
                            key={student.id}
                            className="tht-table-tr group cursor-pointer"
                            onClick={() => handleOpenDetailModal(student)}
                          >
                            <td className="tht-table-td">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#21398A] to-[#122258] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-semibold text-slate-800 text-sm tracking-wide block">
                                    {student.name}
                                  </span>
                                  {student.nickName && (
                                    <span className="text-[11px] text-slate-500 font-medium block italic mt-0.5">
                                      {student.nickName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="tht-table-td text-center">
                              {student.className && student.className !== 'Chưa xếp lớp' ? (
                                <span className="font-semibold text-slate-700 text-sm">
                                  {student.className}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Chưa xếp lớp</span>
                              )}
                            </td>

                            <td className="tht-table-td text-center">
                              {student.homeroomTeacher ? (
                                <span className="font-medium text-slate-700 text-sm">
                                  {student.homeroomTeacher}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-xs">-</span>
                              )}
                            </td>

                            <td className="tht-table-td">
                              {student.phone ? (
                                <a
                                  href={`tel:${student.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 hover:text-[#21398A] transition-colors font-medium text-slate-600"
                                >
                                  <Phone size={14} className="text-slate-400" />
                                  <span>{student.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Chưa có SĐT</span>
                              )}
                            </td>

                            <td className="tht-table-td">
                              {student.email ? (
                                <a
                                  href={`mailto:${student.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 hover:text-[#21398A] transition-colors font-medium text-slate-600"
                                >
                                  <Mail size={14} className="text-slate-400" />
                                  <span>{student.email}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Chưa có Email</span>
                              )}
                            </td>

                            <td className="tht-table-td text-center">
                              {student.counselor === 'Chưa có tư vấn' ? (
                                <span className="text-slate-300 italic text-xs">Chưa có tư vấn</span>
                              ) : (
                                <span className="px-2.5 py-1 bg-blue-50 text-[#21398A] font-semibold text-xs rounded-lg border border-blue-100/50">
                                  {student.counselor}
                                </span>
                              )}
                            </td>

                            <td className="tht-table-td text-center" onClick={(e) => {
                              e.stopPropagation();
                              if (['Bảo lưu', 'Nghỉ học', 'Tạm ngưng'].includes(student.status)) {
                                if (!checkPermission('perm_kh_edit')) return;
                                setStatusModalStudent(student);
                                setStatusModalNewValue(student.status);
                                setShowStatusModal(true);
                              }
                            }}>
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide transition-all ${['Bảo lưu', 'Nghỉ học', 'Tạm ngưng'].includes(student.status) ? 'cursor-pointer hover:brightness-95 active:scale-95' : ''
                                } ${getBadgeStyle(student.status)}`}>
                                {student.status}
                              </span>
                            </td>

                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenDetailModal(student)}
                                  className="tht-text-action-btn tht-text-action-btn-gray"
                                >
                                  <Eye size={14} />
                                  <span>Chi tiết</span>
                                </button>

                                {/* Chuyển trạng thái nhanh button, chỉ áp dụng đối với học sinh ở trạng thái Bảo lưu, Nghỉ học, Tạm ngưng */}
                                {['Bảo lưu', 'Nghỉ học', 'Tạm ngưng'].includes(student.status) && (isAdmin || userPerms['perm_kh_edit']) && (
                                  <button
                                    onClick={() => {
                                      setStatusModalStudent(student);
                                      setStatusModalNewValue(student.status);
                                      setShowStatusModal(true);
                                    }}
                                    className="tht-text-action-btn tht-text-action-btn-amber"
                                  >
                                    <RefreshCw size={14} />
                                    <span>Đổi TT</span>
                                  </button>
                                )}

                                {/* Sửa button */}
                                {(isAdmin || userPerms['perm_kh_edit']) && (
                                  <button
                                    onClick={() => handleOpenEditModal(student)}
                                    className="tht-text-action-btn tht-text-action-btn-blue"
                                  >
                                    <Edit size={14} />
                                    <span>Sửa</span>
                                  </button>
                                )}

                                {/* Xóa button */}
                                {(isAdmin || userPerms['perm_kh_delete']) && (
                                  <button
                                    onClick={() => handleDeleteStudent(student)}
                                    className="tht-text-action-btn tht-text-action-btn-red"
                                  >
                                    <Trash2 size={14} />
                                    <span>Xóa</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View: Student Card List */}
                <div className="md:hidden space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100/50">
                  {paginatedStudents.map((student) => {
                    const initials = student.name
                      .split(' ')
                      .map((n: string) => n[0])
                      .slice(-2)
                      .join('')
                      .toUpperCase();

                    return (
                      <div
                        key={student.id}
                        className="tht-mobile-card cursor-pointer"
                        onClick={() => handleOpenDetailModal(student)}
                      >
                        {/* Header: Name, initials and Status Badge */}
                        <div className="tht-mobile-card-header">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#21398A] to-[#122258] text-white flex items-center justify-center font-bold text-[10px] shadow-sm shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-slate-800 text-xs hover:underline">
                                {student.name}
                              </span>
                              {student.nickName && (
                                <span className="text-[10px] text-slate-500 font-medium block italic mt-0.5">
                                  ({student.nickName})
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getBadgeStyle(student.status)}`}>
                            {student.status}
                          </span>
                        </div>

                        {/* Card Fields */}
                        <div className="space-y-1.5 text-xs">
                          <div className="tht-mobile-card-row">
                            <span className="tht-mobile-card-label">
                              <GraduationCap size={12} className="text-slate-400" />
                              <span>Lớp học:</span>
                            </span>
                            <span className="tht-mobile-card-value font-semibold text-slate-700">
                              {student.className && student.className !== 'Chưa xếp lớp' ? student.className : 'Chưa xếp lớp'}
                            </span>
                          </div>

                          {student.homeroomTeacher && (
                            <div className="tht-mobile-card-row">
                              <span className="tht-mobile-card-label">
                                <User size={12} className="text-slate-400" />
                                <span>Giáo viên CN:</span>
                              </span>
                              <span className="tht-mobile-card-value text-slate-600">
                                {student.homeroomTeacher}
                              </span>
                            </div>
                          )}

                          <div className="tht-mobile-card-row">
                            <span className="tht-mobile-card-label">
                              <Phone size={12} className="text-slate-400" />
                              <span>Số điện thoại:</span>
                            </span>
                            <span className="tht-mobile-card-value">
                              {student.phone ? (
                                <a
                                  href={`tel:${student.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#21398A] font-bold hover:underline"
                                >
                                  {student.phone}
                                </a>
                              ) : (
                                <span className="text-slate-300 italic">Chưa có SĐT</span>
                              )}
                            </span>
                          </div>

                          <div className="tht-mobile-card-row">
                            <span className="tht-mobile-card-label">
                              <Mail size={12} className="text-slate-400" />
                              <span>Email:</span>
                            </span>
                            <span className="tht-mobile-card-value max-w-[180px] truncate">
                              {student.email ? (
                                <a
                                  href={`mailto:${student.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#21398A] font-bold hover:underline"
                                >
                                  {student.email}
                                </a>
                              ) : (
                                <span className="text-slate-300 italic">Chưa có Email</span>
                              )}
                            </span>
                          </div>

                          <div className="tht-mobile-card-row">
                            <span className="tht-mobile-card-label">
                              <Briefcase size={12} className="text-slate-400" />
                              <span>Tư vấn viên:</span>
                            </span>
                            <span className="tht-mobile-card-value">
                              {student.counselor === 'Chưa có tư vấn' ? (
                                <span className="text-slate-300 italic">Chưa có tư vấn</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-blue-50 text-[#21398A] font-semibold text-[10px] rounded border border-blue-100/50">
                                  {student.counselor}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Actions Row */}
                        <div className="tht-mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleOpenDetailModal(student)}
                            className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>

                          {/* Quick change status button if applicable */}
                          {['Bảo lưu', 'Nghỉ học', 'Tạm ngưng'].includes(student.status) && (isAdmin || userPerms['perm_kh_edit']) && (
                            <button
                              onClick={() => {
                                setStatusModalStudent(student);
                                setStatusModalNewValue(student.status);
                                setShowStatusModal(true);
                              }}
                              className="px-2 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <RefreshCw size={12} />
                              <span>Trạng thái</span>
                            </button>
                          )}

                          {/* Edit button */}
                          {(isAdmin || userPerms['perm_kh_edit']) && (
                            <button
                              onClick={() => {
                                handleOpenEditModal(student);
                              }}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Edit size={12} />
                              <span>Sửa</span>
                            </button>
                          )}

                          {/* Delete button */}
                          {(isAdmin || userPerms['perm_kh_delete']) && (
                            <button
                              onClick={() => {
                                handleDeleteStudent(student);
                              }}
                              className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Trash2 size={12} />
                              <span>Xóa</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls using Reusable THT Pagination System */}
                {totalPages > 1 && (
                  <div className="tht-pagination-container">
                    <div className="tht-pagination-info">
                      Hiển thị từ <span>{startIndex + 1}</span> đến{' '}
                      <span>
                        {Math.min(startIndex + itemsPerPage, sortedStudents.length)}
                      </span>{' '}
                      trong tổng số <span>{sortedStudents.length}</span> học viên
                    </div>

                    <div className="tht-pagination-list">
                      <button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="tht-pagination-btn"
                      >
                        Trước
                      </button>
                      {getPageNumbers().map((page, index) => {
                        if (page === '...') {
                          return (
                            <span key={`dots-${index}`} className="px-2.5 py-1.5 text-slate-400 self-center text-xs font-bold">
                              ...
                            </span>
                          );
                        }
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(Number(page))}
                            className={`tht-pagination-btn tht-pagination-num ${currentPage === page ? 'tht-pagination-num-active' : ''
                              }`}
                          >
                            {page}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="tht-pagination-btn"
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Các Side Panel Thêm và Sửa học sinh đã được chuyển thành Inline SPA Views ở phía trên */}

      {showStatusModal && statusModalStudent && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => {
            setShowStatusModal(false);
            setStatusModalStudent(null);
          }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw size={18} className="text-[#21398A]" />
                  Thay đổi trạng thái học viên
                </h3>
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusModalStudent(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Học sinh: <strong className="text-slate-800">{statusModalStudent.name}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Trạng thái hiện tại: <span className="font-bold text-slate-600">{statusModalStudent.status}</span>
                  </p>
                </div>

                {(statusModalStudent.status === 'Bảo lưu' || statusModalStudent.status === 'Nghỉ học') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-2.5 text-xs text-amber-800 font-medium">
                    <span className="text-amber-500 text-sm">⚠️</span>
                    <div>
                      Học sinh đang ở trạng thái <strong>{statusModalStudent.status}</strong>.
                      Bạn cần đổi sang trạng thái hoạt động khác (như <em>Đang học</em> hoặc <em>Đang chờ lớp</em>) để học sinh có thể hiển thị trong danh sách xếp lớp.
                    </div>
                  </div>
                )}

                <div>
                  <label className="tht-input-label">Chọn trạng thái mới</label>
                  <select
                    value={statusModalNewValue}
                    onChange={(e) => setStatusModalNewValue(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang học">Đang học</option>
                    <option value="Đang chờ lớp">Đang chờ lớp</option>
                    <option value="Học thử">Học thử</option>
                    <option value="Tạm ngưng">Tạm ngưng</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="Nghỉ học">Nghỉ học</option>
                    <option value="Chăm sóc">Chăm sóc</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setStatusModalStudent(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={async () => {
                    if (statusModalStudent) {
                      await handleQuickStatusChange(statusModalStudent.id, statusModalNewValue);
                      setShowStatusModal(false);
                      setStatusModalStudent(null);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 cursor-pointer"
                >
                  Xác nhận đổi
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 1. Modal Convert Official */}
      {showConvertOfficialModal && selectedStudent && activeEnrollAction && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowConvertOfficialModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-600" />
                  Chuyển sang Đang học
                </h3>
                <button onClick={() => setShowConvertOfficialModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm font-semibold text-slate-600">
                  Bạn có muốn chuyển học sinh <strong className="text-slate-800">{selectedStudent.name}</strong> sang trạng thái Đang học ở lớp <strong className="text-slate-800">{activeEnrollAction.className}</strong> không?
                </p>
                <p className="text-xs text-slate-400">
                  Xác nhận -&gt; cập nhật trạng thái trong ENROLL thành &quot;Đang học&quot;, giữ nguyên Ngày nhập học ({activeEnrollAction.start}).
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowConvertOfficialModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConvertOfficial}
                  disabled={savingConvertOfficial}
                  className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingConvertOfficial ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Chuyển Đang học</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 2. Modal Convert Trial */}
      {showConvertTrialModal && selectedStudent && activeEnrollAction && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowConvertTrialModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw size={18} className="text-amber-600" />
                  Chuyển về học thử
                </h3>
                <button onClick={() => setShowConvertTrialModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <p className="text-sm font-semibold text-slate-600">
                  Bạn có muốn chuyển học sinh <strong className="text-slate-800">{selectedStudent.name}</strong> về học thử lớp <strong className="text-slate-800">{activeEnrollAction.className}</strong> không?
                </p>
                <p className="text-xs text-slate-400">
                  Xác nhận -&gt; cập nhật trạng thái trong ENROLL thành &quot;Học thử&quot;, giữ nguyên Ngày nhập học ({activeEnrollAction.start}).
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowConvertTrialModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConvertTrial}
                  disabled={savingConvertTrial}
                  className="px-5 py-2.5 bg-amber-600 text-white hover:bg-amber-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingConvertTrial ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Chuyển học thử</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 3. Modal Change Start Date */}
      {showChangeStartDateModal && selectedStudent && activeEnrollAction && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowChangeStartDateModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-amber-500" />
                  Thay đổi ngày nhập học
                </h3>
                <button onClick={() => setShowChangeStartDateModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Lớp học: <strong className="text-slate-800">{activeEnrollAction.className}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ngày nhập học hiện tại: <span className="font-bold text-slate-600">{activeEnrollAction.start}</span>
                  </p>
                </div>
                <div>
                  <label className="tht-input-label">Chọn ngày nhập học mới *</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={changeStartDateValue}
                    onChange={(e) => setChangeStartDateValue(e.target.value)}
                    className="tht-input"
                    required
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowChangeStartDateModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleChangeStartDate}
                  disabled={savingStartDate}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingStartDate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>Xác nhận</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 4. Modal Stop Class */}
      {showStopClassModal && selectedStudent && activeEnrollAction && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowStopClassModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Pause size={18} className="text-red-500" />
                  Dừng học lớp {activeEnrollAction.className}
                </h3>
                <button onClick={() => setShowStopClassModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Học sinh: <strong className="text-slate-800">{selectedStudent.name}</strong>
                  </p>
                </div>

                <div>
                  <label className="tht-input-label">Chọn trạng thái dừng học</label>
                  <select
                    value={stopClassStatus}
                    onChange={(e) => setStopClassStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Học thử (không đạt)">Học thử (không đạt)</option>
                    <option value="Tạm ngưng">Tạm ngưng</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="Nghỉ học">Nghỉ học</option>
                    <option value="Đang chờ lớp">Đang chờ lớp</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Ngày kết thúc thực tế *</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={stopClassDate}
                    onChange={(e) => setStopClassDate(e.target.value)}
                    className="tht-input"
                    required
                  />
                </div>

                <div>
                  <label className="tht-input-label">Lý do dừng học / Ghi chú</label>
                  <textarea
                    value={stopClassReason}
                    onChange={(e) => setStopClassReason(e.target.value)}
                    placeholder="Nhập lý do dừng học..."
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="students-stop-send-email-cb"
                    checked={stopClassSendEmail}
                    onChange={(e) => setStopClassSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="students-stop-send-email-cb" className="text-xs font-bold text-slate-500 cursor-pointer">
                    Tự động gửi Email thông báo dừng học
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowStopClassModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={triggerStopClass}
                  disabled={savingStopClass}
                  className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingStopClass ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang dừng lớp...</span>
                    </>
                  ) : (
                    <span>Dừng lớp học</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 5. Modal Transfer Class */}
      {showTransferClassModal && selectedStudent && activeEnrollAction && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowTransferClassModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw size={18} className="text-indigo-600 animate-spin-slow" />
                  Chuyển lớp cho học sinh
                </h3>
                <button onClick={() => setShowTransferClassModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Học sinh: <strong className="text-slate-800">{selectedStudent.name}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Lớp hiện tại: <span className="font-bold text-slate-600">{activeEnrollAction.className}</span> ({activeEnrollAction.status})
                  </p>
                </div>

                <div>
                  <label className="tht-input-label">Chọn lớp học mới *</label>
                  <select
                    value={transferNewClassName}
                    onChange={(e) => setTransferNewClassName(e.target.value)}
                    className="tht-select font-semibold"
                    required
                  >
                    <option value="">-- Chọn lớp mới --</option>
                    {classesList
                      .filter(c => c.name !== activeEnrollAction.className)
                      .map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Chọn trạng thái lớp học mới</label>
                  <select
                    value={transferNewStatus}
                    onChange={(e) => setTransferNewStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang học">Đang học</option>
                    <option value="Học thử">Học thử</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Ghi chú lý do chuyển lớp</label>
                  <textarea
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Nhập lý do chuyển lớp..."
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="transfer-send-email-cb"
                    checked={transferSendEmail}
                    onChange={(e) => setTransferSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="transfer-send-email-cb" className="text-xs font-bold text-slate-500 cursor-pointer">
                    Tự động gửi Email thông báo nhập học cho lớp mới
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowTransferClassModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={triggerTransferClass}
                  disabled={savingTransfer}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingTransfer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang chuyển lớp...</span>
                    </>
                  ) : (
                    <span>Xác nhận chuyển</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Class Evaluation Modal */}
      {showEvalModal && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseEvalModal}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Đánh giá của giáo viên</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseEvalModal}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {evalEnrollInfo && (
                  <div className="space-y-6">
                    <div className="flex flex-col text-center py-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                      <h4 className="text-lg font-extrabold text-slate-800 leading-tight">
                        {selectedStudent?.name}
                      </h4>
                      <p className="text-xs text-slate-400 mt-1">Lớp học: <span className="font-bold text-slate-600">{evalEnrollInfo.className}</span></p>
                    </div>

                    <div className="info-section-card space-y-3">
                      <span className="section-card-title section-title-green">
                        <Plus size={16} />
                        Nội dung đánh giá mới *
                      </span>
                      <textarea
                        value={newEvalNote}
                        onChange={(e) => setNewEvalNote(e.target.value)}
                        rows={6}
                        placeholder="Nhập nội dung đánh giá mới tại đây..."
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-colors text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-y font-medium min-h-[120px]"
                        required
                      ></textarea>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={handleCloseEvalModal}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvalNote}
                  disabled={savingEval}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] disabled:bg-slate-300 font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  {savingEval ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      <span>Lưu đánh giá</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 6. Modal Email Preview (Super Modal) */}
      {showEmailPreview && (
        <Portal>
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" style={{ zIndex: 1200 }} onClick={() => setShowEmailPreview(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-155 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#21398A]"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  Biên tập & Gửi email thông báo cho Phụ huynh
                </h3>
                <button onClick={() => setShowEmailPreview(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {emailPreviewLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-4 border-[#21398A] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-400 font-bold">Đang sinh bản dịch email...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Người nhận (Email Recipients) */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Người nhận (Email Recipients)</label>
                      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
                        {emailRecipients.map((rec) => (
                          <span key={rec} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#21398A] border border-blue-200 rounded-lg text-xs font-extrabold shadow-xs">
                            <span>{rec}</span>
                            <button
                              type="button"
                              onClick={() => setEmailRecipients(prev => prev.filter(r => r !== rec))}
                              className="text-blue-400 hover:text-blue-600 font-black transition-colors ml-1 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <div className="flex-1 min-w-[200px] flex gap-2">
                          <input
                            type="email"
                            value={newRecipientEmail}
                            onChange={(e) => setNewRecipientEmail(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const trimmed = newRecipientEmail.trim().toLowerCase();
                                if (trimmed && trimmed.includes('@') && !emailRecipients.includes(trimmed)) {
                                  setEmailRecipients(prev => [...prev, trimmed]);
                                  setNewRecipientEmail('');
                                }
                              }
                            }}
                            placeholder="Thêm email người nhận (nhấn Enter)..."
                            className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-700 font-semibold placeholder-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const trimmed = newRecipientEmail.trim().toLowerCase();
                              if (trimmed && trimmed.includes('@') && !emailRecipients.includes(trimmed)) {
                                setEmailRecipients(prev => [...prev, trimmed]);
                                setNewRecipientEmail('');
                              }
                            }}
                            className="px-2.5 py-1 bg-[#21398A] text-white rounded-lg text-xs font-bold hover:bg-[#1a2d6e] transition-colors cursor-pointer"
                          >
                            Thêm
                          </button>
                        </div>
                      </div>

                      {/* Nhóm email nhận tin nhanh */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 pt-1">
                        <span>Thêm nhanh theo nhóm:</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (previewTeacher) {
                              const names = previewTeacher.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
                              const newEmails: string[] = [];
                              names.forEach(name => {
                                const teacherObj = usersList.find(u => u.name.toLowerCase().trim() === name || u.id.toLowerCase().trim() === name);
                                if (teacherObj?.email && teacherObj.status === 'Đang hoạt động') {
                                  newEmails.push(teacherObj.email.toLowerCase().trim());
                                }
                              });
                              if (newEmails.length > 0) {
                                setEmailRecipients(prev => [...prev, ...newEmails].filter((v, i, a) => a.indexOf(v) === i));
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-150 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                        >
                          + GV Chủ nhiệm ({previewTeacher || 'Chưa phân công'})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newEmails: string[] = [];
                            usersList.forEach((u) => {
                              const dept = String(u.dept || '').trim().toLowerCase();
                              if ((dept === 'tư văn' || dept === 'tư vấn') && u.status === 'Đang hoạt động' && u.email) {
                                const emailClean = u.email.toLowerCase().trim();
                                if (emailClean && !emailRecipients.includes(emailClean)) {
                                  newEmails.push(emailClean);
                                }
                              }
                            });
                            if (newEmails.length > 0) {
                              setEmailRecipients(prev => [...prev, ...newEmails].filter((v, i, a) => a.indexOf(v) === i));
                            }
                          }}
                          className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-150 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                        >
                          + Bộ phận Tư vấn
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (user?.email) {
                              const emailClean = user.email.toLowerCase().trim();
                              if (emailClean && emailClean.includes('@') && !emailRecipients.includes(emailClean)) {
                                setEmailRecipients(prev => [...prev, emailClean]);
                              }
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                        >
                          + Tôi ({user?.name || 'User'} - {user?.email || ''})
                        </button>
                      </div>
                    </div>

                    {/* Tiêu đề Email */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tiêu đề Email (Subject)</label>
                      <input
                        type="text"
                        value={emailSubjectInput}
                        onChange={(e) => setEmailSubjectInput(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-800"
                        placeholder="Nhập tiêu đề email..."
                      />
                    </div>

                    {/* Nội dung thư (Preview) */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nội dung thư xem trước (Email Content Preview)</label>
                        <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                          Có thể click trực tiếp vào văn bản để sửa
                        </span>
                      </div>
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50 focus-within:ring-2 focus-within:ring-[#21398A]/20 focus-within:border-[#21398A]">
                        <div className="p-4 overflow-y-auto max-h-[400px] bg-white text-slate-800" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <div
                            ref={emailHtmlRef}
                            contentEditable
                            suppressContentEditableWarning
                            dangerouslySetInnerHTML={{ __html: emailHtmlInput }}
                            className="outline-none min-h-[250px]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-155 flex justify-end gap-3">
                <button onClick={() => setShowEmailPreview(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Quay lại chỉnh sửa
                </button>
                <button
                  onClick={async () => {
                    const finalHtml = emailHtmlRef.current ? emailHtmlRef.current.innerHTML : emailHtmlInput;
                    setShowEmailPreview(false);
                    await pendingEmailAction(emailRecipients, emailSubjectInput, finalHtml);
                  }}
                  disabled={emailPreviewLoading || emailRecipients.length === 0}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Xác nhận gửi Email & Hoàn tất</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Page Blocker Overlay */}
      {submitting && (
        <Portal>
          <div className="fixed inset-0 z-[1900] bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-4">
              <RefreshCw size={22} className="animate-spin text-[#21398A]" />
              <span className="text-slate-700 font-semibold text-sm">Đang xử lý, vui lòng chờ...</span>
            </div>
          </div>
        </Portal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && studentToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Xác nhận xóa học sinh</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa học sinh <strong className="text-slate-700">"{studentToDelete.name}"</strong> khỏi hệ thống không? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setStudentToDelete(null); }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmDeleteStudent}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-500/20"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showSuccessToast && (
        <Portal>
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xl p-6 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-100 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 mb-1">Thành công!</h3>
              <p className="text-sm font-semibold text-slate-500 leading-relaxed">{successMessage}</p>
              <div className="mt-4 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full animate-[shrinkBar_2s_linear_forwards]" style={{ animation: 'shrinkBar 2s linear forwards' }} />
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showWarningToast && (
        <Portal>
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <div className="bg-white rounded-2xl border border-amber-100 shadow-2xl p-6 max-w-sm w-full text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-100 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 mb-1">{warningTitle}</h3>
              <p className="text-sm font-semibold text-slate-500 leading-relaxed">{warningMessage}</p>
              <button
                type="button"
                onClick={() => setShowWarningToast(false)}
                className="mt-5 w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-amber-500/20"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </Portal>
      )}
      {showPermModal && (
        <Portal>
          <div className="tht-perm-modal-overlay">
            <div className="tht-perm-modal-card">
              <div className="tht-perm-modal-icon-container">
                <Shield size={28} className="animate-shake" />
              </div>
              <h3 className="tht-perm-modal-title">Không có quyền truy cập</h3>
              <p className="tht-perm-modal-message">
                Bạn không có quyền thực hiện thao tác này.<br />Hãy liên hệ Quản Trị Viên
              </p>
              <button
                onClick={() => setShowPermModal(false)}
                className="tht-perm-modal-btn"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

export default function Students() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#21398A]" />
        <span>Đang tải dữ liệu học sinh...</span>
      </div>
    }>
      <StudentsContent />
    </Suspense>
  );
}
