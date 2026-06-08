'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'next/navigation';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { usePagination } from '@/hooks/usePagination';
import { motion, AnimatePresence, animate } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  Search,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  Mail,
  DollarSign,
  Coffee,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Paperclip,
  Check,
  X,
  ChevronDown,
  GraduationCap,
  Utensils,
  BookOpen,
  Coins,
  PiggyBank,
  History,
  User,
  FileText,
  Info,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface MissingAttendanceItem {
  date: string;
  className: string;
  room: string;
  shift: string;
  teacher: string;
  onAir: string;
  attendanceTaker: string;
  hasAttendance: boolean;
}

interface MasterAttendanceItem {
  date: string;
  class: string;
  studentId: string;
  name: string;
  status: string;
  recorder: string;
  timestamp: string;
}

interface MealCalendarDay {
  dateNum: number;
  studentsCount: number;
  students: Array<{
    khId: string;
    name: string;
    sessions: string[];
    totalAmount: number;
  }>;
}

interface RevenueReportBundle {
  defYear: number;
  kpi: {
    curMonthRevenue?: number;
    prevMonthRevenue?: number;
    growthRevenuePct?: number;
    curMonthMeal?: number;
    prevMonthMeal?: number;
    growthMealPct?: number;
    curMonthFee?: number;
    prevMonthFee?: number;
    growthFeePct?: number;
    curMonthOther?: number;
    prevMonthOther?: number;
    growthOtherPct?: number;
    curMonthBook?: number;
    prevMonthBook?: number;
    growthBookPct?: number;
    curMonthOtherFee?: number;
    prevMonthOtherFee?: number;
    growthOtherFeePct?: number;
    totalDebt?: number;
    totalSurplus?: number;
    curMonthExpense?: number;
    yearTotalExpense?: number;
  };
  monthlyData: Array<{
    month: number;
    monthYear?: string;
    label: string;
    collected: number;
    expense: number;
    tuition: number;
    meal: number;
    book: number;
    other: number;
  }>;
  debtDetails: any[];
  surplusDetails: any[];
}

interface TransactionDetailItem {
  loaiPhi: string;
  amount: number;
  discountVND: number;
  mustPay: number;
}

interface TransactionItem {
  id: string;
  date: string;
  dateSort: number;
  txType: string;
  txClass: 'thu' | 'chi' | 'no';
  name: string;
  className: string;
  khId: string;
  lhId: string;
  amount: number;
  method: string;
  status: string;
  creator: string;
  note: string;
  loaiPhi: string;
  details: TransactionDetailItem[];
}

interface EmailLogItem {
  sentDate: string;
  studentName: string;
  khId: string;
  email: string;
  className: string;
  subject: string;
  fileUrlsRaw?: string;
  fileUrls?: string;
  status: string;
  filename?: string;
}

function formatMoneyKpi(value: number): string {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  let formatted = '';
  if (absValue >= 1e9) {
    const bValue = absValue / 1e9;
    formatted = (Math.round(bValue * 100) / 100).toLocaleString('vi-VN') + ' B';
  } else if (absValue >= 1e6) {
    const mValue = absValue / 1e6;
    formatted = (Math.round(mValue * 100) / 100).toLocaleString('vi-VN') + ' M';
  } else {
    formatted = Math.round(absValue).toLocaleString('vi-VN');
  }
  return isNegative ? `-${formatted}` : formatted;
}

function AnimatedMoney({ value, abbreviate = false }: { value: number; abbreviate?: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (latest) => {
        setDisplayValue(Math.floor(latest));
      }
    });
    return () => controls.stop();
  }, [value]);

  if (abbreviate) {
    return <>{formatMoneyKpi(displayValue)}</>;
  }
  return <>{new Intl.NumberFormat('vi-VN').format(displayValue)}</>;
}

