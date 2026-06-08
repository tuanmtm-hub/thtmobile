'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { gasRequest } from '@/lib/gasApi';
import {
  Clock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Clock3,
  Edit,
  CheckCircle,
  X,
  Shield,
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

interface ShiftItem {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: string;
}

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

export default function ShiftsPage() {
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
      { label: 'Ca học' }
    ]);
  }, [setBreadcrumbs]);
  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state (SidePanel)
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedShift, setSelectedShift] = useState<ShiftItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Toast / Modal / Blocker states
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<ShiftItem | null>(null);

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

  const fetchShifts = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';
      const res = await gasRequest({
        sheet: 'Ca',
        action: 'FETCH_ALL',
        loginEmail: email,
        signal,
      });
      if (res.success && Array.isArray(res.data)) {
        const mapped: ShiftItem[] = res.data.map((item: any) => ({
          id: String(item[0] || ''),
          name: String(item[1] || ''),
          startTime: String(item[2] || ''),
          endTime: String(item[3] || ''),
          duration: String(item[4] || ''),
        }));
        setShifts(mapped);
      } else {
        setShifts([]);
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching shifts:', e);
      setLoading(false);
    }
  }, [user, getSignal]);

  useEffect(() => {
    if (user) {
      fetchShifts();
    }
  }, [user, fetchShifts]);

  const handleOpenAdd = () => {
    setName('');
    setStartTime('');
    setEndTime('');
    setShowAddPanel(true);
  };

  const handleOpenEdit = (shift: ShiftItem) => {
    setSelectedShift(shift);
    setName(shift.name);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setShowEditPanel(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startTime.trim() || !endTime.trim()) return;
    try {
      setSubmitting(true);
      const email = user?.email || '';
      const res = await gasRequest({
        sheet: 'Ca',
        action: 'INSERT',
        data: { id: generateID('CA'), name, startTime, endTime },
        loginEmail: email,
      });
      if (res.success) {
        triggerSuccess(res.message || 'Thêm ca học thành công!');
        setShowAddPanel(false);
        fetchShifts();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift || !name.trim() || !startTime.trim() || !endTime.trim()) return;

    try {
      setSubmitting(true);
      const email = user?.email || '';
      const res = await gasRequest({
        sheet: 'Ca',
        action: 'UPDATE',
        data: { id: selectedShift.id, name, startTime, endTime },
        loginEmail: email,
      });
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật ca học thành công!');
        setShowEditPanel(false);
        fetchShifts();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!shiftToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const email = user?.email || '';
      const res = await gasRequest({
        sheet: 'Ca',
        action: 'DELETE',
        data: { id: shiftToDelete.id },
        loginEmail: email,
      });
      if (res.success) {
        triggerSuccess(res.message || 'Xóa ca học thành công!');
        fetchShifts();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
      setShiftToDelete(null);
    }
  };

  // Filter shifts
  const filteredShifts = shifts.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort alphabetically by Vietnamese rules
  const sortedShifts = [...filteredShifts].sort((a, b) =>
    compareVietnameseNames(a.name, b.name)
  );

  // Pagination hook
  const {
    paginatedData: paginatedShifts,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(sortedShifts, 10, [searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Clock3 size={28} className="text-[#21398A]" />
            <span>Danh Sách Ca Học</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Thiết lập danh mục ca học chính thức của trung tâm bao gồm thời gian bắt đầu, kết thúc và thời lượng.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchShifts}
            disabled={loading}
            className="tht-btn-outline"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại danh sách</span>
          </button>

          <button
            onClick={() => {
              if (checkPermission('perm_settings_add')) {
                handleOpenAdd();
              }
            }}
            className="tht-btn-primary"
          >
            <Plus size={16} />
            <span>Thêm ca học mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
            <Clock size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng ca học</span>
            <span className="tht-kpi-value">{loading ? '...' : <AnimatedNumber value={shifts.length} />}</span>
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
                placeholder="Tìm kiếm theo Tên ca học..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
            <Clock3 size={16} className="text-[#21398A]" />
            <span>Tìm thấy: <strong className="text-slate-800">{filteredShifts.length}</strong> ca học</span>
          </div>
        </div>
      </div>

      {/* Table Data Grid */}
      <div className="tht-table-container">
        {loading ? (
          <div className="tht-loading-state">
            <RefreshCw size={24} className="tht-loading-spinner" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : filteredShifts.length === 0 ? (
          <div className="tht-empty-state">
            <Clock size={48} className="tht-empty-icon" />
            <span>Không tìm thấy ca học phù hợp.</span>
          </div>
        ) : (
          <>
            <div className="tht-table-wrapper">
              <table className="tht-table">
                <thead className="tht-table-thead">
                  <tr>
                    <th className="tht-table-th text-center">Tên ca học</th>
                    <th className="tht-table-th text-center">Thời gian</th>
                    <th className="tht-table-th text-center">Thời lượng</th>
                    <th className="tht-table-th text-center w-40">Hành động</th>
                  </tr>
                </thead>
                <tbody className="tht-table-tbody">
                  {paginatedShifts.map((shift) => (
                    <tr
                      key={shift.id}
                      className="tht-table-tr cursor-pointer"
                      onClick={() => {
                        setSelectedShift(shift);
                        setShowDetailPanel(true);
                      }}
                    >
                      <td className="tht-table-td text-center font-bold text-slate-800">
                        {shift.name}
                      </td>
                      <td className="tht-table-td text-center font-semibold text-slate-700">
                        <div className="flex items-center justify-center gap-1.5">
                          <Clock size={14} className="text-slate-400" />
                          <span>{shift.startTime} - {shift.endTime}</span>
                        </div>
                      </td>
                      <td className="tht-table-td text-center">
                        <span className="tht-badge tht-badge-success text-[10px]">
                          Thời lượng: {shift.duration} giờ
                        </span>
                      </td>
                      <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedShift(shift);
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
                                handleOpenEdit(shift);
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
                                setShiftToDelete(shift);
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
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="tht-pagination-container">
                <div className="tht-pagination-info">
                  Hiển thị từ <span>{startIndex + 1}</span> đến{' '}
                  <span>
                    {Math.min(startIndex + itemsPerPage, sortedShifts.length)}
                  </span>{' '}
                  trong tổng số <span>{sortedShifts.length}</span> ca học
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

      {/* Add Shift Modal */}
      {showAddPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Thêm ca học mới</span>
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
              <form id="add-shift-form" onSubmit={submitAdd} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên ca học</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Ca 1, Ca sáng"
                    className="tht-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Giờ bắt đầu</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="tht-input"
                    />
                  </div>

                  <div>
                    <label className="tht-input-label">Giờ kết thúc</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="tht-input"
                    />
                  </div>
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
                  form="add-shift-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? (
                    <><RefreshCw size={14} className="animate-spin" />Đang tạo...</>
                  ) : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit Shift Modal */}
      {showEditPanel && selectedShift && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Cập nhật ca học</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPanel(false);
                    setSelectedShift(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="edit-shift-form" onSubmit={submitEdit} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên ca học</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Ca 1"
                    className="tht-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Giờ bắt đầu</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="tht-input"
                    />
                  </div>

                  <div>
                    <label className="tht-input-label">Giờ kết thúc</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="tht-input"
                    />
                  </div>
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPanel(false);
                    setSelectedShift(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="edit-shift-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? (
                    <><RefreshCw size={14} className="animate-spin" />Đang cập nhật...</>
                  ) : 'Cập nhật thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Shift Modal */}
      {showDetailPanel && selectedShift && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Clock size={20} /></span>
                  <span>Chi tiết Ca học</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailPanel(false);
                    setSelectedShift(null);
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
                      <Clock3 size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedShift.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin ca học</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Khung giờ</span>
                      <p className="text-sm font-bold text-slate-700">{selectedShift.startTime} - {selectedShift.endTime}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Thời lượng</span>
                      <p className="text-sm font-bold text-slate-700">{selectedShift.duration} giờ</p>
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
                    setSelectedShift(null);
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
                      handleOpenEdit(selectedShift);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa Ca học</span>
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
      {showDeleteModal && shiftToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Xác nhận xóa ca học</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa ca học <strong className="text-slate-700">"{shiftToDelete.name}"</strong> không? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setShiftToDelete(null); }}
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
