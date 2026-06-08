'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import {
  Tag,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Ticket,
  Edit,
  X,
  Shield,
  Eye
} from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

const viCollator = new Intl.Collator(['vi', 'en'], {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true,
});

const compareVietnameseNames = (a: string, b: string) => {
  return viCollator.compare(a.trim(), b.trim());
};

interface VoucherItem {
  id: string;
  name: string;
  discountType: string; // '%' | 'VND'
  discountValue: number;
  description: string;
  status: string; // 'Đang hoạt động' | 'Đã khóa'
}

export default function Vouchers() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();

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

  const getSignal = useAbortController();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Voucher & Giảm giá' },
    ]);
  }, [setBreadcrumbs]);
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // SidePanel States
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Form fields
  const [voucherName, setVoucherName] = useState('');
  const [discountType, setDiscountType] = useState('%');
  const [discountValue, setDiscountValue] = useState(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('Đang hoạt động');
  const [selectedVoucher, setSelectedVoucher] = useState<VoucherItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Toast / Modal / Blocker states
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<VoucherItem | null>(null);

  const generateID = (prefix: string): string => {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${year}${rand}`;
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);
  };

  const fetchVouchers = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/vouchers',
          method: 'GET',
          loginEmail: user?.email || '',
        }),
        signal,
      });

      const res = await response.json();
      if (res.success && res.data) {
        // Data format: [ [id, name, discountType, discountValue, description, status], ... ]
        const formatted = res.data.map((v: any) => ({
          id: String(v[0] || ''),
          name: String(v[1] || ''),
          discountType: String(v[2] || '%'),
          discountValue: Number(v[3]) || 0,
          description: String(v[4] || ''),
          status: String(v[5] || 'Đang hoạt động'),
        }));
        setVouchers(formatted);
      } else {
        setVouchers([]);
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching vouchers:', e);
      setVouchers([]);
      setLoading(false);
    }
  }, [user?.email, getSignal]);

  useEffect(() => {
    if (user?.email) {
      fetchVouchers();
    }
  }, [user?.email, fetchVouchers]);

  const handleOpenAddPanel = () => {
    resetForm();
    setShowAddPanel(true);
  };

  const handleOpenEditPanel = (item: VoucherItem) => {
    setSelectedVoucher(item);
    setVoucherName(item.name);
    setDiscountType(item.discountType);
    setDiscountValue(item.discountValue);
    setDescription(item.description);
    setStatus(item.status);
    setShowEditPanel(true);
  };

  const handleAddVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherName.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/vouchers',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('VC'),
            name: voucherName,
            discountType,
            discountValue,
            description,
            status,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thêm voucher giảm giá thành công.');
        resetForm();
        setShowAddPanel(false);
        fetchVouchers();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoucher || !voucherName.trim()) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/vouchers',
          method: 'PUT',
          loginEmail: user?.email || '',
          data: {
            id: selectedVoucher.id,
            name: voucherName,
            discountType,
            discountValue,
            description,
            status,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật voucher thành công.');
        resetForm();
        setShowEditPanel(false);
        fetchVouchers();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!voucherToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/vouchers',
          method: 'DELETE',
          loginEmail: user?.email || '',
          data: { id: voucherToDelete.id },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Voucher đã được xóa bỏ khỏi hệ thống.');
        fetchVouchers();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
      setVoucherToDelete(null);
    }
  };

  const resetForm = () => {
    setVoucherName('');
    setDiscountType('%');
    setDiscountValue(0);
    setDescription('');
    setStatus('Đang hoạt động');
    setSelectedVoucher(null);
  };

  const formatDiscount = (val: number, type: string) => {
    if (type === '%') return `${val}%`;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Search filters
  const filteredVouchers = vouchers.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting alphabetically using Vietnamese collation rules
  const sortedVouchers = [...filteredVouchers].sort((a, b) => compareVietnameseNames(a.name, b.name));

  // Pagination standard
  const {
    paginatedData: paginatedVouchers,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(sortedVouchers, 10, [searchQuery]);

  // KPI Calculations
  const totalCount = vouchers.length;
  const activeCount = vouchers.filter((v) => v.status === 'Đang hoạt động').length;
  const lockedCount = vouchers.filter((v) => v.status !== 'Đang hoạt động').length;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Ticket size={28} className="text-[#21398A]" />
            <span>Voucher & Mã Giảm Giá</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Quản lý các chương trình ưu đãi, phiếu giảm giá và hỗ trợ miễn giảm học phí cho học sinh.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchVouchers}
            disabled={loading}
            className="tht-btn-outline"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại danh sách</span>
          </button>

          <button
            onClick={() => {
              if (checkPermission('perm_settings_add')) {
                handleOpenAddPanel();
              }
            }}
            className="tht-btn-primary"
          >
            <Plus size={16} />
            <span>Thêm voucher mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
            <Ticket size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng số voucher</span>
            <span className="tht-kpi-value tht-kpi-value-primary">{loading ? '...' : <AnimatedNumber value={totalCount} />}</span>
          </div>
        </div>

        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Đang hoạt động</span>
            <span className="tht-kpi-value tht-kpi-value-emerald">{loading ? '...' : <AnimatedNumber value={activeCount} />}</span>
          </div>
        </div>

        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-rose">
            <XCircle size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Đã khóa</span>
            <span className="tht-kpi-value tht-kpi-value-rose">{loading ? '...' : <AnimatedNumber value={lockedCount} />}</span>
          </div>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên hoặc nội dung mô tả voucher..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
            <Tag size={16} className="text-[#21398A]" />
            <span>Tìm thấy: <strong className="text-slate-800">{filteredVouchers.length}</strong> voucher</span>
          </div>
        </div>
      </div>

      {/* List Table */}
      <div className="tht-table-container">
        {loading ? (
          <div className="tht-loading-state">
            <RefreshCw size={24} className="tht-loading-spinner" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="tht-empty-state">
            <Ticket size={48} className="tht-empty-icon" />
            <span>Không tìm thấy voucher giảm giá phù hợp.</span>
          </div>
        ) : (
          <>
            <div className="tht-table-wrapper">
              <table className="tht-table">
                <thead className="tht-table-thead">
                  <tr>
                    <th className="tht-table-th text-center">Tên voucher</th>
                    <th className="tht-table-th text-center">Chiết khấu</th>
                    <th className="tht-table-th text-center">Trạng thái</th>
                    <th className="tht-table-th text-center">Mô tả</th>
                    <th className="tht-table-th text-center w-40">Hành động</th>
                  </tr>
                </thead>
                <tbody className="tht-table-tbody">
                  {paginatedVouchers.map((item, idx) => {
                    const isLock = item.status.toLowerCase().includes('khóa') || item.status.toLowerCase().includes('lock');
                    return (
                      <tr
                        key={idx}
                        className="tht-table-tr cursor-pointer"
                        onClick={() => {
                          setSelectedVoucher(item);
                          setShowDetailPanel(true);
                        }}
                      >
                        <td className="tht-table-td text-center font-bold text-slate-800">
                          {item.name}
                        </td>
                        <td className="tht-table-td text-center font-bold text-[#21398A] text-base">
                          {formatDiscount(item.discountValue, item.discountType)}
                        </td>
                        <td className="tht-table-td text-center">
                          {isLock ? (
                            <span className="tht-badge tht-badge-danger">
                              ĐÃ KHÓA
                            </span>
                          ) : (
                            <span className="tht-badge tht-badge-success">
                              HOẠT ĐỘNG
                            </span>
                          )}
                        </td>
                        <td className="tht-table-td text-center font-semibold text-slate-500 max-w-xs truncate" title={item.description}>
                          {item.description || '—'}
                        </td>
                        <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedVoucher(item);
                                setShowDetailPanel(true);
                              }}
                              className="tht-text-action-btn tht-text-action-btn-gray"
                            >
                              <Eye size={14} />
                              <span>Chi tiết</span>
                            </button>
                            {(isAdmin || userPerms['perm_settings_edit']) && (
                              <button
                                onClick={() => {
                                  handleOpenEditPanel(item);
                                }}
                                className="tht-text-action-btn tht-text-action-btn-blue"
                              >
                                <Edit size={14} />
                                <span>Sửa</span>
                              </button>
                            )}
                            {(isAdmin || userPerms['perm_settings_delete']) && (
                              <button
                                onClick={() => {
                                  setVoucherToDelete(item);
                                  setShowDeleteModal(true);
                                }}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="tht-pagination-container">
                <div className="tht-pagination-info">
                  Hiển thị từ <span>{startIndex + 1}</span> đến{' '}
                  <span>
                    {Math.min(startIndex + itemsPerPage, sortedVouchers.length)}
                  </span>{' '}
                  trong tổng số <span>{sortedVouchers.length}</span> mã giảm giá
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

      {/* Add Voucher Modal */}
      {showAddPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Khai báo Voucher Mới</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="add-voucher-form" onSubmit={handleAddVoucher} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên Voucher / Chương trình</label>
                  <input
                    type="text"
                    value={voucherName}
                    onChange={(e) => setVoucherName(e.target.value)}
                    placeholder="Ví dụ: Giảm 10% hè, Miễn giảm 500k..."
                    className="tht-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Loại giảm trừ</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="tht-select"
                    >
                      <option value="%">Theo phần trăm (%)</option>
                      <option value="VND">Giảm số tiền cố định (VND)</option>
                    </select>
                  </div>
                  <div>
                    <label className="tht-input-label">Trị giá giảm</label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="tht-input"
                      required
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="tht-input-label">Trạng thái áp dụng</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang hoạt động">Đang hoạt động (Cho phép dùng)</option>
                    <option value="Đã khóa">Đã khóa (Không cho phép dùng)</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Mô tả chi tiết</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ghi chú điều kiện áp dụng (Ví dụ: Chỉ áp dụng đóng học phí trọn khóa)..."
                    className="tht-input min-h-[100px] py-2.5"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAddPanel(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="add-voucher-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang tạo...
                    </>
                  ) : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit Voucher Modal */}
      {showEditPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Chỉnh sửa thông tin Voucher</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditPanel(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="edit-voucher-form" onSubmit={handleEditVoucher} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên Voucher / Chương trình</label>
                  <input
                    type="text"
                    value={voucherName}
                    onChange={(e) => setVoucherName(e.target.value)}
                    placeholder="Ví dụ: Giảm 10% hè, Miễn giảm 500k..."
                    className="tht-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Loại giảm trừ</label>
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      className="tht-select"
                    >
                      <option value="%">Theo phần trăm (%)</option>
                      <option value="VND">Giảm số tiền cố định (VND)</option>
                    </select>
                  </div>
                  <div>
                    <label className="tht-input-label">Trị giá giảm</label>
                    <input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(Number(e.target.value))}
                      className="tht-input"
                      required
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <label className="tht-input-label">Trạng thái áp dụng</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang hoạt động">Đang hoạt động (Cho phép dùng)</option>
                    <option value="Đã khóa">Đã khóa (Không cho phép dùng)</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Mô tả chi tiết</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ghi chú điều kiện áp dụng (Ví dụ: Chỉ áp dụng đóng học phí trọn khóa)..."
                    className="tht-input min-h-[100px] py-2.5"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowEditPanel(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="edit-voucher-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : 'Cập nhật thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Voucher Modal */}
      {showDetailPanel && selectedVoucher && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Ticket size={20} /></span>
                  <span>Chi tiết Voucher</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailPanel(false);
                    setSelectedVoucher(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-50 text-[#21398A] rounded-xl">
                      <Ticket size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedVoucher.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin Voucher</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Tên Voucher</span>
                      <p className="text-sm font-bold text-slate-700">{selectedVoucher.name}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Trị giá giảm</span>
                      <p className="text-sm font-bold text-[#21398A]">
                        {formatDiscount(selectedVoucher.discountValue, selectedVoucher.discountType)}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Trạng thái</span>
                      <div>
                        {selectedVoucher.status.toLowerCase().includes('khóa') || selectedVoucher.status.toLowerCase().includes('lock') ? (
                          <span className="tht-badge tht-badge-danger mt-1">
                            ĐÃ KHÓA
                          </span>
                        ) : (
                          <span className="tht-badge tht-badge-success mt-1">
                            HOẠT ĐỘNG
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Mô tả chi tiết</span>
                      <p className="text-sm font-semibold text-slate-500 whitespace-pre-wrap">{selectedVoucher.description || '—'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailPanel(false);
                    setSelectedVoucher(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkPermission('perm_settings_edit')) {
                      setShowDetailPanel(false);
                      handleOpenEditPanel(selectedVoucher);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa Voucher</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ===================== PORTALS ===================== */}

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
      {showDeleteModal && voucherToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Xác nhận xóa voucher</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa mã giảm giá <strong className="text-slate-700">"{voucherToDelete.name}"</strong> không? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setVoucherToDelete(null); }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-500/20"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Success Modal */}
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
