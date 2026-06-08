'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import {
  Calendar,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  Globe,
  BookOpen,
  Clock,
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

interface HolidayItem {
  name: string;
  start: string;
  end: string;
  scope: string; // 'ALL' | 'CLASS'
  classes: string;
}

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

export default function Holidays() {
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
      { label: 'Ngày nghỉ lễ' }
    ]);
  }, [setBreadcrumbs]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // SidePanel States
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayItem | null>(null);

  // Form Field States
  const [holidayName, setHolidayName] = useState('');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');
  const [holidayScope, setHolidayScope] = useState('ALL');
  const [oldHolidayName, setOldHolidayName] = useState('');

  // Scope & Class Multi-select States
  const [classesList, setClassesList] = useState<{ id: string; name: string }[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [classSearchQuery, setClassSearchQuery] = useState('');

  // Toast / Modal / Blocker states
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<HolidayItem | null>(null);

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

  const fetchPageData = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const [holidaysResponse, classesResponse] = await Promise.all([
        fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/holidays',
            method: 'GET',
            loginEmail: user?.email || '',
          }),
          signal,
        }),
        fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: 'LH',
            action: 'FETCH_ALL',
            loginEmail: user?.email || '',
          }),
          signal,
        }),
      ]);

      const holidaysRes = await holidaysResponse.json();
      const classesRes = await classesResponse.json();

      if (holidaysRes.success && holidaysRes.data) {
        // Data format: [ [name, start, end, scope, classesCSV], ... ]
        const formatted = holidaysRes.data.map((h: any) => ({
          name: String(h[0] || ''),
          start: String(h[1] || ''),
          end: String(h[2] || ''),
          scope: String(h[3] || 'ALL'),
          classes: String(h[4] || ''),
        }));
        setHolidays(formatted);
      } else {
        setHolidays([]);
      }

      if (classesRes.success && Array.isArray(classesRes.data) && classesRes.data.length > 0) {
        const rows = classesRes.data;
        const header = rows[0].map((h: any) => String(h || '').trim());
        const iId = header.indexOf('ID');
        const iName = header.indexOf('Tên lớp');
        const iStatus = header.indexOf('Trạng thái');
        if (iId > -1 && iName > -1) {
          const list = rows.slice(1).map((r: any) => ({
            id: String(r[iId] || ''),
            name: String(r[iName] || ''),
            status: iStatus > -1 ? String(r[iStatus] || '') : '',
          })).filter((c: any) => {
            const hasIdAndName = c.id && c.name;
            const isActive = c.status.toLowerCase().trim() === 'đang học' || c.status.toLowerCase().trim() === 'dang hoc';
            return hasIdAndName && isActive;
          });
          setClassesList(list);
        }
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching page data:', e);
      setHolidays([]);
      setLoading(false);
    }
  }, [user?.email, getSignal]);

  const getClassNamesDisplay = useCallback((classesCSV: string) => {
    if (!classesCSV) return '';
    const parts = classesCSV.split(/[,;\n]/).map(x => x.trim()).filter(Boolean);
    const names = parts.map(part => {
      const cls = classesList.find(c => c.id === part || c.name === part);
      return cls ? cls.name : part;
    });
    return names.join(', ');
  }, [classesList]);

  useEffect(() => {
    if (user?.email) {
      fetchPageData();
    }
  }, [user?.email, fetchPageData]);

  const handleOpenAddPanel = () => {
    setHolidayName('');
    setHolidayStart('');
    setHolidayEnd('');
    setHolidayScope('ALL');
    setSelectedClasses([]);
    setClassSearchQuery('');
    setShowAddPanel(true);
  };

  const handleOpenEditPanel = (item: HolidayItem) => {
    setOldHolidayName(item.name);
    setHolidayName(item.name);
    setHolidayStart(formatDMYToYMD(item.start));
    setHolidayEnd(formatDMYToYMD(item.end));
    setHolidayScope(item.scope);

    // Parse selected classes from item.classes
    const initialClasses = item.classes
      ? item.classes.split(',').map(c => {
        const trimmed = c.trim();
        const found = classesList.find(cls => cls.name === trimmed || cls.id === trimmed);
        return found ? found.id : trimmed;
      }).filter(Boolean)
      : [];
    setSelectedClasses(initialClasses);
    setClassSearchQuery('');
    setShowEditPanel(true);
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayStart || !holidayEnd) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/holidays',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('NL'),
            name: holidayName,
            start: holidayStart,
            end: holidayEnd,
            scope: holidayScope,
            classes: holidayScope === 'ALL' ? '' : selectedClasses.join(','),
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thêm ngày nghỉ lễ thành công.');
        setShowAddPanel(false);
        fetchPageData();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayStart || !holidayEnd) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/holidays',
          method: 'PUT',
          loginEmail: user?.email || '',
          data: {
            oldName: oldHolidayName,
            name: holidayName,
            start: holidayStart,
            end: holidayEnd,
            scope: holidayScope,
            classes: holidayScope === 'ALL' ? '' : selectedClasses.join(','),
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật ngày nghỉ lễ thành công.');
        setShowEditPanel(false);
        fetchPageData();
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
    if (!holidayToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/holidays',
          method: 'DELETE',
          loginEmail: user?.email || '',
          data: { name: holidayToDelete.name },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Đã xóa ngày nghỉ lễ.');
        fetchPageData();
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
      setHolidayToDelete(null);
    }
  };

  // Convert dd/MM/yyyy to yyyy-MM-dd for HTML date input
  const formatDMYToYMD = (dmy: string) => {
    if (!dmy) return '';
    const parts = dmy.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '';
  };

  // Search filter
  const filteredHolidays = holidays.filter(h =>
    h.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sorting
  const sortedHolidays = [...filteredHolidays].sort((a, b) => compareVietnameseNames(a.name, b.name));

  // Pagination hook standard
  const {
    paginatedData: paginatedHolidays,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(sortedHolidays, 10, [searchQuery]);

  // KPI calculations
  const totalHolidaysCount = holidays.length;
  const globalHolidaysCount = holidays.filter(h => h.scope === 'ALL').length;
  const classHolidaysCount = holidays.filter(h => h.scope === 'CLASS').length;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Calendar size={28} className="text-[#21398A]" />
            <span>Cấu hình Ngày nghỉ lễ</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Định cấu hình các ngày nghỉ lễ toàn quốc hoặc nghỉ lễ riêng biệt theo từng lớp để tự động gia hạn thời khóa biểu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPageData}
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
            <span>Thêm ngày nghỉ lễ mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
            <Calendar size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng ngày nghỉ lễ</span>
            <span className="tht-kpi-value tht-kpi-value-primary">{loading ? '...' : <AnimatedNumber value={totalHolidaysCount} />}</span>
          </div>
        </div>

        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
            <Globe size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Toàn bộ trung tâm</span>
            <span className="tht-kpi-value tht-kpi-value-emerald">{loading ? '...' : <AnimatedNumber value={globalHolidaysCount} />}</span>
          </div>
        </div>

        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-amber">
            <BookOpen size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Theo lớp chỉ định</span>
            <span className="tht-kpi-value tht-kpi-value-amber">{loading ? '...' : <AnimatedNumber value={classHolidaysCount} />}</span>
          </div>
        </div>
      </div>

      {/* Search Filter & Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tên ngày lễ hoặc lớp học được áp dụng..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
            <Calendar size={16} className="text-[#21398A]" />
            <span>Tìm thấy: <strong className="text-slate-800">{filteredHolidays.length}</strong> ngày nghỉ</span>
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
        ) : filteredHolidays.length === 0 ? (
          <div className="tht-empty-state">
            <Calendar size={48} className="tht-empty-icon" />
            <span>Chưa khai báo ngày nghỉ lễ phù hợp.</span>
          </div>
        ) : (
          <>
            <div className="tht-table-wrapper">
              <table className="tht-table">
                <thead className="tht-table-thead">
                  <tr>
                    <th className="tht-table-th text-center">Tên ngày nghỉ lễ</th>
                    <th className="tht-table-th text-center">Thời gian nghỉ</th>
                    <th className="tht-table-th text-center">Đối tượng áp dụng</th>
                    <th className="tht-table-th text-center w-40">Hành động</th>
                  </tr>
                </thead>
                <tbody className="tht-table-tbody">
                  {paginatedHolidays.map((item, idx) => (
                    <tr
                      key={idx}
                      className="tht-table-tr cursor-pointer"
                      onClick={() => {
                        setSelectedHoliday(item);
                        setShowDetailPanel(true);
                      }}
                    >
                      <td className="tht-table-td text-center font-bold text-slate-800">
                        {item.name}
                      </td>
                      <td className="tht-table-td text-center">
                        <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                          <Clock size={12} className="text-slate-400" />
                          <span>{item.start}</span>
                          <span className="text-slate-400 font-normal">đến</span>
                          <span>{item.end || item.start}</span>
                        </div>
                      </td>
                      <td className="tht-table-td text-center">
                        {item.scope === 'ALL' ? (
                          <span className="tht-badge tht-badge-info">
                            <Globe size={10} />
                            Toàn bộ trung tâm
                          </span>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            <span className="tht-badge tht-badge-warning">
                              <BookOpen size={10} />
                              Theo lớp chỉ định
                            </span>
                            <span className="text-[11px] text-slate-500 max-w-[200px] truncate" title={getClassNamesDisplay(item.classes)}>
                              {getClassNamesDisplay(item.classes)}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedHoliday(item);
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
                                setHolidayToDelete(item);
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
                    {Math.min(startIndex + itemsPerPage, sortedHolidays.length)}
                  </span>{' '}
                  trong tổng số <span>{sortedHolidays.length}</span> ngày nghỉ lễ
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

      {/* Add Holiday Modal */}
      {showAddPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Thêm Ngày nghỉ lễ Mới</span>
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
              <form id="add-holiday-form" onSubmit={handleAddHoliday} className="p-6 space-y-4 animate-in fade-in duration-200">
                <div>
                  <label className="tht-input-label">Tên ngày nghỉ lễ</label>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="Ví dụ: Nghỉ Tết Dương Lịch..."
                    className="tht-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Từ ngày</label>
                    <input
                      type="date"
                      value={holidayStart}
                      max="9999-12-31"
                      onChange={(e) => setHolidayStart(e.target.value)}
                      className="tht-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="tht-input-label">Đến ngày</label>
                    <input
                      type="date"
                      value={holidayEnd}
                      max="9999-12-31"
                      onChange={(e) => setHolidayEnd(e.target.value)}
                      className="tht-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="tht-input-label">Phạm vi áp dụng</label>
                  <div className="flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                      <input
                        type="radio"
                        name="add-holiday-scope"
                        value="ALL"
                        checked={holidayScope === 'ALL'}
                        onChange={() => setHolidayScope('ALL')}
                        className="text-[#21398A] focus:ring-[#21398A] cursor-pointer"
                      />
                      <span>Toàn bộ trung tâm</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                      <input
                        type="radio"
                        name="add-holiday-scope"
                        value="CLASS"
                        checked={holidayScope === 'CLASS'}
                        onChange={() => setHolidayScope('CLASS')}
                        className="text-[#21398A] focus:ring-[#21398A] cursor-pointer"
                      />
                      <span>Lớp học chỉ định</span>
                    </label>
                  </div>
                </div>

                {holidayScope === 'CLASS' && (
                  <div className="space-y-2 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-200">
                    <label className="tht-input-label">Chọn lớp áp dụng</label>
                    <input
                      type="text"
                      placeholder="Tìm kiếm lớp học..."
                      value={classSearchQuery}
                      onChange={(e) => setClassSearchQuery(e.target.value)}
                      className="tht-input py-2 text-xs"
                    />

                    {/* Selected classes tags */}
                    {selectedClasses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 max-h-24 overflow-y-auto">
                        {selectedClasses.map(clsId => {
                          const cls = classesList.find(c => c.id === clsId);
                          return (
                            <span key={clsId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#21398A] border border-blue-200 rounded-lg text-xs font-extrabold shadow-2xs">
                              <span>{cls ? cls.name : clsId}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedClasses(prev => prev.filter(id => id !== clsId))}
                                className="text-blue-400 hover:text-blue-600 font-black ml-1 transition-colors"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Classes list to select */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-inner">
                      {classesList
                        .filter(cls => cls.name.toLowerCase().includes(classSearchQuery.toLowerCase()))
                        .map(cls => {
                          const isChecked = selectedClasses.includes(cls.id);
                          return (
                            <label key={cls.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 font-bold transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedClasses(prev => prev.filter(id => id !== cls.id));
                                  } else {
                                    setSelectedClasses(prev => [...prev, cls.id]);
                                  }
                                }}
                                className="rounded text-[#21398A] focus:ring-[#21398A]/20 cursor-pointer"
                              />
                              <span>{cls.name}</span>
                            </label>
                          );
                        })}
                      {classesList.filter(cls => cls.name.toLowerCase().includes(classSearchQuery.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                          Không tìm thấy lớp học phù hợp.
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  form="add-holiday-form"
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

      {/* Edit Holiday Modal */}
      {showEditPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Chỉnh sửa Ngày lễ</span>
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
              <form id="edit-holiday-form" onSubmit={handleEditHoliday} className="p-6 space-y-4 animate-in fade-in duration-200">
                <div>
                  <label className="tht-input-label">Tên ngày nghỉ lễ</label>
                  <input
                    type="text"
                    value={holidayName}
                    onChange={(e) => setHolidayName(e.target.value)}
                    placeholder="Ví dụ: Nghỉ Tết Dương Lịch..."
                    className="tht-input"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="tht-input-label">Từ ngày</label>
                    <input
                      type="date"
                      value={holidayStart}
                      max="9999-12-31"
                      onChange={(e) => setHolidayStart(e.target.value)}
                      className="tht-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="tht-input-label">Đến ngày</label>
                    <input
                      type="date"
                      value={holidayEnd}
                      max="9999-12-31"
                      onChange={(e) => setHolidayEnd(e.target.value)}
                      className="tht-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="tht-input-label">Phạm vi áp dụng</label>
                  <div className="flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                      <input
                        type="radio"
                        name="edit-holiday-scope"
                        value="ALL"
                        checked={holidayScope === 'ALL'}
                        onChange={() => setHolidayScope('ALL')}
                        className="text-[#21398A] focus:ring-[#21398A] cursor-pointer"
                      />
                      <span>Toàn bộ trung tâm</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700">
                      <input
                        type="radio"
                        name="edit-holiday-scope"
                        value="CLASS"
                        checked={holidayScope === 'CLASS'}
                        onChange={() => setHolidayScope('CLASS')}
                        className="text-[#21398A] focus:ring-[#21398A] cursor-pointer"
                      />
                      <span>Lớp học chỉ định</span>
                    </label>
                  </div>
                </div>

                {holidayScope === 'CLASS' && (
                  <div className="space-y-2 border-t border-slate-100 pt-3 animate-in slide-in-from-top-2 duration-200">
                    <label className="tht-input-label">Chọn lớp áp dụng</label>
                    <input
                      type="text"
                      placeholder="Tìm kiếm lớp học..."
                      value={classSearchQuery}
                      onChange={(e) => setClassSearchQuery(e.target.value)}
                      className="tht-input py-2 text-xs"
                    />

                    {/* Selected classes tags */}
                    {selectedClasses.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 max-h-24 overflow-y-auto">
                        {selectedClasses.map(clsId => {
                          const cls = classesList.find(c => c.id === clsId);
                          return (
                            <span key={clsId} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#21398A] border border-blue-200 rounded-lg text-xs font-extrabold shadow-2xs">
                              <span>{cls ? cls.name : clsId}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedClasses(prev => prev.filter(id => id !== clsId))}
                                className="text-blue-400 hover:text-blue-600 font-black ml-1 transition-colors"
                              >
                                &times;
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Classes list to select */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 bg-white shadow-inner">
                      {classesList
                        .filter(cls => cls.name.toLowerCase().includes(classSearchQuery.toLowerCase()))
                        .map(cls => {
                          const isChecked = selectedClasses.includes(cls.id);
                          return (
                            <label key={cls.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 cursor-pointer text-xs text-slate-700 font-bold transition-colors">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedClasses(prev => prev.filter(id => id !== cls.id));
                                  } else {
                                    setSelectedClasses(prev => [...prev, cls.id]);
                                  }
                                }}
                                className="rounded text-[#21398A] focus:ring-[#21398A]/20 cursor-pointer"
                              />
                              <span>{cls.name}</span>
                            </label>
                          );
                        })}
                      {classesList.filter(cls => cls.name.toLowerCase().includes(classSearchQuery.toLowerCase())).length === 0 && (
                        <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                          Không tìm thấy lớp học phù hợp.
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  form="edit-holiday-form"
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

      {/* Detail Holiday Modal */}
      {showDetailPanel && selectedHoliday && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Calendar size={20} /></span>
                  <span>Chi tiết Ngày nghỉ lễ</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailPanel(false);
                    setSelectedHoliday(null);
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
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedHoliday.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin Ngày nghỉ lễ</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Tên ngày nghỉ lễ</span>
                      <p className="text-sm font-bold text-slate-700">{selectedHoliday.name}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Ngày bắt đầu</span>
                      <p className="text-sm font-bold text-slate-700">{selectedHoliday.start}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Ngày kết thúc</span>
                      <p className="text-sm font-bold text-slate-700">{selectedHoliday.end || selectedHoliday.start}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Phạm vi áp dụng</span>
                      <div className="mt-1">
                        {selectedHoliday.scope === 'ALL' ? (
                          <span className="tht-badge tht-badge-info">
                            <Globe size={10} className="mr-1 inline" />
                            Toàn bộ trung tâm
                          </span>
                        ) : (
                          <div className="space-y-2">
                            <span className="tht-badge tht-badge-warning">
                              <BookOpen size={10} className="mr-1 inline" />
                              Theo lớp chỉ định
                            </span>
                            <div className="mt-2 text-sm text-slate-700 font-semibold leading-relaxed">
                              <strong>Lớp học áp dụng:</strong> {getClassNamesDisplay(selectedHoliday.classes)}
                            </div>
                          </div>
                        )}
                      </div>
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
                    setSelectedHoliday(null);
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
                      handleOpenEditPanel(selectedHoliday);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa Ngày nghỉ lễ</span>
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
      {showDeleteModal && holidayToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">Xác nhận xóa ngày nghỉ lễ</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa ngày lễ <strong className="text-slate-700">"{holidayToDelete.name}"</strong> không? Hành động này không thể hoàn tác.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setHolidayToDelete(null); }}
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
