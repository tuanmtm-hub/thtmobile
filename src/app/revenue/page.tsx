'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { usePagination } from '@/hooks/usePagination';
import {
  CreditCard,
  Search,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  X,
  Coins,
  History,
  Layers,
  Sparkles,
  CheckCircle,
  Printer,
  FileText,
  Shield,
} from 'lucide-react';
import LoadingOverlay from '@/components/LoadingOverlay';

const REVENUE_API_URL = process.env.NEXT_PUBLIC_APPS_SCRIPT_API_URL || '/api/proxy';

interface DebtItem {
  congNoId: string;
  student: string;
  className: string;
  lhId: string;
  studyType: string;
  enrollDate: string;
  startDate: string;
  endDate: string;
  debt: number;
  khId: string;
  note: string;
  refCode: string;
  hasDiscount: boolean;
  period?: string;
  feeType?: string;
}

interface BreakdownItem {
  type: string;
  must: number;
  paid: number;
  debt: number;
}

interface OldDebtItem {
  type: string;
  ref: string;
  debt: number;
  label: string;
}

interface OldDebtPaymentPayload {
  type: string;
  ref: string;
  paid: number;
  surplusApplied: number;
}

interface StudentBreakdown {
  items: BreakdownItem[];
  oldDebt: number;
  oldDebtItems: OldDebtItem[];
  surplus: number;
  studentDob?: string;
  teacherCN?: string;
  beginTerm?: string;
  endTerm?: string;
}

interface AllocationItem {
  type: string;
  curDebt: number;
  discountPct: number;
  discountVND: number;
  newDebt: number;
  mustPay: number;
  paid: number;
  remain: number;
  surplusApplied: number;
}

interface VoucherInfo {
  id: string;
  name: string;
  discountType: string;
  discountValue: number;
  description: string;
  status?: string;
}

interface SurplusItem {
  student: string;
  className: string;
  surplus: number;
  khId: string;
  refCode: string;
  displayRefCode: string;
}

interface TxHistoryDetail {
  loaiPhi: string;
  amount: number;
  discountVND?: number;
  mustPay?: number;
}

interface TxHistoryItem {
  id?: string;
  date: string;
  txType: string;
  txClass: string; // 'thu' | 'no'
  name: string;
  className: string;
  loaiPhi: string;
  amount: number;
  method: string;
  status: string;
  creator: string;
  note: string;
  khId?: string;
  lhId?: string;
  details?: TxHistoryDetail[];
}

const formatVietnameseNumber = (value: number | string): string => {
  if (value === undefined || value === null || value === '') return '';
  const numStr = String(value).replace(/[^\d]/g, '');
  if (!numStr) return '';
  return Number(numStr).toLocaleString('vi-VN');
};

const parseVietnameseNumber = (str: string): number => {
  if (!str) return 0;
  const cleanStr = str.replace(/[^\d]/g, '');
  return parseInt(cleanStr, 10) || 0;
};

function extractPeriodText(refCode: string) {
  const matches = refCode.match(/(\d{4})-(\d{2})/);
  if (matches) {
    const label = /^(KHOA|GIO|KC|KG)-/i.test(refCode) ? 'Khóa' : 'Tháng';
    return `${label} ${matches[2]}/${matches[1]}`;
  }
  return '';
}

