'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { gasRequest } from '@/lib/gasApi';
import {
  Layers,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Tag,
  ToggleLeft,
  ToggleRight,
  Edit,
  CheckCircle,
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

interface LevelItem {
  id: string;
  name: string;
}

interface GroupItem {
  id: string;
  khoiId: string;
  khoiName: string;
  name: string;
  autoRenew: boolean;
}

export default function ClassGroupsPage() {
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
  const [activeTab, setActiveTab] = useState<'KHOI' | 'NHOM'>('KHOI');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Nhóm lớp' }
    ]);
  }, [setBreadcrumbs]);

  // Data list states
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // SidePanel States
  const [showAddLevelPanel, setShowAddLevelPanel] = useState(false);
  const [showEditLevelPanel, setShowEditLevelPanel] = useState(false);
  const [showLevelDetailPanel, setShowLevelDetailPanel] = useState(false);
  const [showAddGroupPanel, setShowAddGroupPanel] = useState(false);
  const [showEditGroupPanel, setShowEditGroupPanel] = useState(false);
  const [showGroupDetailPanel, setShowGroupDetailPanel] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<LevelItem | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [targetLevelId, setTargetLevelId] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Toast / Modal / Blocker states
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'khoiLop' | 'nhomLop'>('khoiLop');
  const [itemToDelete, setItemToDelete] = useState<{ id: string; name: string } | null>(null);

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

  const fetchData = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';

      const res = await gasRequest<any>({
        sheet: 'ClassGroup',
        action: 'FETCH_ALL',
        loginEmail: email,
        signal,
      });

      if (res.success && res.data) {
        const { khoiLop, nhomLop } = res.data;
        if (Array.isArray(khoiLop)) {
          setLevels(khoiLop.map((item: any) => ({ id: String(item[0] || ''), name: String(item[1] || '') })));
        } else {
          setLevels([]);
        }

        if (Array.isArray(nhomLop)) {
          setGroups(
            nhomLop.map((item: any) => ({
              id: String(item[0] || ''),
              khoiId: String(item[1] || ''),
              khoiName: String(item[2] || ''),
              name: String(item[3] || ''),
              autoRenew: !!item[4],
            }))
          );
        } else {
          setGroups([]);
        }
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching class groups:', e);
      setLoading(false);
    }
  }, [user, getSignal]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  // Block Level Handlers
  const handleOpenAddLevel = () => {
    setName('');
    setShowAddLevelPanel(true);
  };

  const handleOpenEditLevel = (level: LevelItem) => {
    setSelectedLevel(level);
    setName(level.name);
    setShowEditLevelPanel(true);
  };

  const submitAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      const email = user?.email || '';

      const res = await gasRequest({
        sheet: 'ClassGroup',
        action: 'INSERT',
        loginEmail: email,
        data: {
          id: generateID('KL'),
          type: 'khoiLop',
          name,
        },
      });

      if (res.success) {
        triggerSuccess(res.message || 'Thêm khối lớp thành công!');
        setShowAddLevelPanel(false);
        fetchData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEditLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLevel || !name.trim()) return;

    try {
      setSubmitting(true);
      const email = user?.email || '';

      const res = await gasRequest({
        sheet: 'ClassGroup',
        action: 'UPDATE',
        loginEmail: email,
        data: {
          type: 'khoiLop',
          id: selectedLevel.id,
          name,
        },
      });

      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật khối lớp thành công!');
        setShowEditLevelPanel(false);
        fetchData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLevel = (id: string, name: string) => {
    setDeleteType('khoiLop');
    setItemToDelete({ id, name });
    setShowDeleteModal(true);
  };

  // Group Handlers
  const handleOpenAddGroup = () => {
    setName('');
    setTargetLevelId(levels[0]?.id || '');
    setAutoRenew(false);
    setShowAddGroupPanel(true);
  };

  const handleOpenEditGroup = (group: GroupItem) => {
    setSelectedGroup(group);
    setName(group.name);
    setTargetLevelId(group.khoiId);
    setAutoRenew(group.autoRenew);
    setShowEditGroupPanel(true);
  };

  const submitAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !targetLevelId) return;
    try {
      setSubmitting(true);
      const email = user?.email || '';

      const res = await gasRequest({
        sheet: 'ClassGroup',
        action: 'INSERT',
        loginEmail: email,
        data: {
          id: generateID('NH'),
          type: 'nhomLop',
          name,
          khoiLopId: targetLevelId,
          autoRenew,
        },
      });

      if (res.success) {
        triggerSuccess(res.message || 'Thêm nhóm lớp thành công!');
        setShowAddGroupPanel(false);
        fetchData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !name.trim() || !targetLevelId) return;

    try {
      setSubmitting(true);
      const email = user?.email || '';

      const res = await gasRequest({
        sheet: 'ClassGroup',
        action: 'UPDATE',
        loginEmail: email,
        data: {
          type: 'nhomLop',
          id: selectedGroup.id,
          name,
          khoiLopId: targetLevelId,
          autoRenew,
        },
      });

      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật nhóm lớp thành công!');
        setShowEditGroupPanel(false);
        fetchData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = (id: string, name: string) => {
    setDeleteType('nhomLop');
    setItemToDelete({ id, name });
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const email = user?.email || '';

      const res = await gasRequest({
        sheet: 'ClassGroup',
        action: 'DELETE',
        loginEmail: email,
        data: {
          type: deleteType,
          id: itemToDelete.id,
        },
      });

      if (res.success) {
        triggerSuccess(res.message || (deleteType === 'khoiLop' ? 'Xóa khối lớp thành công!' : 'Xóa nhóm lớp thành công!'));
        fetchData();
      } else {
        alert('Có lỗi xảy ra: ' + res.message);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối.');
    } finally {
      setSubmitting(false);
      setItemToDelete(null);
    }
  };

  // Search filter
  const filteredLevels = levels.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.khoiName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort lists using Vietnamese rules
  const sortedLevels = [...filteredLevels].sort((a, b) => compareVietnameseNames(a.name, b.name));
  const sortedGroups = [...filteredGroups].sort((a, b) => compareVietnameseNames(a.name, b.name));

  // Pagination for Levels
  const {
    paginatedData: paginatedLevels,
    currentPage: currentLevelPage,
    setCurrentPage: setCurrentLevelPage,
    totalPages: totalLevelPages,
    startIndex: startLevelIndex,
    itemsPerPage: levelItemsPerPage,
    getPageNumbers: getLevelPageNumbers,
  } = usePagination(sortedLevels, 10, [searchQuery, activeTab]);

  // Pagination for Groups
  const {
    paginatedData: paginatedGroups,
    currentPage: currentGroupPage,
    setCurrentPage: setCurrentGroupPage,
    totalPages: totalGroupPages,
    startIndex: startGroupIndex,
    itemsPerPage: groupItemsPerPage,
    getPageNumbers: getGroupPageNumbers,
  } = usePagination(sortedGroups, 10, [searchQuery, activeTab]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Layers size={28} className="text-[#21398A]" />
            <span>Khối & Nhóm Lớp</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Quản lý sơ đồ học tập của trung tâm bao gồm phân cấp khối học (Levels) và định danh nhóm lớp (Class Groups).
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="tht-btn-outline"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại danh sách</span>
          </button>

          <button
            onClick={() => {
              if (checkPermission('perm_settings_add')) {
                if (activeTab === 'KHOI') handleOpenAddLevel();
                else handleOpenAddGroup();
              }
            }}
            className="tht-btn-primary"
          >
            <Plus size={16} />
            <span>{activeTab === 'KHOI' ? 'Thêm khối lớp mới' : 'Thêm nhóm lớp mới'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Widget */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
            <Layers size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng khối lớp</span>
            <span className="tht-kpi-value">{loading ? '...' : <AnimatedNumber value={levels.length} />}</span>
          </div>
        </div>

        <div className="tht-kpi-card tht-kpi-card-left group">
          <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
            <Tag size={24} />
          </div>
          <div>
            <span className="tht-kpi-label">Tổng nhóm lớp</span>
            <span className="tht-kpi-value">{loading ? '...' : <AnimatedNumber value={groups.length} />}</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Tabs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
        {/* Tabs Filter */}
        <div className="flex flex-wrap gap-2.5 pb-4 border-b border-slate-100">
          <button
            onClick={() => {
              setActiveTab('KHOI');
              setSearchQuery('');
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-[0.97]
              ${activeTab === 'KHOI'
                ? 'bg-[#21398A] text-white shadow-md shadow-[#21398a]/20 scale-105'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }
            `}
          >
            Danh sách Khối lớp
          </button>

          <button
            onClick={() => {
              setActiveTab('NHOM');
              setSearchQuery('');
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer active:scale-[0.97]
              ${activeTab === 'NHOM'
                ? 'bg-[#21398A] text-white shadow-md shadow-[#21398a]/20 scale-105'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
              }
            `}
          >
            Danh sách Nhóm lớp
          </button>
        </div>

        {/* Search controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row flex-1 gap-3 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'KHOI' ? 'Tìm kiếm theo Tên khối lớp...' : 'Tìm kiếm theo Tên nhóm hoặc Khối lớp trực thuộc...'}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] focus:ring-4 focus:ring-[#21398A]/5 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-500 font-semibold bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 self-start lg:self-auto">
            {activeTab === 'KHOI' ? <Layers size={16} className="text-[#21398A]" /> : <Tag size={16} className="text-[#21398A]" />}
            <span>Tìm thấy: <strong className="text-slate-800">{activeTab === 'KHOI' ? filteredLevels.length : filteredGroups.length}</strong> danh mục</span>
          </div>
        </div>
      </div>

      {/* Tables Grid Wrapper */}
      <div className="tht-table-container">
        {loading ? (
          <div className="tht-loading-state">
            <RefreshCw size={24} className="tht-loading-spinner" />
            <span>Đang tải dữ liệu...</span>
          </div>
        ) : activeTab === 'KHOI' ? (
          /* LEVELS DATA GRID TABLE */
          filteredLevels.length === 0 ? (
            <div className="tht-empty-state">
              <Layers size={48} className="tht-empty-icon" />
              <span>Không tìm thấy khối lớp phù hợp.</span>
            </div>
          ) : (
            <>
              <div className="tht-table-wrapper">
                <table className="tht-table">
                  <thead className="tht-table-thead">
                    <tr>
                      <th className="tht-table-th text-center">Tên khối lớp</th>
                      <th className="tht-table-th text-center">Nhóm lớp trực thuộc</th>
                      <th className="tht-table-th text-center w-40">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="tht-table-tbody">
                    {paginatedLevels.map((lvl) => {
                      const groupCount = groups.filter((g) => g.khoiId === lvl.id).length;
                      return (
                        <tr
                          key={lvl.id}
                          className="tht-table-tr cursor-pointer"
                          onClick={() => {
                            setSelectedLevel(lvl);
                            setShowLevelDetailPanel(true);
                          }}
                        >
                          <td className="tht-table-td text-center font-bold text-slate-800">
                            {lvl.name}
                          </td>
                          <td className="tht-table-td text-center font-semibold text-slate-600">
                            Gồm <strong className="text-[#21398A]">{groupCount}</strong> nhóm lớp
                          </td>
                          <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => {
                                  setSelectedLevel(lvl);
                                  setShowLevelDetailPanel(true);
                                }}
                                className="tht-text-action-btn tht-text-action-btn-gray"
                              >
                                <Eye size={14} />
                                <span>Chi tiết</span>
                              </button>
                              {(isAdmin || userPerms['perm_settings_edit']) && (
                                <button
                                  onClick={() => {
                                    handleOpenEditLevel(lvl);
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
                                    handleDeleteLevel(lvl.id, lvl.name);
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

              {/* Levels Pagination */}
              {totalLevelPages > 1 && (
                <div className="tht-pagination-container">
                  <div className="tht-pagination-info">
                    Hiển thị từ <span>{startLevelIndex + 1}</span> đến{' '}
                    <span>
                      {Math.min(startLevelIndex + levelItemsPerPage, sortedLevels.length)}
                    </span>{' '}
                    trong tổng số <span>{sortedLevels.length}</span> khối lớp
                  </div>

                  <div className="tht-pagination-list">
                    <button
                      onClick={() => setCurrentLevelPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentLevelPage === 1}
                      className="tht-pagination-btn"
                    >
                      Trước
                    </button>
                    {getLevelPageNumbers().map((page, index) => {
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
                          onClick={() => setCurrentLevelPage(Number(page))}
                          className={`tht-pagination-btn tht-pagination-num ${currentLevelPage === page ? 'tht-pagination-num-active' : ''
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentLevelPage((prev) => Math.min(prev + 1, totalLevelPages))}
                      disabled={currentLevelPage === totalLevelPages}
                      className="tht-pagination-btn"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          /* GROUPS DATA GRID TABLE */
          filteredGroups.length === 0 ? (
            <div className="tht-empty-state">
              <Tag size={48} className="tht-empty-icon" />
              <span>Không tìm thấy nhóm lớp phù hợp.</span>
            </div>
          ) : (
            <>
              <div className="tht-table-wrapper">
                <table className="tht-table">
                  <thead className="tht-table-thead">
                    <tr>
                      <th className="tht-table-th text-center">Tên nhóm lớp</th>
                      <th className="tht-table-th text-center">Thuộc Khối lớp</th>
                      <th className="tht-table-th text-center">Tự động gia hạn</th>
                      <th className="tht-table-th text-center w-40">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="tht-table-tbody">
                    {paginatedGroups.map((grp) => (
                      <tr
                        key={grp.id}
                        className="tht-table-tr cursor-pointer"
                        onClick={() => {
                          setSelectedGroup(grp);
                          setShowGroupDetailPanel(true);
                        }}
                      >
                        <td className="tht-table-td text-center font-bold text-slate-800">
                          {grp.name}
                        </td>
                        <td className="tht-table-td text-center">
                          <span className="px-2.5 py-1 bg-blue-50 text-[#21398A] font-extrabold text-[10px] rounded-lg border border-blue-100/50 uppercase tracking-wider">
                            {grp.khoiName || 'Khối khác'}
                          </span>
                        </td>
                        <td className="tht-table-td text-center">
                          {grp.autoRenew ? (
                            <span className="tht-badge tht-badge-success text-[10px]">
                              BẬT
                            </span>
                          ) : (
                            <span className="tht-badge tht-badge-zinc text-[10px]">
                              TẮT
                            </span>
                          )}
                        </td>
                        <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedGroup(grp);
                                setShowGroupDetailPanel(true);
                              }}
                              className="tht-text-action-btn tht-text-action-btn-gray"
                            >
                              <Eye size={14} />
                              <span>Chi tiết</span>
                            </button>
                            {(isAdmin || userPerms['perm_settings_edit']) && (
                              <button
                                onClick={() => {
                                  handleOpenEditGroup(grp);
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
                                  handleDeleteGroup(grp.id, grp.name);
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

              {/* Groups Pagination */}
              {totalGroupPages > 1 && (
                <div className="tht-pagination-container">
                  <div className="tht-pagination-info">
                    Hiển thị từ <span>{startGroupIndex + 1}</span> đến{' '}
                    <span>
                      {Math.min(startGroupIndex + groupItemsPerPage, sortedGroups.length)}
                    </span>{' '}
                    trong tổng số <span>{sortedGroups.length}</span> nhóm lớp
                  </div>

                  <div className="tht-pagination-list">
                    <button
                      onClick={() => setCurrentGroupPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentGroupPage === 1}
                      className="tht-pagination-btn"
                    >
                      Trước
                    </button>
                    {getGroupPageNumbers().map((page, index) => {
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
                          onClick={() => setCurrentGroupPage(Number(page))}
                          className={`tht-pagination-btn tht-pagination-num ${currentGroupPage === page ? 'tht-pagination-num-active' : ''
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentGroupPage((prev) => Math.min(prev + 1, totalGroupPages))}
                      disabled={currentGroupPage === totalGroupPages}
                      className="tht-pagination-btn"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* SidePanel Add Level Modal */}
      {showAddLevelPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Thêm khối lớp mới</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddLevelPanel(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="add-level-form" onSubmit={submitAddLevel} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên khối lớp</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Khối 1, Khối 2"
                    className="tht-input"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAddLevelPanel(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="add-level-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? 'Đang tạo...' : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* SidePanel Edit Level Modal */}
      {showEditLevelPanel && selectedLevel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Cập nhật khối lớp</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditLevelPanel(false);
                    setSelectedLevel(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="edit-level-form" onSubmit={submitEditLevel} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Tên khối lớp</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Khối 1"
                    className="tht-input"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditLevelPanel(false);
                    setSelectedLevel(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="edit-level-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? 'Đang lưu...' : 'Cập nhật thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* SidePanel Add Group Modal */}
      {showAddGroupPanel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Plus size={20} /></span>
                  <span>Thêm nhóm lớp mới</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddGroupPanel(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="add-group-form" onSubmit={submitAddGroup} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Thuộc Khối lớp</label>
                  <select
                    value={targetLevelId}
                    onChange={(e) => setTargetLevelId(e.target.value)}
                    required
                    className="tht-select"
                  >
                    <option value="">-- Chọn Khối lớp --</option>
                    {levels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Tên nhóm lớp</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Nhóm A, Nhóm học tập"
                    className="tht-input"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Tự động gia hạn khóa học</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Tự động kích hoạt khóa mới khi kết thúc</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRenew(!autoRenew)}
                    className={`focus:outline-none transition-colors ${autoRenew ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {autoRenew ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowAddGroupPanel(false)}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="add-group-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? 'Đang tạo...' : 'Lưu thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* SidePanel Edit Group Modal */}
      {showEditGroupPanel && selectedGroup && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Cập nhật nhóm lớp</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditGroupPanel(false);
                    setSelectedGroup(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <form id="edit-group-form" onSubmit={submitEditGroup} className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Thuộc Khối lớp</label>
                  <select
                    value={targetLevelId}
                    onChange={(e) => setTargetLevelId(e.target.value)}
                    required
                    className="tht-select"
                  >
                    <option value="">-- Chọn Khối lớp --</option>
                    {levels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Tên nhóm lớp</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Nhóm A"
                    className="tht-input"
                  />
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Tự động gia hạn khóa học</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Tự động kích hoạt khóa mới khi kết thúc</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRenew(!autoRenew)}
                    className={`focus:outline-none transition-colors ${autoRenew ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {autoRenew ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
              </form>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditGroupPanel(false);
                    setSelectedGroup(null);
                  }}
                  disabled={submitting}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="edit-group-form"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 disabled:opacity-70"
                >
                  {submitting ? 'Đang lưu...' : 'Cập nhật thông tin'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Level Modal */}
      {showLevelDetailPanel && selectedLevel && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Layers size={20} /></span>
                  <span>Chi tiết Khối lớp</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLevelDetailPanel(false);
                    setSelectedLevel(null);
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
                      <Layers size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedLevel.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin Khối lớp</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Tên khối</span>
                      <p className="text-sm font-bold text-slate-700">{selectedLevel.name}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Số lượng nhóm lớp trực thuộc</span>
                      <p className="text-sm font-bold text-slate-700">
                        {groups.filter((g) => g.khoiId === selectedLevel.id).length} nhóm lớp
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowLevelDetailPanel(false);
                    setSelectedLevel(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkPermission('perm_settings_edit')) {
                      setShowLevelDetailPanel(false);
                      handleOpenEditLevel(selectedLevel);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa Khối lớp</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Group Modal */}
      {showGroupDetailPanel && selectedGroup && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Tag size={20} /></span>
                  <span>Chi tiết Nhóm lớp</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupDetailPanel(false);
                    setSelectedGroup(null);
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
                      <Tag size={24} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-800">{selectedGroup.name}</h4>
                      <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Thông tin Nhóm lớp</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Chi tiết thuộc tính</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Tên nhóm lớp</span>
                      <p className="text-sm font-bold text-slate-700">{selectedGroup.name}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1">
                      <span className="text-xs font-semibold text-slate-400">Thuộc Khối lớp</span>
                      <p className="text-sm font-bold text-slate-700">{selectedGroup.khoiName || 'Khối khác'}</p>
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-slate-100 shadow-sm space-y-1 md:col-span-2">
                      <span className="text-xs font-semibold text-slate-400">Tự động gia hạn</span>
                      <p className="text-sm font-bold text-slate-700">{selectedGroup.autoRenew ? 'Có (Kích hoạt khóa mới)' : 'Không'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setShowGroupDetailPanel(false);
                    setSelectedGroup(null);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (checkPermission('perm_settings_edit')) {
                      setShowGroupDetailPanel(false);
                      handleOpenEditGroup(selectedGroup);
                    }
                  }}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5"
                >
                  <Edit size={16} />
                  <span>Chỉnh sửa Nhóm lớp</span>
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
      {showDeleteModal && itemToDelete && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-50 text-red-500 rounded-xl shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Xác nhận xóa {deleteType === 'khoiLop' ? 'khối lớp' : 'nhóm lớp'}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Bạn có chắc chắn muốn xóa <strong className="text-slate-700">"{itemToDelete.name}"</strong> không?
                    {deleteType === 'khoiLop' && <span className="block mt-1 text-amber-600"> Hầu hết các nhóm lớp liên quan có thể bị ảnh hưởng!</span>}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setItemToDelete(null); }}
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
