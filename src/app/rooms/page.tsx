'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { gasRequest } from '@/lib/gasApi';
import {
  Home,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  X,
  Search,
  CheckCircle,
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

interface RoomItem {
  id: string;
  name: string;
}

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

export default function Rooms() {
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
      { label: 'Phòng học' }
    ]);
  }, [setBreadcrumbs]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog States
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<RoomItem | null>(null);

  // Toast / Modal / Blocker states
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<RoomItem | null>(null);

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

  const fetchRooms = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const res = await gasRequest({
        sheet: 'Room',
        action: 'FETCH_ALL',
        loginEmail: user?.email || '',
        signal,
      });
      if (res.success && res.data) {
        const formatted = res.data.map((r: any) => ({
          id: String(r[0] || ''),
          name: String(r[1] || ''),
        }));
        setRooms(formatted);
      } else {
        setRooms([]);
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching rooms:', e);
      setRooms([]);
      setLoading(false);
    }
  }, [user, getSignal]);

  useEffect(() => {
    if (user) {
      fetchRooms();
    }
  }, [user, fetchRooms]);

  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    try {
      setSubmitting(true);
      const res = await gasRequest({
        sheet: 'Room',
        action: 'INSERT',
        data: { id: generateID('PH'), name: roomName },
        loginEmail: user?.email || '',
      });
      if (res.success) {
        triggerSuccess(res.message || 'Thêm phòng học thành công.');
        setRoomName('');
        setShowAddPanel(false);
        fetchRooms();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !roomName.trim()) return;

    try {
      setSubmitting(true);
      const res = await gasRequest({
        sheet: 'Room',
        action: 'UPDATE',
        data: { id: selectedRoom.id, name: roomName },
        loginEmail: user?.email || '',
      });
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật phòng học thành công.');
        setRoomName('');
        setSelectedRoom(null);
        setShowEditPanel(false);
        fetchRooms();
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
    if (!roomToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const res = await gasRequest({
        sheet: 'Room',
        action: 'DELETE',
        data: { id: roomToDelete.id },
        loginEmail: user?.email || '',
      });
      if (res.success) {
        triggerSuccess(res.message || 'Đã xóa phòng học thành công.');
        fetchRooms();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
      setRoomToDelete(null);
    }
  };

  const filteredRooms = rooms.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort alphabetically using Vietnamese rules
  const sortedRooms = [...filteredRooms].sort((a, b) =>
    compareVietnameseNames(a.name, b.name)
  );

  // Pagination hook
  const {
    paginatedData: paginatedRooms,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(sortedRooms, 10, [searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Danh sách Phòng học</h1>
          <p className="text-slate-500 mt-1">
            Quản lý vị trí phòng học trực tiếp của trung tâm THT Center.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchRooms}
            disabled={loading}
            className="tht-btn-outline"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại danh sách</span>
          </button>

          <button
            onClick={() => {
              if (checkPermission('perm_settings_add')) {
                setRoomName('');
                setShowAddPanel(true);
              }
            }}
            className="tht-btn-primary"
          >
            <Plus size={16} />
            <span>Thêm phòng học mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
            <Home size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng phòng học</span>
            <span className="tht-kpi-value">{loading ? '...' : <AnimatedNumber value={rooms.length} />}</span>
          </div>
        </div>
      </div>

      {/* Search Toolbar controls */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm theo Tên phòng học..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
            <Home size={16} className="text-[#21398A]" />
            <span>Tìm thấy: <strong className="text-slate-800">{filteredRooms.length}</strong> phòng</span>
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
        ) : filteredRooms.length === 0 ? (
          <div className="tht-empty-state">
            <Home size={48} className="tht-empty-icon" />
            <span>Không tìm thấy phòng học phù hợp.</span>
          </div>
        ) : (
          <>
            <div className="tht-table-wrapper">
              <table className="tht-table">
                <thead className="tht-table-thead">
                  <tr>
                    <th className="tht-table-th text-center">Tên phòng học</th>
                    <th className="tht-table-th text-center w-40">Hành động</th>
                  </tr>
                </thead>
                <tbody className="tht-table-tbody">
                  {paginatedRooms.map((item) => (
                    <tr
                      key={item.id}
                      className="tht-table-tr cursor-pointer"
                      onClick={() => {
                        setSelectedRoom(item);
                        setShowDetailPanel(true);
                      }}
                    >
                      <td className="tht-table-td text-center font-bold text-slate-800">
                        {item.name}
                      </td>
                      <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedRoom(item);
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
                                setSelectedRoom(item);
                                setRoomName(item.name);
                                setShowEditPanel(true);
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
                                setRoomToDelete(item);
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
                    {Math.min(startIndex + itemsPerPage, sortedRooms.length)}
                  </span>{' '}
                  trong tổng số <span>{sortedRooms.length}</span> phòng học
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

      {/* Add Room Modal */}
      {showAddPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Khai báo Phòng học Mới</span>
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
              <form id="add-room-form" onSubmit={handleAddRoom} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên phòng học</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Ví dụ: Phòng 101, Phòng Online..."
                    className="tht-input"
                    required
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
                  form="add-room-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Đang lưu...
                    </>
                  ) : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Edit Room Modal */}
      {showEditPanel && selectedRoom && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Chỉnh sửa Phòng học</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPanel(false);
                    setSelectedRoom(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="edit-room-form" onSubmit={handleEditRoom} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên phòng học</label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Ví dụ: Phòng 101, Phòng Online..."
                    className="tht-input"
                    required
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPanel(false);
                    setSelectedRoom(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="edit-room-form"
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

      {/* Detail Room Modal */}
      {showDetailPanel && selectedRoom && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Home size={20} /></span>
                  <span>Chi tiết Phòng học</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailPanel(false);
                    setSelectedRoom(null);
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
                      <Home size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedRoom.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin phòng học</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Tên phòng</span>
                      <p className="text-sm font-bold text-slate-700">{selectedRoom.name}</p>
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
                    setSelectedRoom(null);
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
                      setRoomName(selectedRoom.name);
                      setShowEditPanel(true);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa phòng học</span>
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
      {showDeleteModal && roomToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Xác nhận xóa phòng học</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa phòng học <strong className="text-slate-700">"{roomToDelete.name}"</strong> không? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setRoomToDelete(null); }}
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