export default function Revenue() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const getSignal = useAbortController();
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('THT_CompanyInfo');
      if (cached) {
        try {
          setCompanyInfo(JSON.parse(cached));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  const userPerms = user?.permissions || {};
  const isAdmin = user?.role === 'Admin' || userPerms['perm_admin'] === true;
  const NO_PERM_MSG = 'Bạn không có quyền thực hiện thao tác này. Hãy liên hệ Quản Trị Viên';

  const [showPermModal, setShowPermModal] = useState(false);

  const checkPermission = (permKey: string) => {
    if (isAdmin) return true;
    if (userPerms[permKey] === true) return true;
    setShowPermModal(true);
    return false;
  };

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('debt'); // 'debt' | 'surplus' | 'history'

  // Data States
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [surpluses, setSurpluses] = useState<SurplusItem[]>([]);
  const [history, setHistory] = useState<TxHistoryItem[]>([]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Panel State
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState('Chuyển khoản');
  const [payNote, setPayNote] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);
  const [isGeneratingDebt, setIsGeneratingDebt] = useState(false);
  const [activePrintReceipt, setActivePrintReceipt] = useState<any | null>(null);
  const [selectedHistoryTx, setSelectedHistoryTx] = useState<TxHistoryItem | null>(null);

  // States for Debt Detail Modal
  const [selectedDebtForDetail, setSelectedDebtForDetail] = useState<DebtItem | null>(null);
  const [detailBreakdown, setDetailBreakdown] = useState<StudentBreakdown | null>(null);
  const [loadingDetailBreakdown, setLoadingDetailBreakdown] = useState(false);
  const [detailVouchers, setDetailVouchers] = useState<VoucherInfo[]>([]);

  // State nâng cấp cho Form Thu học phí Premium 8 cột
  const [breakdown, setBreakdown] = useState<StudentBreakdown | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [useSurplus, setUseSurplus] = useState(false);
  const [selectedOldDebts, setSelectedOldDebts] = useState<string[]>([]); // Lưu unique key "type-ref" của nợ cũ được tích chọn
  const [vouchers, setVouchers] = useState<VoucherInfo[]>([]); // Danh sách voucher của học sinh

  // Bảng phân bổ 4 hàng cố định: Học phí, Tiền ăn, Tiền sách, Phí khác
  const [allocations, setAllocations] = useState<AllocationItem[]>([]);

  // State tổng cộng 8 cột footer bảng
  const [totalSummary, setTotalSummary] = useState({
    curDebt: 0,
    discountPct: 0,
    discountVND: 0,
    newDebt: 0,
    mustPay: 0,
    paid: 0,
    surplusApplied: 0,
    remain: 0,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Manual Generation Dialog State
  const [showGenModal, setShowGenModal] = useState(false);
  const [genClassType, setGenClassType] = useState('Tháng');
  const [genMonthYear, setGenMonthYear] = useState('');
  const [classesList, setClassesList] = useState<{ id: string; name: string; status?: string }[]>([]);
  const [genClassId, setGenClassId] = useState<string>(''); // '' means "Tất cả các lớp"
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
    window.setTimeout(() => setShowSuccessModal(false), 2000);
  };

  useEffect(() => {
    if (selectedDebt) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Quản lý thu chi', onClick: () => setSelectedDebt(null) },
        { label: `Thu học phí: ${selectedDebt.student}` }
      ]);
    } else {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Quản lý thu chi' }
      ]);
    }
  }, [selectedDebt, setBreadcrumbs]);

  const fetchRevenueData = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';

      // Fetch all reports concurrently in parallel for 3x performance increase
      const [debtRes, surplusRes, txRes] = await Promise.all([
        fetch(REVENUE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/revenue',
            action: 'getDebtReport',
            loginEmail: email,
          }),
          signal,
        }),
        fetch(REVENUE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/revenue',
            action: 'getSurplusReport',
            loginEmail: email,
          }),
          signal,
        }),
        fetch(REVENUE_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/revenue',
            action: 'getTransactionHistory',
            loginEmail: email,
            data: { type: 'all', search: '', page: 1, perPage: 50 },
          }),
          signal,
        })
      ]);

      const [debtData, surplusData, txData] = await Promise.all([
        debtRes.json(),
        surplusRes.json(),
        txRes.json()
      ]);

      setDebts(debtData.success ? debtData.data || [] : []);
      setSurpluses(surplusData.success ? surplusData.data || [] : []);
      setHistory(txData.success && txData.data ? txData.data.rows || [] : []);

      setLoading(false);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      console.error('Error fetching revenue reports:', e);
      setLoading(false);
    }
  }, [user, getSignal]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRevenueData();
  }, [user, fetchRevenueData]);

  const fetchClassesList = useCallback(async () => {
    try {
      const email = user?.email || '';
      const response = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'GET',
          loginEmail: email,
        }),
      });
      const data = await response.json();
      if (data && data.success && Array.isArray(data.data)) {
        const rows = data.data;
        if (rows.length > 1) {
          const headers = rows[0].map((h: string) => String(h || '').trim());
          const iId = headers.indexOf('ID');
          const iName = headers.indexOf('Tên lớp');
          const iStatus = headers.indexOf('Trạng thái');

          const parsedClasses = rows.slice(1).map((row: any) => {
            return {
              id: iId >= 0 ? String(row[iId] || '').trim() : '',
              name: iName >= 0 ? String(row[iName] || '').trim() : '',
              status: iStatus >= 0 ? String(row[iStatus] || '').trim() : '',
            };
          });

          // Lọc các lớp đang hoạt động. Dữ liệu cũ có thể dùng "Đang học",
          // còn UI mới có thể gọi là "Đang hoạt động".
          const activeClasses = parsedClasses.filter((c: any) => {
            const status = String(c.status || '').trim().toLowerCase();
            const isActive = status === 'đang hoạt động' || status === 'đang học' || status === 'active';
            return isActive && c.id && c.name;
          });
          activeClasses.sort((a: any, b: any) => a.name.localeCompare(b.name, 'vi'));
          setClassesList(activeClasses);
        }
      }
    } catch (err) {
      console.error('Error fetching classes list in revenue:', err);
    }
  }, [user]);

  useEffect(() => {
    fetchClassesList();
  }, [user, fetchClassesList]);

  const recomputeAllocation = useCallback((
    updatedList: AllocationItem[],
    useSurplusState: boolean,
    voucherList: VoucherInfo[],
    selectedOldDebtsList: string[],
    currentBreakdown: StudentBreakdown | null,
    activeFeeType?: string
  ) => {
    let totalCurDebt = 0;
    let totalDiscVND = 0;
    let totalNewDebt = 0;
    let totalMustPay = 0;
    let totalPaid = 0;
    let totalRemain = 0;

    // Tính tổng tiền dư khả dụng để cấn trừ
    let remainingSurplus = useSurplusState && currentBreakdown ? currentBreakdown.surplus : 0;

    // 1. Tìm các nợ cũ được chọn để cộng dồn vào 'Nợ hiện tại'
    const oldDebtMap: { [key: string]: number } = {};
    if (currentBreakdown && selectedOldDebtsList.length > 0) {
      selectedOldDebtsList.forEach(key => {
        const [type, ref] = key.split('||');
        const matched = currentBreakdown.oldDebtItems.find(i => i.type === type && i.ref === ref);
        if (matched) {
          oldDebtMap[type] = (oldDebtMap[type] || 0) + matched.debt;
        }
      });
    }

    // 2. Duyệt qua danh sách để tính toán từng hàng
    const recomputed = updatedList.map(item => {
      // Nợ hiện tại = nợ đợt này + nợ cũ được chọn
      const shouldUseCurrentDebt = !activeFeeType || item.type === activeFeeType;
      const baseDebt = shouldUseCurrentDebt ? (currentBreakdown?.items.find(i => i.type === item.type)?.debt || 0) : 0;
      const oldDebt = oldDebtMap[item.type] || 0;
      const curDebt = baseDebt + oldDebt;

      // Chiết khấu chỉ áp dụng lần đầu cho cùng đợt học phí.
      let discountVND = 0;
      const currentItem = currentBreakdown?.items.find(i => i.type === item.type);
      const hasPriorPayment = item.type === 'Học phí' && (currentItem?.paid || 0) > 0;
      const discountPct = hasPriorPayment ? 0 : item.discountPct;
      if (item.type === 'Học phí' && !hasPriorPayment) {
        // Chiết khấu phần trăm
        discountVND = Math.round((curDebt + item.newDebt) * discountPct / 100);

        // Cộng thêm Voucher chiết khấu tiền mặt (nếu có)
        voucherList.forEach(vc => {
          if (vc.discountType === '%') {
            // Đã cộng vào discountPct bên trên hoặc tự tính
          } else {
            // Chiết khấu tiền mặt
            const maxVndDiscountPossible = Math.max(0, (curDebt + item.newDebt) - discountVND);
            discountVND += Math.min(vc.discountValue, maxVndDiscountPossible);
          }
        });
      }      // Phải đóng = Nợ hiện tại + Phí phát sinh - Tiền chiết khấu
      const mustPay = Math.max(0, curDebt + item.newDebt - discountVND);

      // Cấn trừ tiền dư theo từng dòng phí. Người dùng có thể phân bổ số dư
      // vào bất kỳ loại phí nào, miễn không vượt quá số dư khả dụng và số phải đóng.
      let surplusApplied = 0;
      if (useSurplusState && remainingSurplus > 0) {
        surplusApplied = Math.min(Math.max(0, item.surplusApplied || 0), mustPay, remainingSurplus);
        remainingSurplus -= surplusApplied;
      }

      const cashMustPay = Math.max(0, mustPay - surplusApplied);

      // Thu thực tế
      let paid = item.paid;
      // Nếu số tiền đóng cũ bằng số tiền phải đóng cũ, giữ chế độ tự động:
      // khi bật/tắt cấn trừ, số thu thực tế tự đổi theo phần còn phải thu.
      if (item.paid === item.mustPay) {
        paid = cashMustPay;
      }

      if (mustPay <= 0) {
        paid = 0;
      }

      // Còn nợ lại = Phải đóng - Thu thực tế - Tiền dư cấn trừ
      const remain = mustPay - paid - surplusApplied;

      // Cộng dồn tổng cộng
      totalCurDebt += curDebt;
      totalDiscVND += discountVND;
      totalNewDebt += item.newDebt;
      totalMustPay += mustPay;
      totalPaid += paid;
      totalRemain += remain;

      return {
        ...item,
        curDebt,
        discountPct,
        discountVND,
        mustPay,
        paid,
        remain,
        surplusApplied
      };
    });

    setAllocations(recomputed);
    setTotalSummary({
      curDebt: totalCurDebt,
      discountPct: 0,
      discountVND: totalDiscVND,
      newDebt: totalNewDebt,
      mustPay: totalMustPay,
      paid: totalPaid,
      surplusApplied: recomputed.reduce((sum, item) => sum + item.surplusApplied, 0),
      remain: totalRemain
    });

    // Tổng thực thu = tổng cột Thu thực tế
    setPayAmount(totalPaid);
  }, []);

  const handleOpenDebtDetail = useCallback(async (debt: DebtItem) => {
    try {
      setSelectedDebtForDetail(debt);
      setLoadingDetailBreakdown(true);
      setDetailBreakdown(null);
      setDetailVouchers([]);

      // 1. Gọi API lấy nợ breakdown chi tiết
      const breakdownRes = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/revenue',
          action: 'getStudentDebtBreakdown',
          loginEmail: user?.email || '',
          data: {
            student: debt.student,
            className: debt.className,
            refCode: debt.refCode,
            congNoId: debt.congNoId,
            khId: debt.khId
          }
        })
      });
      const res = await breakdownRes.json();

      // 2. Gọi API lấy Voucher ưu đãi học sinh
      const voucherRes = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/revenue',
          action: 'getStudentVoucherInfo',
          loginEmail: user?.email || '',
          data: {
            khId: debt.khId,
            studentName: debt.student
          }
        })
      });
      const vRes = await voucherRes.json();
      const loadedVouchers: VoucherInfo[] = vRes.success && vRes.data ? (Array.isArray(vRes.data) ? vRes.data : [vRes.data]) : [];
      setDetailVouchers(loadedVouchers);

      if (res.success && res.data) {
        setDetailBreakdown(res.data);
      }
    } catch (err) {
      console.error('Lỗi khi lấy chi tiết công nợ:', err);
    } finally {
      setLoadingDetailBreakdown(false);
    }
  }, [user]);

  const fetchStudentBreakdown = useCallback(async (debt: DebtItem) => {
    try {
      setLoadingBreakdown(true);
      setUseSurplus(false);
      setSelectedOldDebts([]);
      setPayNote('Ghi nhận đóng phí ' + (debt.period || extractPeriodText(debt.refCode) || ''));

      // 1. Gọi API lấy nợ breakdown chi tiết
      const breakdownRes = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/revenue',
          action: 'getStudentDebtBreakdown',
          loginEmail: user?.email || '',
          data: {
            student: debt.student,
            className: debt.className,
            refCode: debt.refCode,
            congNoId: debt.congNoId,
            khId: debt.khId
          }
        })
      });
      const res = await breakdownRes.json();

      // 2. Gọi API lấy Voucher ưu đãi học sinh
      const voucherRes = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/revenue',
          action: 'getStudentVoucherInfo',
          loginEmail: user?.email || '',
          data: {
            khId: debt.khId,
            studentName: debt.student
          }
        })
      });
      const vRes = await voucherRes.json();
      const loadedVouchers: VoucherInfo[] = vRes.success && vRes.data ? (Array.isArray(vRes.data) ? vRes.data : [vRes.data]) : [];
      setVouchers(loadedVouchers);

      if (res.success && res.data) {
        setBreakdown(res.data);

        // Khởi tạo bảng phân bổ 4 hàng cố định: Học phí, Tiền ăn, Tiền sách, Phí khác
        const fixedTypes = ['Học phí', 'Tiền ăn', 'Tiền sách', 'Phí khác'];

        // Xem học sinh có Voucher % không để điền mặc định vào Học phí
        let initialDiscountPct = 0;
        loadedVouchers.forEach(vc => {
          if (vc.discountType === '%') {
            initialDiscountPct += vc.discountValue;
          }
        });
        initialDiscountPct = Math.min(100, initialDiscountPct);

        const selectedFeeType = (debt.feeType || 'Học phí').trim();
        const initialAllocations: AllocationItem[] = fixedTypes.map(type => {
          const item = res.data.items.find((i: BreakdownItem) => i.type === type) || { type: type, debt: 0 };
          const hasPriorPayment = type === 'Học phí' && ((item as BreakdownItem).paid || 0) > 0;

          // Tính toán chiết khấu ban đầu cho Học phí
          let initialDiscountVND = 0;
          if (type === 'Học phí' && !hasPriorPayment) {
            // Chiết khấu phần trăm
            initialDiscountVND = Math.round(item.debt * initialDiscountPct / 100);

            // Chiết khấu tiền mặt từ Voucher (nếu có)
            loadedVouchers.forEach(vc => {
              if (vc.discountType !== '%') {
                const maxVndDiscountPossible = Math.max(0, item.debt - initialDiscountVND);
                initialDiscountVND += Math.min(vc.discountValue, maxVndDiscountPossible);
              }
            });
          }

          const initialMustPay = Math.max(0, item.debt - initialDiscountVND);
          const shouldAutoApplyPayment = type === selectedFeeType;
          const initialPaid = shouldAutoApplyPayment ? initialMustPay : 0;

          return {
            type: type,
            curDebt: item.debt,
            discountPct: type === 'Học phí' && !hasPriorPayment ? initialDiscountPct : 0,
            discountVND: initialDiscountVND,
            newDebt: 0,
            mustPay: initialMustPay,
            paid: initialPaid,
            remain: Math.max(0, initialMustPay - initialPaid),
            surplusApplied: 0
          };
        });

        // Chạy tính toán lại lần đầu
        recomputeAllocation(initialAllocations, false, loadedVouchers, [], res.data, selectedFeeType);
      } else {
        console.error('Lỗi lấy breakdown công nợ:', res.message);
      }
    } catch (err) {
      console.error('Lỗi gọi API thu nợ:', err);
    } finally {
      setLoadingBreakdown(false);
    }
  }, [user, recomputeAllocation]);

  useEffect(() => {
    if (selectedDebt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudentBreakdown(selectedDebt);
    } else {
      setBreakdown(null);
    }
  }, [selectedDebt, fetchStudentBreakdown]);

  const handleDiscountPctChange = (index: number, pct: number) => {
    const updated = [...allocations];
    updated[index].discountPct = Math.min(100, Math.max(0, pct));
    recomputeAllocation(updated, useSurplus, vouchers, selectedOldDebts, breakdown, selectedDebt?.feeType);
  };

  const handleNewDebtChange = (index: number, newDebt: number) => {
    const updated = [...allocations];
    updated[index].newDebt = Math.max(0, newDebt);
    recomputeAllocation(updated, useSurplus, vouchers, selectedOldDebts, breakdown, selectedDebt?.feeType);
  };

  const handlePaidChange = (index: number, paid: number) => {
    const updated = [...allocations];
    updated[index].paid = Math.max(0, paid);
    recomputeAllocation(updated, useSurplus, vouchers, selectedOldDebts, breakdown, selectedDebt?.feeType);
  };

  const handleUseSurplusToggle = (checked: boolean) => {
    setUseSurplus(checked);
    const updated = allocations.map(item => ({ ...item, surplusApplied: 0 }));
    if (checked && breakdown) {
      let remaining = breakdown.surplus;
      for (let i = 0; i < updated.length; i++) {
        if (remaining <= 0) break;
        const canApply = Math.max(0, updated[i].mustPay);
        const applied = Math.min(canApply, remaining);
        updated[i].surplusApplied = applied;
        remaining -= applied;
      }
    }
    recomputeAllocation(updated, checked, vouchers, selectedOldDebts, breakdown, selectedDebt?.feeType);
  };

  const handleOldDebtCheck = (uniqueKey: string, checked: boolean) => {
    let updatedOldDebts = [...selectedOldDebts];
    if (checked) {
      updatedOldDebts.push(uniqueKey);
    } else {
      updatedOldDebts = updatedOldDebts.filter(k => k !== uniqueKey);
    }
    setSelectedOldDebts(updatedOldDebts);
    recomputeAllocation(allocations, useSurplus, vouchers, updatedOldDebts, breakdown, selectedDebt?.feeType);
  };

  const getPrintDateParts = () => {
    if (typeof document === 'undefined') return { day: '00', month: '00', year: '2026' };
    const dateInput = document.getElementById('cp_date') as HTMLInputElement;
    const d = dateInput && dateInput.value ? new Date(dateInput.value) : new Date();
    return {
      day: d.getDate().toString().padStart(2, '0'),
      month: (d.getMonth() + 1).toString().padStart(2, '0'),
      year: d.getFullYear(),
    };
  };

  // Handle Quick Payment Recording
  const handleRecordPayment = async (e?: React.FormEvent, shouldPrint: boolean = false) => {
    if (e) e.preventDefault();
    if (!selectedDebt || !breakdown) return;

    try {
      setIsSubmittingPay(true);

      // Cấu trúc danh sách items phân bổ đợt này
      const itemsPayload = allocations.map(item => {
        return {
          type: item.type,
          curDebt: item.curDebt,
          newDebt: item.newDebt,
          paid: item.paid,
          discountPct: item.discountPct,
          discountVND: item.discountVND,
          surplusApplied: item.surplusApplied,
        };
      });

      // Cấu trúc nợ cũ được chọn đóng kèm
      const oldDebtPaymentsPayload: OldDebtPaymentPayload[] = [];
      if (selectedOldDebts.length > 0) {
        selectedOldDebts.forEach(key => {
          const [type, ref] = key.split('||');
          const matchedItem = breakdown.oldDebtItems.find(i => i.type === type && i.ref === ref);
          if (matchedItem) {
            oldDebtPaymentsPayload.push({
              type: type,
              ref: ref,
              paid: matchedItem.debt,
              surplusApplied: 0,
            });
          }
        });
      }

      const totalSurplusApplied = allocations.reduce((sum, item) => sum + item.surplusApplied, 0);

      const payload = {
        path: '/api/v1/revenue',
        action: 'recordQuickPayment',
        loginEmail: user?.email || '',
        data: {
          student: selectedDebt.student,
          className: selectedDebt.className,
          khId: selectedDebt.khId,
          congNoId: selectedDebt.congNoId,
          refCode: selectedDebt.refCode,
          method: payMethod,
          payDate: (document.getElementById('cp_date') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0],
          note: payNote || 'Gạch nợ công nợ',
          creatorName: user?.name || '',
          useSurplus: useSurplus,
          surplusAmount: totalSurplusApplied,
          items: itemsPayload,
          oldDebtPayments: oldDebtPaymentsPayload,
        },
      };

      const response = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const res = await response.json();
      if (res.success || res.ok) {
        if (shouldPrint) {
          // Compile and populate active print receipt state
          setActivePrintReceipt({
            id: "PT-" + selectedDebt.congNoId.substring(0, 8).toUpperCase(),
            dateParts: getPrintDateParts(),
            student: selectedDebt.student,
            khId: selectedDebt.khId || '—',
            className: selectedDebt.className,
            period: getDebtPeriod(selectedDebt),
            payMethod: payMethod,
            creator: user?.name || 'Thủ quỹ',
            payNote: payNote || 'Đóng học phí',
            items: allocations.filter(item => item.curDebt > 0 || item.newDebt > 0 || item.mustPay > 0 || item.paid > 0),
            totalSummary: totalSummary,
            useSurplus: useSurplus,
            studentDob: breakdown?.studentDob || '',
            teacherCN: breakdown?.teacherCN || '',
            beginTerm: breakdown?.beginTerm || selectedDebt.startDate || '',
            endTerm: breakdown?.endTerm || selectedDebt.endDate || '',
          });

          setTimeout(() => {
            window.print();
            showSuccess('Ghi nhận gạch nợ thành công!');
            setSelectedDebt(null);
            fetchRevenueData();
          }, 150);
        } else {
          showSuccess('Ghi nhận gạch nợ thành công!');
          setSelectedDebt(null);
          fetchRevenueData();
        }
      } else {
        alert('Có lỗi xảy ra: ' + (res.message || 'Lỗi không xác định'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không xác định';
      alert('Lỗi kết nối máy chủ: ' + message);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handlePrintHistoryReceipt = (item: TxHistoryItem) => {
    if (!item) return;

    const parseSurplusAppliedFromNote = (noteStr: string) => {
      const match = noteStr.match(/\[Cấn trừ tiền dư:\s*([\d.]+)\]/);
      if (match) {
        return parseFloat(match[1].replace(/[^\d.]/g, '')) || 0;
      }
      return 0;
    };

    const extractPeriodFromNoteOrRef = (noteStr: string, refCodeStr?: string) => {
      if (refCodeStr) {
        const period = extractPeriodText(refCodeStr);
        if (period) return period;
      }
      const match = noteStr.match(/(Tháng|Khóa)\s*(\d{2})\/(\d{4})/i);
      if (match) {
        return `${match[1]} ${match[2]}/${match[3]}`;
      }
      const match2 = noteStr.match(/(Tháng|Khóa)\s*(\d{4})-(\d{2})/i);
      if (match2) {
        return `${match2[1]} ${match2[3]}/${match2[2]}`;
      }
      return '--/----';
    };

    const surplusVal = parseSurplusAppliedFromNote(item.note);
    const details = item.details || [
      {
        loaiPhi: item.loaiPhi,
        amount: item.amount,
        discountVND: 0,
        mustPay: item.amount
      }
    ];

    const parsedItems = details.map((d: any, idx: number) => {
      const itemSurplus = idx === 0 ? surplusVal : 0;
      const curDebt = (d.amount || 0) + (d.discountVND || 0) + itemSurplus;
      const discountVND = d.discountVND || 0;
      const mustPay = (d.amount || 0) + itemSurplus;
      return {
        type: d.loaiPhi,
        curDebt,
        discountVND,
        newDebt: 0,
        mustPay,
        paid: d.amount || 0
      };
    });

    const totalDisc = details.reduce((sum: number, d: any) => sum + (d.discountVND || 0), 0);
    const totalAmt = item.amount;

    const dayStr = item.date.split('/')[0] || '00';
    const monthStr = item.date.split('/')[1] || '00';
    const yearNum = parseInt(item.date.split('/')[2]) || 2026;

    const computedTotalCurDebt = parsedItems.reduce((sum: number, x: any) => sum + x.curDebt, 0);
    const computedTotalMustPay = parsedItems.reduce((sum: number, x: any) => sum + x.mustPay, 0);

    setActivePrintReceipt({
      id: "PT-" + (item.id || 'THT').substring(0, 8).toUpperCase(),
      dateParts: { day: dayStr, month: monthStr, year: yearNum },
      student: item.name,
      khId: item.khId || '—',
      className: item.className,
      period: extractPeriodFromNoteOrRef(item.note, (item as any).refCode),
      payMethod: item.method,
      creator: item.creator,
      payNote: item.note,
      items: parsedItems,
      totalSummary: {
        curDebt: computedTotalCurDebt,
        newDebt: 0,
        discountVND: totalDisc,
        mustPay: computedTotalMustPay,
        paid: totalAmt,
        remain: computedTotalMustPay - totalAmt - surplusVal,
        surplusApplied: surplusVal
      },
      useSurplus: surplusVal > 0,
      studentDob: (item as any).studentDob || '',
      teacherCN: (item as any).teacherCN || '',
      beginTerm: (item as any).beginTerm || '',
      endTerm: (item as any).endTerm || '',
    });

    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Handle Manual Periodical Debt Generation
  const handleGenerateDebt = async () => {
    if (!genMonthYear) {
      alert('Vui lòng chọn Tháng/Năm để tạo phí!');
      return;
    }

    try {
      setIsGeneratingDebt(true);
      const response = await fetch(REVENUE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/revenue',
          action: 'generateDebtForAllClasses',
          loginEmail: user?.email || '',
          data: {
            type: genClassType,
            monthYear: genMonthYear,
            classId: genClassId,
            note: `Tạo công nợ định kỳ ${genClassType} thủ công`,
            creatorName: user?.name || 'Admin',
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        setShowGenModal(false);
        showSuccess(res.message || 'Tạo công nợ thành công.');
        fetchRevenueData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Không xác định';
      alert('Lỗi tạo công nợ: ' + message);
    } finally {
      setIsGeneratingDebt(false);
    }
  };

  const formatCurrency = (val: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  const getPeriodText = useCallback((refCode: string) => {
    return extractPeriodText(refCode);
  }, []);

  const formatTypeLabel = useCallback((type: string, refCode: string) => {
    if (type === 'Học phí') {
      const period = getPeriodText(refCode);
      return period ? `${type} (${period})` : type;
    }
    return type;
  }, [getPeriodText]);

  const getDebtPeriod = useCallback((debt: DebtItem) => {
    return debt.period || getPeriodText(debt.refCode) || '--/----';
  }, [getPeriodText]);

  // Filters
  const filteredDebts = debts.filter(d =>
    d.student.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.period || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.feeType || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSurpluses = surpluses.filter(s =>
    s.student.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.refCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = history.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.loaiPhi.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const {
    paginatedData: paginatedDebts,
    currentPage: debtPage,
    setCurrentPage: setDebtPage,
    totalPages: debtTotalPages,
    startIndex: debtStartIndex,
    itemsPerPage: debtItemsPerPage,
    getPageNumbers: getDebtPageNumbers,
  } = usePagination(filteredDebts, 10, [searchQuery, activeTab]);

  const {
    paginatedData: paginatedSurpluses,
    currentPage: surplusPage,
    setCurrentPage: setSurplusPage,
    totalPages: surplusTotalPages,
    startIndex: surplusStartIndex,
    itemsPerPage: surplusItemsPerPage,
    getPageNumbers: getSurplusPageNumbers,
  } = usePagination(filteredSurpluses, 10, [searchQuery, activeTab]);

  const {
    paginatedData: paginatedHistory,
    currentPage: historyPage,
    setCurrentPage: setHistoryPage,
    totalPages: historyTotalPages,
    startIndex: historyStartIndex,
    itemsPerPage: historyItemsPerPage,
    getPageNumbers: getHistoryPageNumbers,
  } = usePagination(filteredHistory, 10, [searchQuery, activeTab]);

  const pagination =
    activeTab === 'debt'
      ? {
        total: filteredDebts.length,
        currentPage: debtPage,
        setCurrentPage: setDebtPage,
        totalPages: debtTotalPages,
        startIndex: debtStartIndex,
        itemsPerPage: debtItemsPerPage,
        getPageNumbers: getDebtPageNumbers,
        label: 'công nợ',
      }
      : activeTab === 'surplus'
        ? {
          total: filteredSurpluses.length,
          currentPage: surplusPage,
          setCurrentPage: setSurplusPage,
          totalPages: surplusTotalPages,
          startIndex: surplusStartIndex,
          itemsPerPage: surplusItemsPerPage,
          getPageNumbers: getSurplusPageNumbers,
          label: 'khoản dư',
        }
        : {
          total: filteredHistory.length,
          currentPage: historyPage,
          setCurrentPage: setHistoryPage,
          totalPages: historyTotalPages,
          startIndex: historyStartIndex,
          itemsPerPage: historyItemsPerPage,
          getPageNumbers: getHistoryPageNumbers,
          label: 'giao dịch',
        };

  if (selectedDebt) {
    return (
      <div className="space-y-4 animate-fade-in relative text-xs">
        {/* Header */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                <Coins className="text-[#21398A]" size={20} />
                <span>THU TIỀN HỌC PHÍ & PHÂN BỔ CÔNG NỢ</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Form Contents */}
        {loadingBreakdown ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-white rounded-xl border border-slate-100 shadow-sm">
            <RefreshCw className="animate-spin text-[#21398A]" size={28} />
            <span className="text-xs font-semibold text-slate-500">Đang đồng bộ hóa chi tiết công nợ...</span>
          </div>
        ) : breakdown ? (
          <form onSubmit={handleRecordPayment} className="space-y-4">

            {/* HÀNG 1: THÔNG TIN HỌC SINH, THANH TOÁN & NỢ DƯ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* KHUNG GỘP: THÔNG TIN HỌC VIÊN & THANH TOÁN */}
              <div className="lg:col-span-2 p-4 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-3">
                    <span className="w-1 h-3 bg-[#21398A] rounded-full"></span>
                    <span>THÔNG TIN HỌC VIÊN & THANH TOÁN</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Phần 1: Thông tin học sinh & Ghi chú */}
                    <div className="bg-slate-50/50 p-5 md:p-6 rounded-xl border border-slate-100 shadow-3xs flex flex-col justify-between h-full min-h-[220px]">
                      <div className="flex flex-col h-full justify-around flex-1 space-y-1">
                        <div className="flex justify-between items-center py-2.5 border-b border-dashed border-slate-200">
                          <span className="text-xs md:text-sm text-slate-500 font-extrabold uppercase tracking-wider">Học sinh</span>
                          <strong className="text-slate-800 text-sm md:text-base font-black">{selectedDebt.student}</strong>
                        </div>

                        <div className="flex justify-between items-center py-2.5 border-b border-dashed border-slate-200">
                          <span className="text-xs md:text-sm text-slate-500 font-extrabold uppercase tracking-wider">Lớp thu tiền</span>
                          <strong className="text-slate-800 text-sm md:text-base font-black">{selectedDebt.className}</strong>
                        </div>

                        <div className="flex justify-between items-center py-2.5 border-b border-dashed border-slate-200">
                          <span className="text-xs md:text-sm text-slate-500 font-extrabold uppercase tracking-wider">Tháng/Kỳ</span>
                          <strong className="text-amber-700 text-sm md:text-base font-black">
                            {getDebtPeriod(selectedDebt)}
                          </strong>
                        </div>

                        {/* Ghi chú đóng phí */}
                        <div className="pt-3">
                          <label className="tht-input-label font-bold text-slate-500 mb-1 block text-[10px] md:text-xs uppercase tracking-wider">Ghi chú đóng phí (tuỳ chọn)</label>
                          <input
                            type="text"
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            placeholder="Nhập ghi chú đóng học phí..."
                            className="tht-input text-xs md:text-sm font-bold !py-1.5 !px-3 !h-9 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Phần 2: Vouchers & Thanh toán */}
                    <div className="bg-slate-50/50 p-5 md:p-6 rounded-xl border border-slate-100 shadow-3xs flex flex-col justify-between h-full min-h-[220px]">
                      {/* 1. Voucher */}
                      <div className="space-y-1.5">
                        <label className="tht-input-label font-bold text-slate-500 block text-[10px] md:text-xs uppercase tracking-wider">Voucher / Ưu đãi áp dụng</label>
                        {vouchers && vouchers.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {vouchers.map(vc => (
                              <span key={vc.id} className="bg-amber-50 border border-amber-200 text-amber-850 inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded-md text-[9px] font-bold tracking-tight leading-none">
                                <Sparkles size={8} className="text-amber-500 animate-pulse shrink-0" />
                                <span>{vc.name} ({vc.discountType === '%' ? `-${vc.discountValue}%` : `-${formatCurrency(vc.discountValue)}`})</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-xs italic font-medium">Học sinh không có Voucher ưu đãi.</div>
                        )}
                      </div>

                      {/* 2. Hình thức & Ngày thu cùng 1 hàng */}
                      <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3">
                        {/* Hình thức thanh toán */}
                        <div>
                          <label className="tht-input-label font-bold text-slate-500 mb-1 block text-[10px] md:text-xs uppercase tracking-wider">Hình thức</label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                            className="tht-select text-xs font-bold !py-1.5 !px-3 cursor-pointer !h-9 rounded-lg border border-slate-200 bg-white"
                          >
                            <option value="Chuyển khoản">Chuyển khoản</option>
                            <option value="Tiền mặt">Tiền mặt</option>
                            <option value="Áp dụng tiền dư">Áp dụng tiền dư</option>
                            <option value="POS">Thanh toán POS</option>
                          </select>
                        </div>

                        {/* Ngày thu tiền */}
                        <div>
                          <label className="tht-input-label font-bold text-slate-500 mb-1 block text-[10px] md:text-xs uppercase tracking-wider">Ngày thu</label>
                          <input
                            type="date"
                            id="cp_date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="tht-input text-xs font-bold !py-1.5 !px-3 !h-9 rounded-lg border border-slate-200 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cột 3: Thông tin tiền nợ dư của học sinh */}
              <div className="p-4 rounded-xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-2">
                    <span className="w-1 h-3 bg-purple-600 rounded-full"></span>
                    <span>THÔNG TIN TIỀN NỢ DƯ CỦA HỌC SINH</span>
                  </div>

                  <div className="space-y-2">
                    {/* Card Nợ cũ */}
                    <div className="rounded-lg border border-rose-100 bg-rose-50/20 p-2.5 space-y-1.5 shadow-3xs">
                      <div className="flex justify-between items-center">
                        <div className="leading-none">
                          <span className="text-[10px] text-rose-700 font-bold uppercase block mb-0.5">Nợ cũ tồn đọng</span>
                          <strong className="text-sm font-black text-rose-600">{formatCurrency(breakdown.oldDebt)}</strong>
                        </div>
                        <span className="bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.5 rounded-full text-xs">
                          {breakdown.oldDebtItems.length} khoản
                        </span>
                      </div>

                      {breakdown.oldDebtItems.length > 0 && (
                        <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                          {breakdown.oldDebtItems.map(item => {
                            const uniqueKey = `${item.type}||${item.ref}`;
                            const isChecked = selectedOldDebts.includes(uniqueKey);
                            return (
                              <label
                                key={uniqueKey}
                                className={`flex items-center justify-between p-1.5 rounded-md border text-xs cursor-pointer select-none transition-all
                                  ${isChecked
                                    ? 'bg-rose-50/50 border-rose-200 text-rose-900 shadow-3xs'
                                    : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                                  }
                                `}
                              >
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => handleOldDebtCheck(uniqueKey, e.target.checked)}
                                    className="w-3.5 h-3.5 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                                  />
                                  <span className="font-bold">{item.label || formatTypeLabel(item.type, item.ref)}</span>
                                </div>
                                <span className="font-bold text-rose-600">{formatCurrency(item.debt)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Tiền dư */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div className="leading-none">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Tiền dư tích lũy</span>
                    <strong className="text-emerald-600 text-sm font-black">{formatCurrency(breakdown.surplus)}</strong>
                  </div>
                  {breakdown.surplus > 0 && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
                      <span className="text-[10px] text-emerald-700 font-bold uppercase">Cấn trừ</span>
                      <label className="relative inline-flex items-center cursor-pointer select-none scale-75">
                        <input
                          type="checkbox"
                          checked={useSurplus}
                          onChange={(e) => handleUseSurplusToggle(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* HÀNG 2: PHÂN BỔ CHI TIẾT & ĐỐI SOÁT CHỨNG TỪ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Bảng phân bổ chi tiết (chiếm 2/3) */}
              <div className="lg:col-span-2 p-4 rounded-xl bg-white border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-1">
                  <span className="w-1 h-3 bg-emerald-600 rounded-full"></span>
                  <span>PHÂN BỔ TIỀN THU CHI TIẾT</span>
                </div>

                <div className="overflow-x-auto rounded-lg border border-slate-100 bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] text-slate-400 font-bold uppercase border-b border-slate-100 text-center">
                        <th className="p-2 text-left w-[180px]">Loại phí</th>
                        <th className="p-2 text-right">Nợ hiện tại (đ)</th>
                        <th className="p-2 text-center w-[70px]">CK (%)</th>
                        <th className="p-2 text-right">Tiền CK (đ)</th>
                        <th className="p-2 text-right w-[100px]">Phí PS (đ)</th>
                        <th className="p-2 text-right bg-amber-50/60 text-amber-800 font-bold w-[110px]">Phải đóng (đ)</th>
                        <th className="p-2 text-right bg-blue-50/60 text-blue-800 font-bold w-[110px]">Thu thực tế (đ)</th>
                        <th className="p-2 text-right bg-rose-50/60 text-rose-800 font-bold w-[110px]">Còn nợ lại (đ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {allocations.map((item, idx) => (
                        <tr key={item.type} className="hover:bg-slate-50/30 transition-colors">
                          {/* Loại phí */}
                          <td className="p-2 font-bold text-slate-700 text-left text-xs">
                            {item.type}
                          </td>

                          {/* Nợ hiện tại */}
                          <td className="p-2 text-right font-semibold text-slate-700 bg-slate-100/70">
                            {formatCurrency(item.curDebt)}
                          </td>

                          {/* CK % */}
                          <td className="p-1.5 text-center">
                            {item.type === 'Học phí' ? (
                              <input
                                type="number"
                                value={item.discountPct === 0 ? '' : item.discountPct}
                                onChange={(e) => handleDiscountPctChange(idx, Number(e.target.value))}
                                placeholder="0"
                                className="w-full text-center px-1 py-1 border border-slate-200 rounded focus:border-[#21398A] outline-none font-bold text-slate-800 text-xs h-8"
                                max={100}
                                min={0}
                              />
                            ) : (
                              <span className="text-slate-300 font-bold">—</span>
                            )}
                          </td>

                          {/* Tiền CK */}
                          <td className="p-2 text-right font-semibold text-slate-600 bg-slate-100/70">
                            {item.discountVND > 0 ? formatCurrency(item.discountVND) : '0 đ'}
                          </td>

                          {/* Phí PS */}
                          <td className="p-1 text-right">
                            <input
                              type="text"
                              value={item.newDebt ? formatVietnameseNumber(item.newDebt) : ''}
                              onChange={(e) => handleNewDebtChange(idx, parseVietnameseNumber(e.target.value))}
                              placeholder="0"
                              className="w-full text-right px-1.5 py-1 border border-slate-200 rounded focus:border-[#21398A] outline-none font-bold text-slate-800 text-xs h-8"
                            />
                          </td>

                          {/* Phải đóng */}
                          <td className="p-2 text-right bg-amber-100/70 font-bold text-amber-800">
                            {formatCurrency(item.mustPay)}
                          </td>

                          {/* Thu thực tế */}
                          <td className="p-1 text-right bg-blue-50/20">
                            <input
                              type="text"
                              value={item.paid ? formatVietnameseNumber(item.paid) : ''}
                              onChange={(e) => handlePaidChange(idx, parseVietnameseNumber(e.target.value))}
                              placeholder="0"
                              className="w-full text-right px-2 py-1 border border-blue-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-100 rounded-lg outline-none font-black text-blue-900 text-xs bg-white h-8"
                            />
                          </td>

                          {/* Còn nợ lại */}
                          <td className={`p-2 text-right font-bold space-y-0.5 ${item.remain > 0 ? 'bg-rose-100/60 text-rose-800' : item.remain < 0 ? 'bg-emerald-100/60 text-emerald-800' : 'bg-slate-100/70 text-slate-500'}`}>
                            <div>{item.remain < 0 ? `Đóng dư: ${formatCurrency(Math.abs(item.remain))}` : formatCurrency(item.remain)}</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {/* Footer Tổng cộng */}
                    <tfoot className="bg-slate-50 border-t border-slate-100 font-bold text-slate-700">
                      <tr className="text-right">
                        <td className="p-2 uppercase tracking-wider text-slate-500 text-[10px]">TỔNG CỘNG</td>
                        <td className="p-2 text-slate-800 font-extrabold">{formatCurrency(totalSummary.curDebt)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-slate-500 font-bold">{formatCurrency(totalSummary.discountVND)}</td>
                        <td className="p-2 text-slate-800 font-bold">{formatCurrency(totalSummary.newDebt)}</td>
                        <td className="p-2 bg-amber-50 text-amber-900 font-black">{formatCurrency(totalSummary.mustPay)}</td>
                        <td className="p-2 bg-blue-50 text-blue-900 font-black">{formatCurrency(totalSummary.paid)}</td>
                        <td className={`p-2 font-black text-right ${totalSummary.remain > 0 ? 'bg-rose-100 text-rose-900' : totalSummary.remain < 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-900'}`}>
                          {totalSummary.remain < 0 ? `Dư: ${formatCurrency(Math.abs(totalSummary.remain))}` : formatCurrency(totalSummary.remain)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Hộp đối soát Tóm tắt số tiền (chiếm 1/3) */}
              <div className="lg:col-span-1 p-4 rounded-xl bg-white border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 border-b border-slate-100 pb-2 mb-2">
                    <span className="w-1 h-3 bg-[#21398A] rounded-full"></span>
                    <span>ĐỐI SOÁT CHỨNG TỪ</span>
                  </div>

                  <div className="space-y-2 mt-2 text-[11px]">
                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase">
                      <span>Tổng Nợ Hiện tại:</span>
                      <span className="font-extrabold text-slate-700">{formatCurrency(totalSummary.curDebt)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase">
                      <span>Chiết khấu & Voucher:</span>
                      <span className="font-extrabold text-rose-600">-{formatCurrency(totalSummary.discountVND)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase">
                      <span>Phí phát sinh:</span>
                      <span className="font-extrabold text-emerald-600">+{formatCurrency(totalSummary.newDebt)}</span>
                    </div>

                    {useSurplus && totalSummary.mustPay > 0 && (
                      <div className="flex justify-between items-center text-slate-500 font-bold uppercase">
                        <span>Khấu trừ số dư:</span>
                        <span className="font-extrabold text-emerald-600">
                          -{formatCurrency(totalSummary.surplusApplied)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center font-black text-slate-800 text-xs">
                      <span>TỔNG PHẢI ĐÓNG:</span>
                      <span className="text-amber-700">{formatCurrency(totalSummary.mustPay)}</span>
                    </div>

                    <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 flex justify-between items-center mt-2.5">
                      <span className="text-[10px] font-black text-blue-900">THU THỰC TẾ:</span>
                      <span className="text-lg font-black text-blue-800">{formatCurrency(totalSummary.paid)}</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-500 font-bold uppercase mt-2">
                      <span>{totalSummary.remain >= 0 ? 'CÒN NỢ LẠI:' : 'CÒN DƯ (ĐÓNG DƯ):'}</span>
                      <span className={`font-black ${totalSummary.remain > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatCurrency(Math.abs(totalSummary.remain))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-[9px] text-slate-500 font-medium leading-normal mt-2.5">
                  💡 Hãy đảm bảo rằng số tiền thu thực tế khớp với giao dịch chuyển khoản hoặc quỹ tiền mặt trước khi nhấn xác nhận.
                </div>
              </div>
            </div>

            {/* Form Actions Footer Bar */}
            <div className="p-3 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-between gap-4">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedDebt(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[11px] transition-all cursor-pointer h-9"
                >
                  Hủy bỏ & Quay lại
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRecordPayment(undefined, true)}
                  disabled={isSubmittingPay || loadingBreakdown || payAmount < 0}
                  className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold rounded-lg text-[11px] transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer h-9 disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span>Xác nhận & In hóa đơn</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRecordPayment(undefined, false)}
                  disabled={isSubmittingPay || loadingBreakdown || payAmount < 0}
                  className="px-5 py-2 bg-[#21398A] text-white hover:bg-[#1a2e70] font-bold rounded-lg text-[11px] transition-all shadow-md shadow-[#21398a]/10 cursor-pointer h-9 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmittingPay ? 'Đang xử lý...' : 'Xác nhận thu phí'}
                </button>
              </div>
            </div>

          </form>
        ) : (
          <div className="p-10 text-center text-slate-400 text-sm font-semibold bg-white border border-slate-100 rounded-xl shadow-sm">
            Không thể tải thông tin công nợ. Vui lòng quay lại danh sách và thử lại.
          </div>
        )}

        {/* Success toast */}
        {showSuccessModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px] px-4">
            <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-100 animate-scale-up overflow-hidden">
              <div className="p-5 text-center">
                <div className="mx-auto mb-3.5 w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle size={24} />
                </div>
                <h3 className="text-md font-bold text-slate-800">Thao tác thành công</h3>
                <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{successMessage}</p>
              </div>
              <div className="h-1 bg-emerald-100">
                <div className="h-full bg-emerald-500" style={{ animation: 'shrinkBar 2s linear forwards' }} />
              </div>
            </div>
          </div>
        )}

        {/* Submitting Quick Payments Overlays */}
        <LoadingOverlay show={isSubmittingPay} message="Đang xử lý gạch nợ công nợ..." />

      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in relative">

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
            Quản lý Thu phí & Công nợ
          </h1>
          <p className="text-slate-500 mt-1">
            Theo dõi khoản nợ học tập, số dư tích lũy và đối soát chứng từ thu ngân.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              if (checkPermission('perm_revenue_create_debt')) {
                setShowGenModal(true);
              }
            }}
            className="tht-btn-primary font-semibold"
          >
            <Sparkles size={16} />
            <span>Tạo nợ định kỳ</span>
          </button>

          <button
            onClick={fetchRevenueData}
            disabled={loading}
            className="tht-btn-outline"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('debt'); setSelectedDebt(null); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-2
            ${activeTab === 'debt'
              ? 'border-[#21398A] text-[#21398A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }
          `}
        >
          <Layers size={16} />
          Danh sách Công nợ ({filteredDebts.length})
        </button>
        <button
          onClick={() => { setActiveTab('surplus'); setSelectedDebt(null); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-2
            ${activeTab === 'surplus'
              ? 'border-[#21398A] text-[#21398A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }
          `}
        >
          <TrendingUp size={16} />
          Dư học phí ({filteredSurpluses.length})
        </button>
        <button
          onClick={() => { setActiveTab('history'); setSelectedDebt(null); }}
          className={`py-3 px-6 text-sm font-semibold border-b-2 cursor-pointer transition-all flex items-center gap-2
            ${activeTab === 'history'
              ? 'border-[#21398A] text-[#21398A]'
              : 'border-transparent text-slate-500 hover:text-slate-800'
            }
          `}
        >
          <History size={16} />
          Lịch sử Giao dịch ({filteredHistory.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="tht-search-wrapper max-w-md">
        <Search className="tht-search-icon" size={18} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm theo Tên học sinh, Lớp, Loại phí, Tháng/Kỳ..."
          className="tht-input pl-10"
        />
      </div>

      {/* List content grids */}
      <div className="tht-table-container min-h-[300px]">
        {loading ? (
          <div className="tht-loading-state">
            <RefreshCw size={24} className="tht-loading-spinner" />
            <span>Đang liên kết báo cáo tài chính...</span>
          </div>
        ) : activeTab === 'debt' && filteredDebts.length === 0 ? (
          <div className="tht-empty-state">
            <CreditCard size={48} className="tht-empty-icon" />
            <span>Hiện tại không có dư nợ phát sinh.</span>
          </div>
        ) : activeTab === 'surplus' && filteredSurpluses.length === 0 ? (
          <div className="tht-empty-state">
            <TrendingUp size={48} className="tht-empty-icon" />
            <span>Hiện tại không có số dư học sinh tích lũy.</span>
          </div>
        ) : activeTab === 'history' && filteredHistory.length === 0 ? (
          <div className="tht-empty-state">
            <History size={48} className="tht-empty-icon" />
            <span>Không tìm thấy bản ghi giao dịch nào.</span>
          </div>
        ) : (
          <>
            <div className="tht-table-wrapper">
              <table className="tht-table thttable">
                {activeTab === 'debt' && (
                  <>
                    <thead className="tht-table-thead">
                      <tr>
                        <th className="tht-table-th">Học viên</th>
                        <th className="tht-table-th">Lớp học</th>
                        <th className="tht-table-th">Loại phí</th>
                        <th className="tht-table-th">Tháng/Kỳ</th>
                        <th className="tht-table-th text-right">Còn nợ</th>
                        <th className="tht-table-th text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="tht-table-tbody">
                      {paginatedDebts.map((item) => (
                        <tr
                          key={item.congNoId || item.refCode}
                          className="tht-table-tr thttable-tr cursor-pointer hover:bg-slate-50/80 active:bg-slate-100 transition-colors"
                          onClick={() => handleOpenDebtDetail(item)}
                        >
                          <td className="tht-table-td font-bold text-slate-800">{item.student}</td>
                          <td className="tht-table-td">{item.className}</td>
                          <td className="tht-table-td">
                            <span className={`tht-badge ${(item.feeType || '').includes('ăn') ? 'tht-badge-warning' : 'tht-badge-info'}`}>
                              {item.feeType || 'Học phí'}
                            </span>
                          </td>
                          <td className="tht-table-td text-xs font-bold text-[#21398A] uppercase tracking-wider">{getDebtPeriod(item)}</td>
                          <td className="tht-table-td font-extrabold text-rose-600 text-right">{formatCurrency(item.debt)}</td>
                          <td className="tht-table-td text-center thtaction">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (checkPermission('perm_revenue_collect_debt')) {
                                  setSelectedDebt(item);
                                  setPayAmount(item.debt);
                                }
                              }}
                              className="tht-text-action-btn tht-text-action-btn-blue mx-auto"
                              title="Thu tiền"
                            >
                              <Coins size={14} />
                              <span>Thu tiền</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {activeTab === 'surplus' && (
                  <>
                    <thead className="tht-table-thead">
                      <tr>
                        <th className="tht-table-th">Học viên</th>
                        <th className="tht-table-th">Lớp học</th>
                        <th className="tht-table-th">Mã tham chiếu</th>
                        <th className="tht-table-th text-right">Số dư tích lũy</th>
                      </tr>
                    </thead>
                    <tbody className="tht-table-tbody">
                      {paginatedSurpluses.map((item) => (
                        <tr key={item.refCode} className="tht-table-tr thttable-tr">
                          <td className="tht-table-td font-bold text-slate-800">{item.student}</td>
                          <td className="tht-table-td">{item.className}</td>
                          <td className="tht-table-td text-xs font-bold text-emerald-600 uppercase tracking-wider">{item.refCode}</td>
                          <td className="tht-table-td font-extrabold text-emerald-600 text-right">{formatCurrency(item.surplus)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}

                {activeTab === 'history' && (
                  <>
                    <thead className="tht-table-thead">
                      <tr>
                        <th className="tht-table-th">Ngày GD</th>
                        <th className="tht-table-th">Loại giao dịch</th>
                        <th className="tht-table-th">Học viên</th>
                        <th className="tht-table-th">Chi tiết phí</th>
                        <th className="tht-table-th text-right">Số tiền</th>
                        <th className="tht-table-th">Hình thức</th>
                        <th className="tht-table-th">Người lập</th>
                        <th className="tht-table-th text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="tht-table-tbody">
                      {paginatedHistory.map((item, idx) => (
                        <tr
                          key={`${item.date}-${item.name}-${idx}`}
                          className="tht-table-tr thttable-tr cursor-pointer hover:bg-slate-50/80 active:bg-slate-100 transition-colors"
                          onClick={() => setSelectedHistoryTx(item)}
                        >
                          <td className="tht-table-td">{item.date}</td>
                          <td className="tht-table-td">
                            <span className={`tht-badge ${item.txClass === 'thu' ? 'tht-badge-success' : 'tht-badge-danger'}`}>
                              {item.txType}
                            </span>
                          </td>
                          <td className="tht-table-td font-bold text-slate-800">{item.name}</td>
                          <td className="tht-table-td max-w-xs truncate">{item.loaiPhi}</td>
                          <td className={`tht-table-td font-extrabold text-right ${item.txClass === 'thu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {item.txClass === 'thu' ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                          <td className="tht-table-td">{item.method || '—'}</td>
                          <td className="tht-table-td text-xs font-bold uppercase text-slate-400">{item.creator}</td>
                          <td className="tht-table-td text-center thtaction">
                            {item.txClass === 'thu' && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handlePrintHistoryReceipt(item); }}
                                className="thtaction-btn tht-action-btn tht-action-btn-green mx-auto"
                                title="In hóa đơn"
                              >
                                <Printer />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="tht-pagination-container">
                <div className="tht-pagination-info">
                  Hiển thị từ <span>{pagination.startIndex + 1}</span> đến{' '}
                  <span>{Math.min(pagination.startIndex + pagination.itemsPerPage, pagination.total)}</span>{' '}
                  trong tổng số <span>{pagination.total}</span> {pagination.label}
                </div>

                <div className="tht-pagination-list">
                  <button
                    onClick={() => pagination.setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={pagination.currentPage === 1}
                    className="tht-pagination-btn"
                  >
                    Trước
                  </button>
                  {pagination.getPageNumbers().map((page, index) => {
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
                        onClick={() => pagination.setCurrentPage(Number(page))}
                        className={`tht-pagination-btn tht-pagination-num ${pagination.currentPage === page ? 'tht-pagination-num-active' : ''}`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => pagination.setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                    disabled={pagination.currentPage === pagination.totalPages}
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

      {/* Dialogue Modal: Periodical Debt Generation */}
      {mounted && showGenModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center px-4">
          <div className="absolute inset-0" onClick={() => setShowGenModal(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 border border-slate-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[#21398A]" />
                <h3 className="text-lg font-bold text-slate-800">Tạo công nợ học phí định kỳ</h3>
              </div>
              <button
                onClick={() => setShowGenModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-6 space-y-4">
              <div>
                <label className="tht-input-label">Hình thức học phí</label>
                <select
                  value={genClassType}
                  onChange={(e) => setGenClassType(e.target.value)}
                  className="tht-select"
                >
                  <option value="Tháng">Lớp Theo Tháng</option>
                  <option value="Khóa">Lớp Theo Khóa</option>
                  <option value="Giờ">Lớp Theo Giờ</option>
                </select>
              </div>

              <div>
                <label className="tht-input-label">Chọn Tháng/Năm tạo nợ</label>
                <input
                  type="month"
                  value={genMonthYear}
                  onChange={(e) => setGenMonthYear(e.target.value)}
                  className="tht-input"
                />
              </div>

              <div>
                <label className="tht-input-label">Chọn Lớp đang hoạt động (Tùy chọn)</label>
                <select
                  value={genClassId}
                  onChange={(e) => setGenClassId(e.target.value)}
                  className="tht-select font-medium"
                >
                  <option value="">-- Tất cả lớp học đang hoạt động --</option>
                  {classesList.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 flex gap-2.5">
                <AlertCircle className="text-indigo-600 mt-0.5 shrink-0" size={16} />
                <p className="text-xs text-indigo-700 leading-normal font-medium">
                  Hệ thống sẽ lọc đúng loại lớp đã chọn, tính học phí theo số buổi còn lại trong kỳ và tạo thêm tiền ăn nếu học sinh có cấu hình.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowGenModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleGenerateDebt}
                className="px-4 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] font-semibold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10"
              >
                Tiến hành tạo nợ
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dialogue Modal: Detailed Transaction View */}
      {mounted && selectedHistoryTx && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0" onClick={() => setSelectedHistoryTx(null)} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 z-10 border border-slate-100 animate-scale-up my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="text-[#21398A]" />
                <h3 className="text-lg font-bold text-slate-800">Chi tiết giao dịch</h3>
              </div>
              <button
                onClick={() => setSelectedHistoryTx(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="my-6 space-y-6 overflow-y-auto pr-1 flex-1">
              {/* Metadata Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Học sinh</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedHistoryTx.name}</div>
                  <div className="text-xs text-slate-500 font-semibold mt-0.5">Mã: {selectedHistoryTx.khId || '—'}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Lớp học</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={selectedHistoryTx.className}>
                    {selectedHistoryTx.className}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Số phiếu thu</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5 text-indigo-600 font-mono">
                    {selectedHistoryTx.id || 'THT'}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Ngày giao dịch</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedHistoryTx.date}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Hình thức đóng</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedHistoryTx.method || '—'}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Người lập</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedHistoryTx.creator}</div>
                </div>
              </div>

              {/* Items Breakdown Table */}
              <div>
                <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Chi tiết các khoản thu</h4>
                <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                        <th className="p-3 w-12 text-center">STT</th>
                        <th className="p-3">Khoản thu</th>
                        <th className="p-3 text-right w-24">Nợ ban đầu</th>
                        <th className="p-3 text-right w-24">Miễn giảm</th>
                        <th className="p-3 text-right w-28">Phải đóng</th>
                        <th className="p-3 text-right w-28">Thực thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {(() => {
                        const surplusVal = (() => {
                          const match = (selectedHistoryTx.note || '').match(/\[Cấn trừ tiền dư:\s*([\d.]+)\]/);
                          return match ? parseFloat(match[1].replace(/[^\d.]/g, '')) || 0 : 0;
                        })();
                        const details = selectedHistoryTx.details || [
                          {
                            loaiPhi: selectedHistoryTx.loaiPhi,
                            amount: selectedHistoryTx.amount,
                            discountVND: 0,
                            mustPay: selectedHistoryTx.amount
                          }
                        ];

                        let totalCurDebt = 0;
                        let totalDisc = 0;
                        let totalMustPay = 0;
                        let totalPaid = 0;

                        return (
                          <>
                            {details.map((d: any, idx: number) => {
                              const itemSurplus = idx === 0 ? surplusVal : 0;
                              const curDebt = (d.amount || 0) + (d.discountVND || 0) + itemSurplus;
                              const discountVND = d.discountVND || 0;
                              const mustPay = (d.amount || 0) + itemSurplus;
                              const paid = d.amount || 0;

                              totalCurDebt += curDebt;
                              totalDisc += discountVND;
                              totalMustPay += mustPay;
                              totalPaid += paid;

                              return (
                                <tr key={idx} className="hover:bg-slate-50/30">
                                  <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                                  <td className="p-3 font-bold text-slate-800">{d.loaiPhi}</td>
                                  <td className="p-3 text-right">{formatCurrency(curDebt)}</td>
                                  <td className="p-3 text-right text-rose-600 font-bold">
                                    {discountVND > 0 ? `-${formatCurrency(discountVND)}` : '0 đ'}
                                  </td>
                                  <td className="p-3 text-right font-bold text-amber-700">{formatCurrency(mustPay)}</td>
                                  <td className="p-3 text-right font-extrabold text-emerald-600">{formatCurrency(paid)}</td>
                                </tr>
                              );
                            })}

                            {/* Total summary */}
                            <tr className="bg-slate-50 font-bold border-t border-slate-200">
                              <td colSpan={2} className="p-3 uppercase text-[10px] tracking-wider text-slate-500">Tổng cộng</td>
                              <td className="p-3 text-right text-slate-800">{formatCurrency(totalCurDebt)}</td>
                              <td className="p-3 text-right text-rose-600 font-bold">
                                {totalDisc > 0 ? `-${formatCurrency(totalDisc)}` : '0 đ'}
                              </td>
                              <td className="p-3 text-right text-amber-900 font-extrabold">{formatCurrency(totalMustPay)}</td>
                              <td className="p-3 text-right text-emerald-700 font-extrabold">{formatCurrency(totalPaid)}</td>
                            </tr>

                            {/* Surplus breakdown row */}
                            {surplusVal > 0 && (
                              <tr className="bg-emerald-50/40 text-emerald-800 font-bold">
                                <td colSpan={5} className="p-3 text-left">Cấn trừ tiền dư tích lũy</td>
                                <td className="p-3 text-right text-emerald-600 font-extrabold">-{formatCurrency(surplusVal)}</td>
                              </tr>
                            )}

                            {/* Remain net row */}
                            <tr className="bg-[#21398A]/5 font-extrabold text-[#21398A] border-t border-[#21398A]/10">
                              <td colSpan={5} className="p-3 uppercase text-[10px] tracking-wider text-[#21398A]/80">
                                {totalMustPay - totalPaid - surplusVal >= 0 ? 'Còn nợ lại đợt đó' : 'Tiền thừa (Đóng dư)'}
                              </td>
                              <td className="p-3 text-right text-sm font-black">
                                {formatCurrency(Math.abs(totalMustPay - totalPaid - surplusVal))}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Note view */}
              {selectedHistoryTx.note && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="font-extrabold text-slate-400 uppercase tracking-wider text-[9px] mb-1">Ghi chú giao dịch</div>
                  <div className="text-slate-700 font-medium italic">"{selectedHistoryTx.note}"</div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => {
                  handlePrintHistoryReceipt(selectedHistoryTx);
                }}
                className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs border border-emerald-200/50"
              >
                <Printer size={14} />
                In phiếu thu PDF
              </button>

              <button
                onClick={() => setSelectedHistoryTx(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-all"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Dialogue Modal: Detailed Student Debt View */}
      {mounted && selectedDebtForDetail && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0" onClick={() => { setSelectedDebtForDetail(null); setDetailBreakdown(null); }} />
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 z-10 border border-slate-100 animate-scale-up my-8 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Coins className="text-[#21398A]" />
                <h3 className="text-lg font-bold text-slate-800">Chi tiết công nợ học sinh</h3>
              </div>
              <button
                onClick={() => { setSelectedDebtForDetail(null); setDetailBreakdown(null); }}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="my-6 space-y-6 overflow-y-auto pr-1 flex-1">
              {loadingDetailBreakdown ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-[#21398A] rounded-full animate-spin" />
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Đang tải dữ liệu công nợ...</p>
                </div>
              ) : detailBreakdown ? (
                <>
                  {/* Student & Class Profile Card */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Học sinh</div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5">{selectedDebtForDetail.student}</div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">Mã: {selectedDebtForDetail.khId || '—'}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Lớp học</div>
                      <div className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={selectedDebtForDetail.className}>
                        {selectedDebtForDetail.className}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Số dư tích lũy</div>
                      <div className="text-sm font-bold text-emerald-600 mt-0.5">
                        {formatCurrency(detailBreakdown.surplus || 0)}
                      </div>
                    </div>
                  </div>

                  {/* Apply Vouchers view if any */}
                  {(detailVouchers || []).length > 0 && (
                    <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/60 rounded-xl">
                      <div className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Chiết khấu / Ưu đãi áp dụng</div>
                      <div className="mt-1.5 space-y-1">
                        {(detailVouchers || []).map((vc, idx) => (
                          <div key={vc.id || idx} className="text-xs font-bold text-indigo-800 flex items-center gap-1.5">
                            <Sparkles size={12} className="text-indigo-500" />
                            <span>{vc.name}: </span>
                            <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-black">
                              {vc.discountType === '%' ? `-${vc.discountValue}%` : `-${formatCurrency(vc.discountValue)}`}
                            </span>
                            <span className="text-[10px] text-indigo-500 font-medium italic">({vc.description})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Current Period Debt Breakdown Table */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Công nợ đợt này</h4>
                      <span className="text-[10px] font-extrabold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">
                        Kỳ đóng: {getDebtPeriod(selectedDebtForDetail)}
                      </span>
                    </div>
                    <div className="overflow-hidden border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                            <th className="p-3 w-12 text-center">STT</th>
                            <th className="p-3">Khoản thu</th>
                            <th className="p-3 text-right">Nợ gốc đợt này</th>
                            <th className="p-3 text-right">Miễn giảm</th>
                            <th className="p-3 text-right">Còn nợ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                          {(() => {
                            const tuitionItem = (detailBreakdown.items || []).find(i => i.type === 'Học phí');
                            const hasPriorTuitionPayment = tuitionItem && (tuitionItem.paid || 0) > 0;

                            let voucherPct = 0;
                            let voucherVND = 0;
                            (detailVouchers || []).forEach(vc => {
                              if (vc.discountType === '%') voucherPct += vc.discountValue;
                              else voucherVND += vc.discountValue;
                            });

                            let totalCurDebt = 0;
                            let totalDisc = 0;
                            let totalNetDebt = 0;

                            const fixedTypes = ['Học phí', 'Tiền ăn', 'Tiền sách', 'Phí khác'];

                            return (
                              <>
                                {fixedTypes.map((type, idx) => {
                                  const item = (detailBreakdown.items || []).find(i => i.type === type) || { type, debt: 0, paid: 0 };
                                  const debtVal = item.debt || 0;
                                  const paidVal = item.paid || 0;

                                  // Chỉ tính chiết khấu cho Học phí và khi chưa từng thu tiền
                                  let discountVND = 0;
                                  if (type === 'Học phí' && !hasPriorTuitionPayment && debtVal > 0) {
                                    discountVND = Math.round(debtVal * voucherPct / 100) + voucherVND;
                                  }

                                  const netDebt = Math.max(0, debtVal - paidVal - discountVND);

                                  totalCurDebt += debtVal;
                                  totalDisc += discountVND;
                                  totalNetDebt += netDebt;

                                  if (debtVal === 0 && paidVal === 0) return null;

                                  return (
                                    <tr key={type} className="hover:bg-slate-50/30">
                                      <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                                      <td className="p-3 font-bold text-slate-800">{type}</td>
                                      <td className="p-3 text-right">{formatCurrency(debtVal)}</td>
                                      <td className="p-3 text-right text-rose-600 font-bold">
                                        {discountVND > 0 ? `-${formatCurrency(discountVND)}` : '0 đ'}
                                      </td>
                                      <td className="p-3 text-right font-extrabold text-rose-600">{formatCurrency(netDebt)}</td>
                                    </tr>
                                  );
                                })}

                                {/* Table Current Summary */}
                                <tr className="bg-slate-50/50 font-bold border-t border-slate-200">
                                  <td colSpan={2} className="p-3 uppercase text-[10px] tracking-wider text-slate-400">Cộng đợt này</td>
                                  <td className="p-3 text-right text-slate-600">{formatCurrency(totalCurDebt)}</td>
                                  <td className="p-3 text-right text-rose-600 font-bold">
                                    {totalDisc > 0 ? `-${formatCurrency(totalDisc)}` : '0 đ'}
                                  </td>
                                  <td className="p-3 text-right text-rose-700 font-extrabold">{formatCurrency(totalNetDebt)}</td>
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Old Debts from other months */}
                  {detailBreakdown.oldDebtItems && detailBreakdown.oldDebtItems.length > 0 && (
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Nợ đợt khác (Nợ cũ tồn đọng)</h4>
                      <div className="overflow-hidden border border-slate-100 rounded-xl">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                              <th className="p-3 w-12 text-center">STT</th>
                              <th className="p-3">Kỳ đóng nợ cũ</th>
                              <th className="p-3">Khoản nợ</th>
                              <th className="p-3 text-right">Số tiền nợ còn lại</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                            {detailBreakdown.oldDebtItems.map((old, idx) => (
                              <tr key={`${old.type}-${old.ref}`} className="hover:bg-slate-50/30">
                                <td className="p-3 text-center text-slate-400">{idx + 1}</td>
                                <td className="p-3 font-bold text-indigo-900 uppercase tracking-wider text-[10px]">{old.label}</td>
                                <td className="p-3 text-slate-600 font-semibold">{old.type}</td>
                                <td className="p-3 text-right text-rose-600 font-extrabold">{formatCurrency(old.debt)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Consolidated Financial Summary */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3.5">
                    <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Tổng hợp công nợ tài chính</h4>

                    {(() => {
                      const tuitionItem = (detailBreakdown.items || []).find(i => i.type === 'Học phí');
                      const hasPriorTuitionPayment = tuitionItem && (tuitionItem.paid || 0) > 0;

                      let voucherPct = 0;
                      let voucherVND = 0;
                      (detailVouchers || []).forEach(vc => {
                        if (vc.discountType === '%') voucherPct += vc.discountValue;
                        else voucherVND += vc.discountValue;
                      });

                      let totalCurrentDebt = 0;
                      let totalDiscount = 0;

                      (detailBreakdown.items || []).forEach(item => {
                        const debtVal = item.debt || 0;
                        totalCurrentDebt += debtVal;

                        if (item.type === 'Học phí' && !hasPriorTuitionPayment && debtVal > 0) {
                          totalDiscount += Math.round(debtVal * voucherPct / 100) + voucherVND;
                        }
                      });

                      const totalOldDebt = detailBreakdown.oldDebt || 0;
                      const surplusVal = detailBreakdown.surplus || 0;

                      const grandDebt = totalCurrentDebt + totalOldDebt;
                      const finalPaymentNeeded = Math.max(0, grandDebt - totalDiscount - surplusVal);

                      return (
                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between text-slate-600 font-medium">
                            <span>Tổng nợ đợt này (Nợ gốc trước giảm trừ):</span>
                            <span>{formatCurrency(totalCurrentDebt)}</span>
                          </div>
                          {totalOldDebt > 0 && (
                            <div className="flex justify-between text-slate-600 font-medium">
                              <span>Tổng nợ cũ từ đợt khác đóng kèm:</span>
                              <span>{formatCurrency(totalOldDebt)}</span>
                            </div>
                          )}
                          {totalDiscount > 0 && (
                            <div className="flex justify-between text-rose-600 font-bold">
                              <span>Chiết khấu Voucher đã áp dụng:</span>
                              <span>-{formatCurrency(totalDiscount)}</span>
                            </div>
                          )}
                          {surplusVal > 0 && (
                            <div className="flex justify-between text-emerald-600 font-bold">
                              <span>Tiền dư tích lũy cấn trừ:</span>
                              <span>-{formatCurrency(surplusVal)}</span>
                            </div>
                          )}
                          <div className="h-px bg-slate-200 my-2" />
                          <div className="flex justify-between text-[#21398A] text-sm font-black uppercase tracking-wider">
                            <span>Thực tế cần đóng học sinh:</span>
                            <span className="text-base text-rose-600 font-black">{formatCurrency(finalPaymentNeeded)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 shrink-0">
              <button
                onClick={() => {
                  if (checkPermission('perm_revenue_collect_debt')) {
                    setSelectedDebtForDetail(null); // close detail modal
                    setSelectedDebt(selectedDebtForDetail); // trigger payment flow
                    setPayAmount(selectedDebtForDetail.debt);
                  }
                }}
                disabled={loadingDetailBreakdown || !detailBreakdown}
                className="px-4 py-2 bg-[#21398A] hover:bg-[#1a2e70] disabled:bg-slate-300 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-[#21398a]/10 disabled:shadow-none"
              >
                <Coins size={14} />
                Tiến hành thu tiền ngay
              </button>

              <button
                onClick={() => { setSelectedDebtForDetail(null); setDetailBreakdown(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-xs transition-all"
              >
                Đóng lại
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/20 backdrop-blur-[2px] px-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-100 animate-scale-up overflow-hidden">
            <div className="p-5 text-center">
              <div className="mx-auto mb-3.5 w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle size={24} />
              </div>
              <h3 className="text-md font-bold text-slate-800">Thao tác thành công</h3>
              <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{successMessage}</p>
            </div>
            <div className="h-1 bg-emerald-100">
              <div className="h-full bg-emerald-500" style={{ animation: 'shrinkBar 2s linear forwards' }} />
            </div>
          </div>
        </div>
      )}

      {/* Submitting Quick Payments Overlays */}
      <LoadingOverlay show={isSubmittingPay} message="Đang xử lý gạch nợ công nợ..." />
      <LoadingOverlay show={isGeneratingDebt} message="Đang cập nhật..." />

      {/* dynamic Print Receipt Template Area */}
      {mounted && activePrintReceipt && createPortal(
        (() => {
          const compLogo = companyInfo?.logoUrl || 'https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png';
        const compName = companyInfo?.name || 'Trung Tâm Phát Triển Giáo Dục Quốc Tế THT';
        const compAddr = companyInfo?.address || 'Số 01 Lê Hồng Phong, Phường Xuân Hương, Đà Lạt, Lâm Đồng';
        const compPhone = (companyInfo?.mobile1 && companyInfo?.mobile2) 
          ? `${companyInfo.mobile1} - ${companyInfo.mobile2}` 
          : (companyInfo?.mobile1 || companyInfo?.mobile2 || companyInfo?.hotline || '0931 277 200 - 0931 20 15 16');
        const compBankName = companyInfo?.bankName || 'Ngân hàng TMCP Quân đội (MB Bank)';
        const compAccountName = companyInfo?.accountName || 'CONG TY CP GD VA CN THT';
        const compAccountNumber = companyInfo?.accountNumber || '1900 8686 9999';

        return (
          <div id="receiptPrintArea">
            <div className="receipt-container">
              {/* Redesigned Header to match Dalat Center precisely */}
              <div className="receipt-logo-header flex justify-between items-start mb-6">
                <div>
                  <h1 className="receipt-title-new font-black text-black text-2xl uppercase tracking-wide">
                    PHIẾU THU HỌC PHÍ
                  </h1>
                </div>
                
                <div className="receipt-school-info text-right max-w-[320px]">
                  <img
                    src={compLogo}
                    alt="THT Logo"
                    style={{ height: '40px', objectFit: 'contain', float: 'right', marginBottom: '4px' }}
                  />
                  <div style={{ clear: 'both' }} />
                  <div className="receipt-school-name font-black text-[#21398A] text-[11px] uppercase tracking-tight">
                    {compName}
                  </div>
                  <div className="text-[9px] text-slate-600 font-semibold leading-tight mt-0.5">
                    Địa chỉ: {compAddr}
                  </div>
                  <div className="text-[9px] text-slate-600 font-semibold leading-tight">
                    Số điện thoại: {compPhone}
                  </div>
                </div>
              </div>

              {/* Profile Info Block with Blue Left Vertical Line */}
              <div className="receipt-profile-block border-l-[3.5px] border-[#21398A] pl-4 py-1.5 bg-blue-50/20 rounded-r-lg mb-6">
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-slate-500 font-bold">Student Name/ Họ và tên học sinh:</span>{' '}
                    <strong className="text-slate-800 text-sm font-black tracking-tight">{activePrintReceipt.student}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">Student Code/ Mã học sinh:</span>{' '}
                    <strong className="text-slate-800 text-sm font-black tracking-tight">{activePrintReceipt.khId}</strong>
                  </div>
                </div>
              </div>

              {/* Extra profile rows */}
              <div className="receipt-extra-profile space-y-1.5 text-xs text-slate-700 font-semibold border-b border-slate-100 pb-4 mb-4">
                <div>
                  <span className="text-slate-500 font-bold">Day of Birth/ Ngày tháng năm sinh:</span>{' '}
                  <span className="text-[#21398A] font-extrabold">{activePrintReceipt.studentDob || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Class/ Lớp học:</span>{' '}
                  <span className="text-[#21398A] font-extrabold uppercase">{activePrintReceipt.className}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Teacher/ Giáo viên:</span>{' '}
                  <span className="text-[#21398A] font-extrabold uppercase">{activePrintReceipt.teacherCN || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">Begin of term/ Ngày khai giảng:</span>{' '}
                  <span className="text-[#21398A] font-extrabold">{activePrintReceipt.beginTerm || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold">End of term/ Ngày kết khóa:</span>{' '}
                  <span className="text-[#21398A] font-extrabold">{activePrintReceipt.endTerm || '—'}</span>
                </div>
              </div>

              {/* Fees list */}
              <div className="receipt-fees-title text-slate-400 text-xs font-black uppercase tracking-wider mb-2.5">
                Fee/ Học phí
              </div>
              
              <div className="receipt-fees-list divide-y divide-slate-100/60 text-xs text-slate-700 font-semibold pb-4">
                {(() => {
                  const getFeeVal = (type: string) => {
                    const item = activePrintReceipt.items.find((x: any) => x.type === type);
                    return item ? (item.curDebt || 0) : 0;
                  };

                  const tuitionVal = getFeeVal('Học phí');
                  const cambridgeVal = getFeeVal('Lệ phí thi Cambridge');
                  const bookVal = getFeeVal('Tiền sách');
                  const foodVal = getFeeVal('Tiền ăn') || getFeeVal('Phí ăn');
                  const otherVal = getFeeVal('Phí khác');

                  // Chiết khấu
                  const tuitionItem = activePrintReceipt.items.find((x: any) => x.type === 'Học phí');
                  const discountPct = tuitionItem ? (tuitionItem.discountPct || 0) : 0;
                  const discountVND = tuitionItem ? (tuitionItem.discountVND || 0) : 0;

                  // Base Total (1) before discount
                  const totalBaseVal = tuitionVal + cambridgeVal + bookVal + foodVal + otherVal;
                  
                  // Old debt
                  const oldDebtVal = activePrintReceipt.totalSummary.oldDebt || 0;

                  // Grand must pay (2)
                  const mustPayVal = activePrintReceipt.totalSummary.mustPay || 0;

                  // Paid amount (3)
                  const paidVal = activePrintReceipt.totalSummary.paid || 0;

                  // Remain (1) + (2) + (3)
                  const remainVal = activePrintReceipt.totalSummary.remain !== undefined 
                    ? activePrintReceipt.totalSummary.remain 
                    : (mustPayVal - paidVal - (activePrintReceipt.totalSummary.surplusApplied || 0));

                  return (
                    <>
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Học phí:</span>
                        <span>{tuitionVal > 0 ? formatCurrency(tuitionVal) : '0 đ'}</span>
                      </div>
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Lệ phí thi Cambridge:</span>
                        <span>{cambridgeVal > 0 ? formatCurrency(cambridgeVal) : '0 đ'}</span>
                      </div>
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Tiền sách:</span>
                        <span>{bookVal > 0 ? formatCurrency(bookVal) : '0 đ'}</span>
                      </div>
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Phí ăn:</span>
                        <span>{foodVal > 0 ? formatCurrency(foodVal) : '0 đ'}</span>
                      </div>
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Phí khác:</span>
                        <span>{otherVal > 0 ? formatCurrency(otherVal) : '0 đ'}</span>
                      </div>
                      
                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>
                          Chiết khấu {discountPct > 0 ? `(${discountPct}%)` : ''}:
                        </span>
                        <span>
                          {discountVND > 0 ? `-${formatCurrency(discountVND)}` : '0 đ'}
                        </span>
                      </div>

                      <div className="flex justify-between py-2.5 items-center text-black font-bold border-t border-slate-200">
                        <span className="uppercase text-[10px] tracking-wider text-slate-500">Tổng cộng (1):</span>
                        <span className="text-sm">{formatCurrency(totalBaseVal)}</span>
                      </div>

                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Nợ tháng trước:</span>
                        <span>{oldDebtVal > 0 ? formatCurrency(oldDebtVal) : '0 đ'}</span>
                      </div>

                      <div className="flex justify-between py-2.5 items-center text-black font-bold border-t border-slate-200">
                        <span className="uppercase text-[10px] tracking-wider text-slate-500">Tổng phải thu (2):</span>
                        <span className="text-sm">{formatCurrency(mustPayVal)}</span>
                      </div>

                      <div className="flex justify-between py-2.5 items-center text-black font-bold">
                        <span className="uppercase text-[10px] tracking-wider text-slate-500">Đã thu (3):</span>
                        <span className="text-sm">{formatCurrency(paidVal)}</span>
                      </div>

                      <div className="flex justify-between py-2 items-center text-black font-normal">
                        <span>Ngày thu tiền/ Chuyển khoản:</span>
                        <span>
                          {activePrintReceipt.dateParts.day}/{activePrintReceipt.dateParts.month}/{activePrintReceipt.dateParts.year}
                        </span>
                      </div>

                      {/* Highlighted Remaining Amount block */}
                      <div className="flex justify-between p-3.5 items-center bg-slate-100 rounded-xl mt-3 text-black font-normal border border-slate-200/50">
                        <span className="uppercase text-[10.5px] tracking-wider text-slate-500">
                          (1)+(2)+(3) Còn lại cần đóng VND:
                        </span>
                        <span className="text-base">
                          {formatCurrency(Math.max(0, remainVal))}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Note alert in Red */}
              <div className="receipt-red-alert text-rose-600 text-[10px] font-normal mt-4 leading-relaxed text-center">
                Mọi thắc mắc về học phí ba mẹ vui lòng liên hệ trực tiếp zalo của trường qua SĐT: {compPhone}
              </div>

              {/* Payment instructions */}
              <div className="receipt-payment-guide border-t border-slate-200/80 pt-4 mt-4 text-[10px] text-slate-600 leading-normal font-semibold">
                <div className="font-normal text-slate-800 uppercase tracking-wide mb-1 text-[10.5px]">
                  Các hình thức thanh toán tại Trung Tâm:
                </div>
                <div className="mt-1">
                  a) Nộp tiền mặt tại văn phòng Trường THT
                </div>
                <div className="text-slate-500 pl-3">
                  Địa chỉ 01 Lê Hồng Phong, Phường Xuân Hương, Đà Lạt, Lâm Đồng
                </div>
                <div className="mt-1">
                  b) Chuyển khoản qua tài khoản ngân hàng: Công ty TNHH T.H.T, 0561000395009, VCB Đà Lạt.
                </div>
              </div>

            </div>
          </div>
        );
      })(),
      document.body
    )}
      {showPermModal && typeof window !== 'undefined' && createPortal(
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
        </div>,
        document.body
      )}
    </div>
  );
}