function ReportsContent() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const getSignal = useAbortController();
  const [loading, setLoading] = useState(false);

  // Synchronize dynamic breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Báo cáo' }
    ]);
  }, [setBreadcrumbs]);

  // Report selection states (5 active menus, excluded student, class and trial)
  const [reportType, setReportType] = useState<
    | 'missing_attendance'
    | 'master_attendance'
    | 'meal_report'
    | 'revenue_report'
    | 'email_history'
  >('missing_attendance');

  // Sync active report category state with search query param (collapsible Sidebar support)
  const searchParams = useSearchParams();
  const typeParam = searchParams.get('type');
  useEffect(() => {
    if (typeParam && [
      'missing_attendance',
      'master_attendance',
      'meal_report',
      'revenue_report',
      'email_history'
    ].includes(typeParam)) {
      setReportType(typeParam as any);
    }
  }, [typeParam]);

  // Year filter for year-based reports
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Month-Year filter for Meal report
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthStr);

  // Date Filters for attendance reports (default range)
  const todayStr = new Date().toISOString().split('T')[0];
  const fiveDaysAgoStr = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(fiveDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Search/Filter criteria
  const [classFilter, setClassFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');

  // Report Specific States
  const [classesList, setClassesList] = useState<{ id: string; name: string; status: string }[]>([]);
  const [hasCheckedMissing, setHasCheckedMissing] = useState(false);
  const [hasCheckedMaster, setHasCheckedMaster] = useState(false);
  const [missingData, setMissingData] = useState<MissingAttendanceItem[]>([]);
  const [masterData, setMasterData] = useState<MasterAttendanceItem[]>([]);
  const [missingSubTab, setMissingSubTab] = useState<'not_done' | 'done'>('not_done');
  const [missingClassFilter, setMissingClassFilter] = useState('');
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Meal Calendar states
  const [mealDays, setMealDays] = useState<MealCalendarDay[]>([]);
  const [selectedMealDay, setSelectedMealDay] = useState<MealCalendarDay | null>(null);
  const [mealSearchQuery, setMealSearchQuery] = useState('');

  // Revenue report states
  const [revenueBundle, setRevenueBundle] = useState<RevenueReportBundle | null>(null);
  const [revenueBundleCurrent, setRevenueBundleCurrent] = useState<RevenueReportBundle | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [txSearch, setTxSearch] = useState('');
  const [txPage, setTxPage] = useState(1);
  const [txSortCol, setTxSortCol] = useState<'date' | 'name' | 'className' | 'amount' | 'loaiPhi'>('date');
  const [txSortDir, setTxSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'thu' | 'chi' | 'no'>('all');

  // Email Log states
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>([]);
  const [emailSearchQuery, setEmailSearchQuery] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('');
  const [emailBounceStatus, setEmailBounceStatus] = useState<string | null>(null);
  const [checkingBounce, setCheckingBounce] = useState(false);

  // Attendance stats
  const [totalMissing, setTotalMissing] = useState(0);
  const [totalDone, setTotalDone] = useState(0);

  // Cleanup effect when tab changes to avoid stale data flashing
  useEffect(() => {
    setMissingData([]);
    setMasterData([]);
    setMealDays([]);
    setSelectedMealDay(null);
    setRevenueBundle(null);
    setRevenueBundleCurrent(null);
    setTransactions([]);
    setTxSearch('');
    setTxPage(1);
    setSelectedTx(null);
    setTxTypeFilter('all');
    setEmailLogs([]);
    setHasCheckedMissing(false);
    setHasCheckedMaster(false);
    setMissingSubTab('not_done');
    setMissingClassFilter('');
  }, [reportType]);

  const fetchReport = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';

      const payload: any = {
        path: '/api/v1/reports',
        loginEmail: email,
      };

      if (reportType === 'missing_attendance') {
        // Enforce Range Limit of 10 Days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 10) {
          setShowLimitModal(true);
          setLoading(false);
          return;
        }

        payload.action = 'getMissingAttendanceReport';
        payload.data = { fromDateStr: startDate, toDateStr: endDate };
      } else if (reportType === 'master_attendance') {
        payload.action = 'getMasterAttendanceData';
        payload.data = { fromDateStr: startDate, toDateStr: endDate, classFilter: classFilter || 'ALL', studentFilter };
      } else if (reportType === 'meal_report') {
        payload.action = 'getStudentMealCalendar';
        payload.data = { monthYear: selectedMonthYear };
      } else if (reportType === 'revenue_report') {
        const curYear = new Date().getFullYear();

        if (selectedYear === curYear) {
          const responseCurrent = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: '/api/v1/revenue',
              action: 'getRevenueReportBundle',
              loginEmail: email,
              data: { year: curYear }
            }),
            signal,
          });
          const resCurrent = await responseCurrent.json();
          if (resCurrent.success && resCurrent.data) {
            setRevenueBundleCurrent(resCurrent.data);
            setRevenueBundle(resCurrent.data);
          }
        } else {
          const [responseCurrent, responseSelected] = await Promise.all([
            fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: '/api/v1/revenue',
                action: 'getRevenueReportBundle',
                loginEmail: email,
                data: { year: curYear }
              }),
              signal,
            }),
            fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                path: '/api/v1/revenue',
                action: 'getRevenueReportBundle',
                loginEmail: email,
                data: { year: selectedYear }
              }),
              signal,
            })
          ]);

          const [resCurrent, resSelected] = await Promise.all([
            responseCurrent.json(),
            responseSelected.json()
          ]);

          if (resCurrent.success && resCurrent.data) {
            setRevenueBundleCurrent(resCurrent.data);
          }
          if (resSelected.success && resSelected.data) {
            setRevenueBundle(resSelected.data);
          }
        }

        setTransactions([]);
        setLoading(false);
        return;
      } else if (reportType === 'email_history') {
        payload.action = 'getEmailLogAll';
        payload.data = { limit: 500 };
      }

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });

      const res = await response.json();
      if (res.success && res.data) {
        if (reportType === 'missing_attendance') {
          setMissingData(res.data.rows || []);
          setTotalMissing(res.data.totalMissing || 0);
          setTotalDone(res.data.totalDone || 0);
          setHasCheckedMissing(true);
        } else if (reportType === 'master_attendance') {
          setMasterData(res.data.details || []);
          setHasCheckedMaster(true);
        } else if (reportType === 'meal_report') {
          const daysData = res.data.days || [];
          setMealDays(daysData);
          if (daysData.length > 0) {
            setSelectedMealDay(daysData[0]);
          } else {
            setSelectedMealDay(null);
          }
        } else if (reportType === 'email_history') {
          setEmailLogs(res.data || []);
        }
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching report:', e);
      setLoading(false);
    }
  }, [
    user,
    reportType,
    selectedYear,
    selectedMonthYear,
    startDate,
    endDate,
    studentFilter,
    classFilter,
    getSignal,
  ]);

  // Initial load - Skip auto-fetch for missing/master attendance logs
  useEffect(() => {
    if (user && reportType !== 'missing_attendance' && reportType !== 'master_attendance') {
      fetchReport();
    }
  }, [user, reportType, fetchReport]);

  const fetchClassesList = useCallback(async () => {
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'GET',
          loginEmail: email,
        }),
      });
      const res = await response.json();
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const rows = res.data;
        const header = rows[0].map((h: any) => String(h || '').trim());
        const iId = header.indexOf('ID');
        const iName = header.indexOf('Tên lớp');
        const iStatus = header.indexOf('Trạng thái');

        const parsedClasses = rows.slice(1).map((row: any) => {
          const id = iId > -1 ? String(row[iId] || '') : '';
          const name = iName > -1 ? String(row[iName] || '') : '';
          const status = iStatus > -1 ? String(row[iStatus] || '') : '';
          return { id, name, status };
        });

        // Filter for "Đang học" only
        const activeClasses = parsedClasses.filter((c: any) => {
          const s = String(c.status || '').trim().toLowerCase();
          return s === 'đang học' || s === 'dang hoc';
        });

        setClassesList(activeClasses);
      }
    } catch (err) {
      console.error('Error fetching classes list:', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchClassesList();
    }
  }, [user, fetchClassesList]);

  const handleBounceCheck = async () => {
    try {
      setCheckingBounce(true);
      setEmailBounceStatus('Đang quét Gmail tìm kiếm email bounce lỗi (30 ngày gần nhất)...');
      const email = user?.email || '';

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/reports',
          action: 'checkEmailBounces',
          loginEmail: email,
        }),
      });

      const res = await response.json();
      if (res.success && res.data) {
        const bounced = res.data.bounced || [];
        const updated = res.data.updated || 0;
        alert(`Kiểm tra email lỗi hoàn tất! Phát hiện ${bounced.length} email bị trả về (bounced). Đã cập nhật ${updated} dòng.`);
        fetchReport();
      } else {
        alert('Kiểm tra email hoàn thành, không phát hiện lỗi gửi.');
      }
    } catch (err) {
      console.error(err);
      alert('Không thể thực hiện kiểm tra email lỗi.');
    } finally {
      setCheckingBounce(false);
      setEmailBounceStatus(null);
    }
  };

  const getAttendanceStatusBadge = (status: string) => {
    const s = String(status || '').toUpperCase().trim();
    if (s === 'A' || s === 'X' || s === 'CÓ' || s === '1' || s === 'PRESENT') {
      return <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-xs rounded-full">CÓ MẶT</span>;
    }
    if (s === 'C' || s === 'P' || s.includes('PHÉP') || s === 'EXCUSED') {
      return <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 font-bold text-xs rounded-full">CÓ PHÉP</span>;
    }
    return <span className="px-2.5 py-0.5 bg-red-50 text-red-700 font-bold text-xs rounded-full">VẮNG</span>;
  };

  const formatMoney = (v: any) => {
    const n = Number(v) || 0;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
  };

  // Filter email logs
  const filteredEmailLogs = emailLogs.filter((log) => {
    const q = emailSearchQuery.toLowerCase();
    const matchSearch =
      log.studentName.toLowerCase().includes(q) ||
      log.email.toLowerCase().includes(q) ||
      log.className.toLowerCase().includes(q) ||
      log.subject.toLowerCase().includes(q);

    if (emailStatusFilter) {
      const isErrorLog = log.status.toLowerCase().includes('lỗi') || log.status.toLowerCase() === 'error';
      if (emailStatusFilter === 'success') return !isErrorLog && matchSearch;
      if (emailStatusFilter === 'error') return isErrorLog && matchSearch;
    }

    return matchSearch;
  });

  // Filter meal calendar sidebar student list
  const filteredMealStudents = selectedMealDay?.students.filter((st) =>
    st.name.toLowerCase().includes(mealSearchQuery.toLowerCase()) ||
    st.khId.toLowerCase().includes(mealSearchQuery.toLowerCase())
  ) || [];

  const parseFileUrls = (raw: string | undefined) => {
    if (!raw) return [];
    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch (e) { }
    return raw.split(/[;,]\s*/).map((u, i) => ({ name: `Đính kèm ${i + 1}`, url: u.trim() })).filter(f => f.url);
  };

  // Dynamic counts for Missing Attendance based on search query
  const filteredMissingCounts = React.useMemo(() => {
    let missing = 0;
    let done = 0;
    missingData.forEach((item) => {
      const matchesSearch = missingClassFilter
        ? item.className.toLowerCase().includes(missingClassFilter.trim().toLowerCase())
        : true;
      if (matchesSearch) {
        if (item.hasAttendance) {
          done++;
        } else {
          missing++;
        }
      }
    });
    return { missing, done };
  }, [missingData, missingClassFilter]);

  // Filter missingData based on the selected sub-tab and class search query
  const filteredMissingData = React.useMemo(() => {
    return missingData.filter((item) => {
      const matchesSearch = missingClassFilter
        ? item.className.toLowerCase().includes(missingClassFilter.trim().toLowerCase())
        : true;
      if (!matchesSearch) return false;

      if (missingSubTab === 'not_done') {
        return !item.hasAttendance;
      } else {
        return item.hasAttendance;
      }
    });
  }, [missingData, missingSubTab, missingClassFilter]);

  // 1. Pagination for Missing Attendance
  const {
    paginatedData: paginatedMissing,
    currentPage: missingPage,
    setCurrentPage: setMissingPage,
    totalPages: missingTotalPages,
    startIndex: missingStartIndex,
    getPageNumbers: getMissingPageNumbers,
  } = usePagination(filteredMissingData, 10, [startDate, endDate, missingSubTab, missingClassFilter, filteredMissingData]);

  // 2. Pivot & Pagination for Master Attendance
  const uniqueDates = Array.from(new Set(masterData.map(item => item.date)))
    .sort((a, b) => {
      try {
        const partsA = a.split('/');
        const partsB = b.split('/');
        const dateA = new Date(parseInt(partsA[2] || '2026'), parseInt(partsA[1] || '1') - 1, parseInt(partsA[0] || '1'));
        const dateB = new Date(parseInt(partsB[2] || '2026'), parseInt(partsB[1] || '1') - 1, parseInt(partsB[0] || '1'));
        return dateA.getTime() - dateB.getTime();
      } catch (e) {
        return 0;
      }
    });

  const pivotList = React.useMemo(() => {
    const pivotGroups: Record<string, {
      studentName: string;
      className: string;
      attendance: Record<string, string>;
      summary: { present: number; excused: number; absent: number };
    }> = {};

    masterData.forEach(item => {
      const key = `${item.name}|||${item.class}`;
      if (!pivotGroups[key]) {
        pivotGroups[key] = {
          studentName: item.name,
          className: item.class,
          attendance: {},
          summary: { present: 0, excused: 0, absent: 0 }
        };
      }

      const s = String(item.status || '').toUpperCase().trim();
      let normalized = '';
      if (s === 'A' || s === 'X' || s === 'CÓ' || s === '1' || s === 'PRESENT') {
        normalized = 'A';
        pivotGroups[key].summary.present++;
      } else if (s === 'C' || s === 'P' || s.includes('PHÉP') || s === 'EXCUSED') {
        normalized = 'C';
        pivotGroups[key].summary.excused++;
      } else if (s && s !== '—' && s !== '-') {
        normalized = 'K';
        pivotGroups[key].summary.absent++;
      }

      pivotGroups[key].attendance[item.date] = normalized;
    });

    return Object.values(pivotGroups).sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));
  }, [masterData]);

  const {
    paginatedData: paginatedMaster,
    currentPage: masterPage,
    setCurrentPage: setMasterPage,
    totalPages: masterTotalPages,
    startIndex: masterStartIndex,
    getPageNumbers: getMasterPageNumbers,
  } = usePagination(pivotList, 10, [startDate, endDate, classFilter, studentFilter, pivotList]);

  // 3. Pagination for Email Logs
  const {
    paginatedData: paginatedEmails,
    currentPage: emailPage,
    setCurrentPage: setEmailPage,
    totalPages: emailTotalPages,
    startIndex: emailStartIndex,
    getPageNumbers: getEmailPageNumbers,
  } = usePagination(filteredEmailLogs, 10, [emailSearchQuery, emailStatusFilter]);

  // Render Sunday-to-Saturday calendar cells for Meal calendar
  const renderMealCalendar = () => {
    if (!selectedMonthYear) return null;
    const [yStr, mStr] = selectedMonthYear.split('-');
    const year = parseInt(yStr) || new Date().getFullYear();
    const month = parseInt(mStr) || (new Date().getMonth() + 1);

    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month, 0).getDate();

    const weekHeaders = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ type: 'empty', key: `empty-${i}` });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dayData = mealDays.find((day) => day.dateNum === d) || {
        dateNum: d,
        studentsCount: 0,
        students: [],
      };
      cells.push({ type: 'day', dayNum: d, data: dayData, key: `day-${d}` });
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-7 gap-2.5">
          {weekHeaders.map((h, i) => (
            <div key={i} className="text-center font-extrabold text-[10px] text-slate-400 uppercase py-1 select-none">
              {h}
            </div>
          ))}

          {cells.map((cell) => {
            if (cell.type === 'empty') {
              return <div key={cell.key} className="aspect-square bg-slate-50/20 rounded-xl border border-transparent" />;
            }

            const dayNum = cell.dayNum!;
            const data = cell.data!;
            const isSelected = selectedMealDay?.dateNum === dayNum;
            const hasMeals = data.studentsCount > 0;

            return (
              <button
                key={cell.key}
                onClick={() => {
                  setSelectedMealDay(data);
                  setMealSearchQuery('');
                }}
                className={`aspect-square p-2 rounded-xl border flex flex-col justify-between items-center transition-all cursor-pointer relative group ${isSelected
                  ? 'bg-[#21398A] text-white border-[#21398A] shadow-md shadow-[#21398a]/15 scale-[1.03]'
                  : hasMeals
                    ? 'bg-emerald-50/30 border-emerald-100 hover:bg-emerald-50/60 text-slate-800'
                    : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-800'
                  }`}
              >
                <span className={`text-xs font-black self-start ${isSelected ? 'text-white' : 'text-slate-700'}`}>
                  {dayNum}
                </span>

                {hasMeals && (
                  <span
                    className={`px-1.5 py-0.5 text-[8px] font-black rounded-full truncate max-w-full text-center ${isSelected ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                      }`}
                  >
                    {data.studentsCount} suất
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleTxSort = (col: 'date' | 'name' | 'className' | 'amount' | 'loaiPhi') => {
    if (txSortCol === col) {
      setTxSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setTxSortCol(col);
      setTxSortDir('desc');
    }
    setTxPage(1);
  };

  // Filtered and sorted transactions list
  const filteredAndSortedTransactions = React.useMemo(() => {
    let list = transactions;
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase().trim();
      list = list.filter(item => {
        return (
          String(item.name || '').toLowerCase().includes(q) ||
          String(item.className || '').toLowerCase().includes(q) ||
          String(item.loaiPhi || '').toLowerCase().includes(q) ||
          String(item.note || '').toLowerCase().includes(q) ||
          String(item.method || '').toLowerCase().includes(q) ||
          String(item.creator || '').toLowerCase().includes(q)
        );
      });
    }

    if (txTypeFilter !== 'all') {
      list = list.filter(item => item.txClass === txTypeFilter);
    }

    list = [...list].sort((a, b) => {
      let valA: any = a[txSortCol];
      let valB: any = b[txSortCol];

      if (txSortCol === 'date') {
        valA = a.dateSort || 0;
        valB = b.dateSort || 0;
      } else if (txSortCol === 'amount') {
        valA = Number(a.amount) || 0;
        valB = Number(b.amount) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return txSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return txSortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [transactions, txSearch, txTypeFilter, txSortCol, txSortDir]);

  // Pagination for transactions list
  const perPage = 10;
  const totalTxPages = Math.ceil(filteredAndSortedTransactions.length / perPage) || 1;

  const paginatedTransactions = React.useMemo(() => {
    const startIdx = (txPage - 1) * perPage;
    return filteredAndSortedTransactions.slice(startIdx, startIdx + perPage);
  }, [filteredAndSortedTransactions, txPage]);

  // Compute Revenue yearly category values
  const yearlyTuition = revenueBundle?.monthlyData.reduce((sum, item) => sum + (item.tuition || 0), 0) || 0;
  const yearlyMeal = revenueBundle?.monthlyData.reduce((sum, item) => sum + (item.meal || 0), 0) || 0;
  const yearlyBook = revenueBundle?.monthlyData.reduce((sum, item) => sum + (item.book || 0), 0) || 0;
  const yearlyOther = revenueBundle?.monthlyData.reduce((sum, item) => sum + (item.other || 0), 0) || 0;
  const totalYearlyCollected = yearlyTuition + yearlyMeal + yearlyBook + yearlyOther;

  const feeCategories = [
    { label: 'Học phí', value: yearlyTuition, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50 text-blue-700' },
    { label: 'Tiền ăn', value: yearlyMeal, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50 text-emerald-700' },
    { label: 'Tiền sách', value: yearlyBook, color: 'from-amber-500 to-orange-600', bg: 'bg-amber-50 text-amber-700' },
    { label: 'Phí khác', value: yearlyOther, color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50 text-purple-700' },
  ];

  const maxCategoryValue = Math.max(...feeCategories.map(c => c.value)) || 1;

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <BarChart3 size={28} className="text-[#21398A]" />
            <span>Trung Tâm Báo Cáo & Phân Tích</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Bảng điều khiển báo cáo chuyên sâu và đối soát số liệu theo thời gian thực.
          </p>
        </div>

        <button
          onClick={fetchReport}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#21398A] hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-[0.98] self-start cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Tải lại dữ liệu</span>
        </button>
      </div>

      {/* Main Content Area (100% full width to maximize table/calendar space) */}
      <div className="space-y-6">
        {/* Universal parameters filter card based on active report */}
        {reportType !== 'revenue_report' && (
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <span>Cấu hình bộ lọc báo cáo</span>
            </div>

            <div className={`grid grid-cols-1 gap-4 ${reportType === 'master_attendance' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {/* Month-Year filter for Meal Report */}
              {reportType === 'meal_report' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Chọn tháng ăn</label>
                  <input
                    type="month"
                    value={selectedMonthYear}
                    onChange={(e) => setSelectedMonthYear(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                  />
                </div>
              )}

              {/* Date ranges for Attendance reports */}
              {reportType === 'missing_attendance' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Từ ngày (tối đa 10 ngày)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Đến ngày</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    />
                  </div>
                  <div className="hidden">
                    <label className="hidden text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tìm kiếm Lớp học</label>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={missingClassFilter}
                        onChange={(e) => setMissingClassFilter(e.target.value)}
                        placeholder="Nhập tên lớp..."
                        className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                      />
                      {missingClassFilter && (
                        <button
                          onClick={() => setMissingClassFilter('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchReport}
                      disabled={loading}
                      className="w-full px-4 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 h-[42px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      <span>Kiểm tra</span>
                    </button>
                  </div>
                </>
              )}

              {reportType === 'master_attendance' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Từ ngày</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Đến ngày</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Chọn Lớp học (Đang học)</label>
                    <select
                      value={classFilter}
                      onChange={(e) => setClassFilter(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    >
                      <option value="">Tất cả lớp học</option>
                      {classesList.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={fetchReport}
                      disabled={loading}
                      className="w-full px-4 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 h-[42px] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                      <span>Kiểm tra</span>
                    </button>
                  </div>
                </>
              )}

              {/* Email search toolbar inline */}
              {reportType === 'email_history' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Tìm kiếm từ khóa</label>
                    <input
                      type="text"
                      value={emailSearchQuery}
                      onChange={(e) => setEmailSearchQuery(e.target.value)}
                      placeholder="Tìm tên HS, email, tiêu đề..."
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Lọc trạng thái</label>
                    <select
                      value={emailStatusFilter}
                      onChange={(e) => setEmailStatusFilter(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                    >
                      <option value="">Tất cả gửi đi</option>
                      <option value="success">✓ Thành công</option>
                      <option value="error">✗ Bị lỗi gửi</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Bounce check trigger bar for email */}
            {reportType === 'email_history' && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] text-slate-400 font-bold">Quét thư báo lỗi bị trả lại từ máy chủ Google</span>
                <button
                  onClick={handleBounceCheck}
                  disabled={checkingBounce}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  <AlertCircle size={13} />
                  <span>{checkingBounce ? 'Đang quét bounce...' : 'Kiểm tra email lỗi (Bounce Check)'}</span>
                </button>
              </div>
            )}

            {emailBounceStatus && (
              <div className="bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-3 text-xs font-semibold animate-pulse">
                {emailBounceStatus}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE SCREEN CONTENT */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          {loading ? (
            <div className="py-32 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
              <RefreshCw size={24} className="animate-spin text-[#21398A]" />
              <span>Đang kết nối và tổng hợp số liệu...</span>
            </div>
          ) : (
            <>
              {/* 1. MISSING ATTENDANCE SCREEN */}
              {reportType === 'missing_attendance' && (
                <>
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <h3 className="font-extrabold text-slate-800 text-base">Danh sách Lớp điểm danh (Kiểm tra)</h3>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="relative w-full sm:w-72">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={missingClassFilter}
                          onChange={(e) => setMissingClassFilter(e.target.value)}
                          placeholder="Tìm tên lớp..."
                          className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white outline-none text-slate-800 focus:border-[#21398A] text-xs font-semibold"
                        />
                        {missingClassFilter && (
                          <button
                            type="button"
                            onClick={() => setMissingClassFilter('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Tab Selector in Card Header */}
                    {hasCheckedMissing && (totalMissing > 0 || totalDone > 0) && (
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <button
                          onClick={() => setMissingSubTab('not_done')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${missingSubTab === 'not_done'
                            ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-100'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${missingSubTab === 'not_done' ? 'bg-rose-600 animate-pulse' : 'bg-slate-400'}`} />
                          <span>Chưa điểm danh</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${missingSubTab === 'not_done' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                            {filteredMissingCounts.missing}
                          </span>
                        </button>

                        <button
                          onClick={() => setMissingSubTab('done')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${missingSubTab === 'done'
                            ? 'bg-emerald-50 text-emerald-700 shadow-sm border border-emerald-100'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${missingSubTab === 'done' ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'}`} />
                          <span>Đã điểm danh</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${missingSubTab === 'done' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                            {filteredMissingCounts.done}
                          </span>
                        </button>
                      </div>
                    )}
                    </div>
                  </div>

                  {!hasCheckedMissing ? (
                    <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                      <Search size={48} className="text-[#21398A]/40" />
                      <span>Vui lòng chọn khoảng thời gian và nhấn nút <strong>Kiểm tra</strong> để quét dữ liệu điểm danh.</span>
                    </div>
                  ) : (totalMissing === 0 && totalDone === 0) ? (
                    <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3 bg-white">
                      <Calendar size={48} className="text-slate-300" />
                      <span>Không có ca học nào được xếp lịch trong khoảng thời gian này.</span>
                    </div>
                  ) : filteredMissingData.length === 0 ? (
                    missingClassFilter ? (
                      <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3 bg-white">
                        <Search size={48} className="text-slate-300" />
                        <span className="font-bold text-slate-700">Không tìm thấy lớp học nào khớp với "{missingClassFilter}".</span>
                      </div>
                    ) : missingSubTab === 'not_done' ? (
                      <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3 bg-white">
                        <CheckCircle size={48} className="text-emerald-500 animate-bounce" />
                        <span className="font-bold text-slate-700">Tất cả các ca học trong khoảng thời gian này đã được điểm danh đầy đủ.</span>
                      </div>
                    ) : (
                      <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3 bg-white">
                        <AlertTriangle size={48} className="text-amber-500 animate-pulse" />
                        <span className="font-bold text-slate-700">Chưa có ca học nào đã được điểm danh trong khoảng thời gian này.</span>
                      </div>
                    )
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                              <th className="py-3 px-6 uppercase tracking-wider">Ngày học</th>
                              <th className="py-3 px-6 uppercase tracking-wider">Lớp học</th>
                              <th className="py-3 px-6 uppercase tracking-wider">Giáo viên</th>
                              <th className="py-3 px-6 uppercase tracking-wider">Phòng & Ca</th>
                              <th className="py-3 px-6 uppercase tracking-wider">Giáo viên On Air</th>
                              <th className="py-3 px-6 uppercase tracking-wider">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedMissing.map((item, idx) => {
                              const isMissing = !item.hasAttendance;
                              const rowStyle = 'text-slate-700 hover:bg-slate-50/50';
                              return (
                                <tr key={idx} className={`transition-colors ${rowStyle}`}>
                                  <td className="py-3 px-6 font-semibold">{item.date}</td>
                                  <td className="py-3 px-6 text-[#21398A] font-bold">
                                    {item.className}
                                  </td>
                                  <td className="py-3 px-6 font-semibold">{item.teacher || '—'}</td>
                                  <td className="py-3 px-6">
                                    <div>Phòng: {item.room || '—'}</div>
                                    <div className="text-[10px] mt-0.5">Ca: {item.shift || '—'}</div>
                                  </td>
                                  <td className="py-3 px-6 text-[10px] font-bold">{item.onAir || '—'}</td>
                                  <td className="py-3 px-6">
                                    {item.hasAttendance ? (
                                      <span className="px-2 py-0.5 bg-emerald-55 text-emerald-800 font-extrabold text-[10px] rounded-full">ĐÃ ĐIỂM DANH</span>
                                    ) : (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-800 font-extrabold text-[10px] rounded-full">CHƯA ĐIỂM DANH</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {missingTotalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50">
                          <div className="text-xs text-slate-500 font-medium">
                            Hiển thị từ <span>{missingStartIndex + 1}</span> đến{' '}
                            <span>{Math.min(missingStartIndex + 10, filteredMissingData.length)}</span> trong tổng số <span>{filteredMissingData.length}</span> ca học
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setMissingPage(prev => Math.max(prev - 1, 1))}
                              disabled={missingPage === 1}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Trước
                            </button>
                            {getMissingPageNumbers().map((page, idx) => (
                              <button
                                key={idx}
                                onClick={() => typeof page === 'number' && setMissingPage(page)}
                                disabled={page === '...'}
                                className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all ${missingPage === page
                                  ? 'bg-[#21398A] text-white border-[#21398A]'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              onClick={() => setMissingPage(prev => Math.min(prev + 1, missingTotalPages))}
                              disabled={missingPage === missingTotalPages}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Sau
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* 2. MASTER ATTENDANCE SCREEN */}
              {reportType === 'master_attendance' && (
                <>
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 text-base">Lịch sử Điểm danh ({pivotList.length} học viên)</h3>
                  </div>

                  {!hasCheckedMaster ? (
                    <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                      <Search size={48} className="text-[#21398A]/40" />
                      <span>Vui lòng chọn lớp học, khoảng thời gian và nhấn nút <strong>Kiểm tra</strong> để tra cứu lịch sử điểm danh.</span>
                    </div>
                  ) : pivotList.length === 0 ? (
                    <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                      <FileSpreadsheet size={48} className="text-slate-200" />
                      <span>Không tìm thấy lịch sử điểm danh nào khớp với bộ lọc.</span>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                              <th className="py-3 px-4 uppercase tracking-wider min-w-[150px]">Học sinh</th>
                              <th className="py-3 px-4 uppercase tracking-wider min-w-[100px]">Lớp</th>
                              {uniqueDates.map((date) => {
                                const shortDate = date.split('/').slice(0, 2).join('/');
                                return (
                                  <th key={date} className="py-3 px-2 uppercase tracking-wider text-center whitespace-nowrap min-w-[65px]">
                                    {shortDate}
                                  </th>
                                );
                              })}
                              <th className="py-3 px-3 uppercase tracking-wider text-center bg-emerald-50 text-emerald-800 rounded-t-lg min-w-[65px]">Đi học</th>
                              <th className="py-3 px-3 uppercase tracking-wider text-center bg-amber-50 text-amber-800 min-w-[65px]">C.Phép</th>
                              <th className="py-3 px-3 uppercase tracking-wider text-center bg-rose-50 text-rose-800 rounded-t-lg min-w-[65px]">K.Phép</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedMaster.map((row: any, idx) => (
                              <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                                <td className="py-3 px-4 font-extrabold text-slate-800 whitespace-nowrap">{row.studentName}</td>
                                <td className="py-3 px-4 font-bold text-[#21398A] whitespace-nowrap">{row.className}</td>
                                {uniqueDates.map((date) => {
                                  const status = row.attendance[date];
                                  return (
                                    <td key={date} className="py-2 px-2 text-center">
                                      <div className="flex items-center justify-center">
                                        {status === 'A' && (
                                          <span className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-[9px] shadow-xs" title="Có mặt (A)">
                                            ✓
                                          </span>
                                        )}
                                        {status === 'C' && (
                                          <span className="w-5 h-5 rounded-full bg-[#F59E0B] text-white flex items-center justify-center font-bold text-[9px] shadow-xs" title="Có phép (C)">
                                            P
                                          </span>
                                        )}
                                        {status === 'K' && (
                                          <span className="w-5 h-5 rounded-full bg-[#EF4444] text-white flex items-center justify-center font-bold text-[9px] shadow-xs" title="Vắng không phép (K)">
                                            ✗
                                          </span>
                                        )}
                                        {!status && (
                                          <span className="text-slate-200">—</span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="py-2 px-3 text-center bg-emerald-50/20 text-emerald-800 font-extrabold">{row.summary.present}</td>
                                <td className="py-2 px-3 text-center bg-amber-50/20 text-amber-800 font-extrabold">{row.summary.excused}</td>
                                <td className="py-2 px-3 text-center bg-rose-50/20 text-rose-800 font-extrabold">{row.summary.absent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {masterTotalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50">
                          <div className="text-xs text-slate-500 font-medium">
                            Hiển thị từ <span>{masterStartIndex + 1}</span> đến{' '}
                            <span>{Math.min(masterStartIndex + 10, pivotList.length)}</span> trong tổng số <span>{pivotList.length}</span> học viên
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setMasterPage(prev => Math.max(prev - 1, 1))}
                              disabled={masterPage === 1}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Trước
                            </button>
                            {getMasterPageNumbers().map((page, idx) => (
                              <button
                                key={idx}
                                onClick={() => typeof page === 'number' && setMasterPage(page)}
                                disabled={page === '...'}
                                className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all ${masterPage === page
                                  ? 'bg-[#21398A] text-white border-[#21398A]'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              onClick={() => setMasterPage(prev => Math.min(prev + 1, masterTotalPages))}
                              disabled={masterPage === masterTotalPages}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Sau
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* 3. MEAL CALENDAR SCREEN */}
              {reportType === 'meal_report' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[450px] divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  {/* Left: Monthly Meal grid calendar */}
                  <div className="lg:col-span-2 p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                      <h4 className="font-extrabold text-slate-800 text-sm">Lịch ăn học sinh trong tháng</h4>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nhấp chọn ngày để xem danh sách</span>
                    </div>

                    {mealDays.length === 0 ? (
                      <div className="py-24 text-center text-slate-400 text-xs">Không có dữ liệu suất ăn nào trong tháng này.</div>
                    ) : (
                      renderMealCalendar()
                    )}
                  </div>

                  {/* Right: Sidebar details of day */}
                  <div className="p-6 bg-slate-50/50 space-y-4 flex flex-col justify-start">
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-[#21398A] text-sm">
                        {selectedMealDay ? `Chi tiết Ngày ${selectedMealDay.dateNum}/${selectedMonthYear.split('-')[1]}` : 'Chi tiết ngày'}
                      </h4>
                      <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 font-bold rounded-md inline-block">
                        Tổng số: {selectedMealDay?.studentsCount || 0} học sinh ăn
                      </div>
                    </div>

                    {/* Search student in this day */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={mealSearchQuery}
                        onChange={(e) => setMealSearchQuery(e.target.value)}
                        placeholder="Lọc tên, mã học sinh..."
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 bg-white outline-none text-xs focus:border-[#21398A]"
                      />
                    </div>

                    <div className="space-y-2 overflow-y-auto max-h-80 flex-1">
                      {filteredMealStudents.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                          Không tìm thấy học sinh nào.
                        </div>
                      ) : (
                        filteredMealStudents.map((st, idx) => (
                          <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100/50 shadow-3xs flex items-center justify-between text-xs">
                            <div>
                              <div className="font-extrabold text-slate-800">{st.name}</div>
                              <div className="text-[9px] text-slate-400 mt-0.5">Mã KH: {st.khId}</div>
                              <div className="flex gap-1 flex-wrap mt-1">
                                {st.sessions.map((sess, sIdx) => (
                                  <span key={sIdx} className="px-1.5 py-0.2 bg-blue-50 text-[#21398A] rounded-[4px] text-[8px] font-bold uppercase">
                                    {sess}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="font-bold text-slate-600">{formatMoney(st.totalAmount)}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. REVENUE REPORT SCREEN */}
              {reportType === 'revenue_report' && revenueBundle && revenueBundleCurrent && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base">Báo Cáo Tài Chính & Doanh Thu (Năm {new Date().getFullYear()})</h3>
                      <p className="text-slate-400 text-[10px] mt-0.5">Thống kê chi tiết học phí, các khoản thu chi và đối soát công nợ</p>
                    </div>
                  </div>

                  {/* Financial KPI Stats (10 Legacy Cards in 2 Rows) */}
                  <div className="space-y-4">
                    {/* Row 1: Current Month KPI Stats (5 Columns) */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* KPI 1: Tuition */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.02 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.curMonthFee || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Học phí tháng này</span>
                            <h4 className="tht-kpi-value tht-kpi-value-primary">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.curMonthFee || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          {(() => {
                            const pct = revenueBundleCurrent.kpi?.growthFeePct || 0;
                            const isPositive = pct >= 0;
                            return (
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {isPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                <span>{isPositive ? '+' : ''}{pct}%</span>
                              </span>
                            );
                          })()}
                          <span className="text-[9px] text-slate-400 font-semibold">so với tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 2: Meal */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.04 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.curMonthMeal || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
                            <Utensils size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tiền ăn tháng này</span>
                            <h4 className="tht-kpi-value tht-kpi-value-emerald">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.curMonthMeal || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          {(() => {
                            const pct = revenueBundleCurrent.kpi?.growthMealPct || 0;
                            const isPositive = pct >= 0;
                            return (
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {isPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                <span>{isPositive ? '+' : ''}{pct}%</span>
                              </span>
                            );
                          })()}
                          <span className="text-[9px] text-slate-400 font-semibold">so với tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 3: Book & Other */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.06 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.curMonthOther || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-sky">
                            <BookOpen size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Sách & Phí khác</span>
                            <h4 className="tht-kpi-value tht-kpi-value-sky">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.curMonthOther || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          {(() => {
                            const pct = revenueBundleCurrent.kpi?.growthOtherPct || 0;
                            const isPositive = pct >= 0;
                            return (
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {isPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                <span>{isPositive ? '+' : ''}{pct}%</span>
                              </span>
                            );
                          })()}
                          <span className="text-[9px] text-slate-400 font-semibold">so với tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 4: Total Revenue (Collected) */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.curMonthRevenue || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-amber">
                            <Coins size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tổng thu (Tháng này)</span>
                            <h4 className="tht-kpi-value tht-kpi-value-amber">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.curMonthRevenue || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          {(() => {
                            const pct = revenueBundleCurrent.kpi?.growthRevenuePct || 0;
                            const isPositive = pct >= 0;
                            return (
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 ${isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                {isPositive ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                <span>{isPositive ? '+' : ''}{pct}%</span>
                              </span>
                            );
                          })()}
                          <span className="text-[9px] text-slate-400 font-semibold">so với tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 5: Current Debt */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.10 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.totalDebt || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-rose">
                            <DollarSign size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tổng nợ hiện tại</span>
                            <h4 className="tht-kpi-value tht-kpi-value-rose">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.totalDebt || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px]">Dữ liệu nợ tồn đọng</span>
                        </div>
                      </motion.div>
                    </div>

                    {/* Row 2: Legacy Monthly History & Summary (5 Columns) */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                      {/* KPI 6: Prev Month Tuition */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch bg-slate-50/20"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.prevMonthFee || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-slate">
                            <GraduationCap size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Học phí tháng trước</span>
                            <h4 className="tht-kpi-value tht-kpi-value-slate">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.prevMonthFee || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-[9px] text-slate-400 font-bold">Tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 7: Prev Month Meal */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.14 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch bg-slate-50/20"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.prevMonthMeal || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-slate">
                            <Utensils size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tiền ăn tháng trước</span>
                            <h4 className="tht-kpi-value tht-kpi-value-slate">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.prevMonthMeal || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-[9px] text-slate-400 font-bold">Tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 8: Prev Month BookOther */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.16 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch bg-slate-50/20"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.prevMonthOther || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-slate">
                            <BookOpen size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Sách & Phí khác (T.Trước)</span>
                            <h4 className="tht-kpi-value tht-kpi-value-slate">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.prevMonthOther || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-[9px] text-slate-400 font-bold">Tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 9: Prev Month Collected */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.18 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch bg-slate-50/20"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.prevMonthRevenue || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-slate">
                            <Coins size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tổng thu tháng trước</span>
                            <h4 className="tht-kpi-value tht-kpi-value-slate">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.prevMonthRevenue || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="mt-3">
                          <span className="text-[9px] text-slate-400 font-bold">Tháng trước</span>
                        </div>
                      </motion.div>

                      {/* KPI 10: Current Surplus */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.20 }}
                        className="tht-kpi-card tht-kpi-card-left group flex-col !items-stretch"
                        title={new Intl.NumberFormat('vi-VN').format(revenueBundleCurrent.kpi?.totalSurplus || 0)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="tht-kpi-icon-wrapper tht-kpi-icon-rose">
                            <PiggyBank size={24} />
                          </div>
                          <div>
                            <span className="tht-kpi-label">Tổng dư hiện tại</span>
                            <h4 className="tht-kpi-value tht-kpi-value-rose">
                              <AnimatedMoney value={revenueBundleCurrent.kpi?.totalSurplus || 0} abbreviate={true} />
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 mt-3">
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[9px]">Dữ liệu dư tồn đọng</span>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Yearly 12-Month Multi-Dataset Area Chart */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-50 pb-3 flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          <BarChart3 size={16} className="text-[#21398A]" />
                          <span>Biểu đồ cơ cấu doanh thu theo tháng</span>
                        </h4>
                        <select
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(Number(e.target.value))}
                          className="px-2 py-1 rounded-lg border border-slate-200 outline-none text-slate-700 focus:border-[#21398A] text-xs font-bold bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
                        >
                          {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                            <option key={y} value={y}>
                              Năm {y}
                            </option>
                          ))}
                        </select>
                      </div>
                      {/* Legends */}
                      <div className="flex gap-4 items-center text-[10px] font-bold text-slate-500 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-[#21398A]" />
                          <span>Tổng thu</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-[#4E73DF]" />
                          <span>Học phí</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-[#1CC88A]" />
                          <span>Tiền ăn</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded bg-[#36B9CC]" />
                          <span>Sách & Phí khác</span>
                        </div>
                      </div>
                    </div>

                    {/* Chart Container styled with AreaChart from Recharts */}
                    {(() => {
                      const chartData = revenueBundle.monthlyData.map((m, idx) => ({
                        name: `Tháng ${idx + 1}`,
                        collected: m.collected,
                        tuition: m.tuition,
                        meal: m.meal,
                        bookOther: m.book + m.other,
                      }));

                      return (
                        <div className="h-80 w-full pt-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#21398A" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#21398A" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorTuition" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#4E73DF" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#4E73DF" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorMeal" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#1CC88A" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#1CC88A" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorBookOther" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#36B9CC" stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor="#36B9CC" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(val) => {
                                if (val >= 1000000000) return `${(val / 1000000000).toFixed(1).replace(/\.0$/, '')} Tỷ`;
                                if (val >= 1000000) return `${(val / 1000000).toFixed(0)} Tr`;
                                if (val >= 1000) return `${(val / 1000).toFixed(0)} K`;
                                return String(val);
                              }} />
                              <RechartsTooltip 
                                formatter={(value: any, name: any) => {
                                  const labelMap: Record<string, string> = {
                                    collected: 'Tổng thu',
                                    tuition: 'Học phí',
                                    meal: 'Tiền ăn',
                                    bookOther: 'Sách & Khác'
                                  };
                                  return [formatMoney(value), labelMap[name] || name];
                                }}
                                contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                              />
                              <Area type="monotone" dataKey="collected" stroke="#21398A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                              <Area type="monotone" dataKey="tuition" stroke="#4E73DF" strokeWidth={2} fillOpacity={1} fill="url(#colorTuition)" />
                              <Area type="monotone" dataKey="meal" stroke="#1CC88A" strokeWidth={2} fillOpacity={1} fill="url(#colorMeal)" />
                              <Area type="monotone" dataKey="bookOther" stroke="#36B9CC" strokeWidth={2} fillOpacity={1} fill="url(#colorBookOther)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 5. EMAIL HISTORY SCREEN */}
              {reportType === 'email_history' && (
                <>
                  <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-4">
                    <h3 className="font-bold text-slate-800 text-base">Lịch sử gửi Email ({filteredEmailLogs.length})</h3>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Toàn bộ lịch sử gửi thư báo học tập, học phí</span>
                  </div>

                  {filteredEmailLogs.length === 0 ? (
                    <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                      <Mail size={48} className="text-slate-200" />
                      <span>Không tìm thấy lịch sử gửi email nào khớp với bộ lọc.</span>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                              <th className="py-3 px-4 uppercase tracking-wider">Học sinh</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Phụ huynh Email</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Lớp</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Ngày gửi</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Tiêu đề</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Đính kèm</th>
                              <th className="py-3 px-4 uppercase tracking-wider">Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedEmails.map((log, idx) => {
                              const isError = log.status.toLowerCase().includes('lỗi') || log.status.toLowerCase() === 'error';
                              const files = parseFileUrls(log.fileUrlsRaw || log.fileUrls);

                              return (
                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors text-slate-700">
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-slate-800">{log.studentName}</div>
                                    <div className="text-[9px] text-slate-400 mt-0.5">Mã KH: {log.khId}</div>
                                  </td>
                                  <td className="py-3 px-4 font-medium text-slate-600">{log.email}</td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold rounded">
                                      {log.className}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-400 font-semibold">{log.sentDate ? log.sentDate.split('GMT')[0].trim() : '—'}</td>
                                  <td className="py-3 px-4 max-w-[150px] truncate font-medium text-slate-600" title={log.subject}>
                                    {log.subject}
                                  </td>
                                  <td className="py-3 px-4 space-y-1">
                                    {files.length === 0 ? (
                                      <span className="text-[10px] text-slate-400 font-bold">Không có file</span>
                                    ) : (
                                      files.map((f: any, fIdx: number) => (
                                        <a
                                          key={fIdx}
                                          href={f.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-bold max-w-[100px] truncate cursor-pointer"
                                        >
                                          <Paperclip size={10} />
                                          <span className="truncate">{f.name || 'file'}</span>
                                        </a>
                                      ))
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    {isError ? (
                                      <span className="flex items-center gap-0.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold text-[9px] w-fit">
                                        <X size={10} />
                                        Gửi lỗi
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold text-[9px] w-fit">
                                        <Check size={10} />
                                        Đã gửi
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Controls */}
                      {emailTotalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/50">
                          <div className="text-xs text-slate-500 font-medium">
                            Hiển thị từ <span>{emailStartIndex + 1}</span> đến{' '}
                            <span>{Math.min(emailStartIndex + 10, filteredEmailLogs.length)}</span> trong tổng số <span>{filteredEmailLogs.length}</span> email
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setEmailPage(prev => Math.max(prev - 1, 1))}
                              disabled={emailPage === 1}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Trước
                            </button>
                            {getEmailPageNumbers().map((page, idx) => (
                              <button
                                key={idx}
                                onClick={() => typeof page === 'number' && setEmailPage(page)}
                                disabled={page === '...'}
                                className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all ${emailPage === page
                                  ? 'bg-[#21398A] text-white border-[#21398A]'
                                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                  }`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              onClick={() => setEmailPage(prev => Math.min(prev + 1, emailTotalPages))}
                              disabled={emailPage === emailTotalPages}
                              className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                              Sau
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {/* Date Limit Warning Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden transform scale-100 transition-all">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center animate-bounce">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-slate-800">Giới hạn thời gian lọc</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Khoảng thời gian kiểm tra điểm danh không được vượt quá <strong className="text-rose-600 font-extrabold">10 ngày</strong> để đảm bảo tốc độ phản hồi và tính chính xác cao nhất cho hệ thống.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 p-4 flex justify-end gap-2 border-t border-slate-100">
              <button
                onClick={() => setShowLimitModal(false)}
                className="px-4 py-2 bg-[#21398A] hover:bg-[#1a2d6e] text-white text-xs font-bold rounded-xl shadow-md shadow-[#21398a]/10 cursor-pointer transition-all active:scale-[0.98]"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#21398A]" />
        <span>Đang tải trung tâm báo cáo...</span>
      </div>
    }>
      <ReportsContent />
    </Suspense>
  );
}
