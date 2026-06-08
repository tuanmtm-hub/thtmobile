'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import { useTeachersData } from '@/hooks/useGasData';
import Link from 'next/link';
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  Shield,
  Briefcase,
  Edit,
  X,
  UserPlus,
  Trash2,
  Eye
} from 'lucide-react';
import AnimatedNumber from '@/components/AnimatedNumber';


interface TeacherItem {
  id: string;
  name: string;
  email: string;
  status: string;
  role: string;
  department: string;
  phone: string;
  password?: string;
  permissions?: Record<string, boolean>;
  avatarUrl?: string;
}

export default function TeachersPage() {
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
  const { teachers, isLoading, refresh } = useTeachersData(user?.email || '');
  const [localLoading, setLocalLoading] = useState(false);
  const loading = isLoading || localLoading;
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'LOCKED'
  const [activeView, setActiveView] = useState<'list' | 'detail' | 'add' | 'edit'>('list');

  // Edit Modal/View States
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('123');
  const [editRole, setEditRole] = useState('Giáo viên');
  const [editPhone, setEditPhone] = useState('');
  const [editDept, setEditDept] = useState('Tiếng Anh');
  const [editStatus, setEditStatus] = useState('Đang hoạt động');
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editAvatarUrl, setEditAvatarUrl] = useState('');

  // Add View States
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('123');
  const [addRole, setAddRole] = useState('Giáo viên');
  const [addPhone, setAddPhone] = useState('');
  const [addDept, setAddDept] = useState('Tiếng Anh');
  const [addStatus, setAddStatus] = useState('Đang hoạt động');
  const [addPerms, setAddPerms] = useState<Record<string, boolean>>({});
  const [addAvatarUrl, setAddAvatarUrl] = useState('');

  useEffect(() => {
    if (activeView === 'list') {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Giáo viên' }
      ]);
    } else if (activeView === 'add') {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Giáo viên', onClick: () => { setActiveView('list'); setSelectedTeacher(null); } },
        { label: 'Thêm giáo viên mới' }
      ]);
    } else if (activeView === 'edit') {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Giáo viên', onClick: () => { setActiveView('list'); setSelectedTeacher(null); } },
        { label: selectedTeacher ? `Chỉnh sửa: ${selectedTeacher.name}` : 'Chỉnh sửa giáo viên' }
      ]);
    } else if (activeView === 'detail' && selectedTeacher) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Giáo viên', onClick: () => { setActiveView('list'); setSelectedTeacher(null); } },
        { label: selectedTeacher.name }
      ]);
    }
  }, [activeView, selectedTeacher, setBreadcrumbs]);

  // Set mounted on client side to prevent SSR hydration errors
  const [mounted, setMounted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherItem | null>(null);

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

  useEffect(() => {
    setMounted(true);
  }, []);




  const handleOpenAddModal = () => {
    if (!checkPermission('perm_user_add')) return;
    setAddName('');
    setAddEmail('');
    setAddPassword('123');
    setAddRole('Giáo viên');
    setAddPhone('');
    setAddDept('Tiếng Anh');
    setAddStatus('Đang hoạt động');
    setAddAvatarUrl('');
    setAddPerms({
      perm_teacher_group: true,
      perm_student_eval: true,
      perm_attendance_today: true,
    });
    setActiveView('add');
  };

  const handleAddPermToggle = (permKey: string) => {
    setAddPerms((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
      perm_admin_group: false,
      perm_consultant_group: false,
      perm_academic_group: false,
      perm_teacher_group: false,
    }));
  };

  const handleAddAllRowToggle = (permKeys: string[], checked: boolean) => {
    setAddPerms((prev) => {
      const next = { ...prev };
      permKeys.forEach((key) => {
        next[key] = checked;
      });
      next.perm_admin_group = false;
      next.perm_consultant_group = false;
      next.perm_academic_group = false;
      next.perm_teacher_group = false;
      return next;
    });
  };

  const handleAddGroupCheckboxChange = (groupKey: string, checked: boolean) => {
    const mappings: Record<string, string[]> = {
      perm_admin_group: [
        'perm_user_add', 'perm_user_edit', 'perm_user_delete',
        'perm_kh_add', 'perm_kh_edit', 'perm_kh_delete',
        'perm_class_add', 'perm_class_edit', 'perm_class_delete',
        'perm_settings_add', 'perm_settings_edit', 'perm_settings_delete',
        'perm_student_eval', 'perm_student_email', 'perm_student_note', 'perm_student_roll_back_trial', 'perm_student_convert_official', 'perm_student_transfer', 'perm_student_stop',
        'perm_class_add_student', 'perm_class_delete_attendance', 'perm_class_send_email', 'perm_class_send_report', 'perm_class_clone',
        'perm_attendance_today', 'perm_schedule_change_teacher', 'perm_schedule_change_oa',
        'perm_revenue_create_debt', 'perm_revenue_collect_debt', 'perm_revenue_export_notice', 'perm_revenue_delete_debt', 'perm_revenue_collect_meal'
      ],
      perm_consultant_group: [
        'perm_class_add', 'perm_class_edit', 'perm_kh_add', 'perm_kh_edit',
        'perm_student_roll_back_trial', 'perm_student_convert_official', 'perm_student_transfer', 'perm_student_stop',
        'perm_class_add_student', 'perm_class_send_email', 'perm_class_send_report', 'perm_class_clone',
        'perm_settings_add', 'perm_settings_edit',
        'perm_revenue_create_debt', 'perm_revenue_collect_debt', 'perm_revenue_export_notice', 'perm_revenue_delete_debt', 'perm_revenue_collect_meal'
      ],
      perm_academic_group: [
        'perm_student_eval', 'perm_class_add', 'perm_class_edit', 'perm_class_delete_attendance', 'perm_class_clone',
        'perm_attendance_today', 'perm_schedule_change_teacher', 'perm_schedule_change_oa',
        'perm_settings_add', 'perm_settings_edit'
      ],
      perm_teacher_group: [
        'perm_student_eval', 'perm_attendance_today'
      ]
    };

    setAddPerms((prev) => {
      const next = { ...prev };
      next.perm_admin_group = false;
      next.perm_consultant_group = false;
      next.perm_academic_group = false;
      next.perm_teacher_group = false;
      next[groupKey] = checked;

      if (checked) {
        Object.values(mappings).flat().forEach((id) => {
          next[id] = false;
        });
        mappings[groupKey].forEach((id) => {
          next[id] = true;
        });
      }
      return next;
    });
  };

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim()) return;

    try {
      setLocalLoading(true);
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/users',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('GV'),
            name: addName,
            email: addEmail,
            password: addPassword,
            phoneuser: addPhone,
            role: addRole,
            department: addDept,
            status: addStatus,
            permissions: addPerms,
            avatarUrl: addAvatarUrl,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thêm giáo viên mới thành công.');
        setActiveView('list');
        fetchTeachers(); // tải lại danh sách
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setLocalLoading(false);
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (teacher: TeacherItem) => {
    if (!checkPermission('perm_user_edit')) return;
    setSelectedTeacher(teacher);
    setEditName(teacher.name);
    setEditEmail(teacher.email || '');
    setEditPassword(teacher.password || '123');
    setEditRole(teacher.role || 'Giáo viên');
    setEditPhone(teacher.phone || '');
    setEditDept(teacher.department || 'Tiếng Anh');
    setEditStatus(teacher.status || 'Đang hoạt động');
    setEditPerms(teacher.permissions || {});
    setEditAvatarUrl(teacher.avatarUrl || '');
    setActiveView('edit');
  };

  const handleOpenDetailModal = (teacher: TeacherItem) => {
    setSelectedTeacher(teacher);
    setActiveView('detail');
  };

  const handlePermToggle = (permKey: string) => {
    setEditPerms((prev) => ({
      ...prev,
      [permKey]: !prev[permKey],
      perm_admin_group: false,
      perm_consultant_group: false,
      perm_academic_group: false,
      perm_teacher_group: false,
    }));
  };

  const handleAllRowToggle = (permKeys: string[], checked: boolean) => {
    setEditPerms((prev) => {
      const next = { ...prev };
      permKeys.forEach((key) => {
        next[key] = checked;
      });
      next.perm_admin_group = false;
      next.perm_consultant_group = false;
      next.perm_academic_group = false;
      next.perm_teacher_group = false;
      return next;
    });
  };

  const handleGroupCheckboxChange = (groupKey: string, checked: boolean) => {
    const mappings: Record<string, string[]> = {
      perm_admin_group: [
        'perm_user_add', 'perm_user_edit', 'perm_user_delete',
        'perm_kh_add', 'perm_kh_edit', 'perm_kh_delete',
        'perm_class_add', 'perm_class_edit', 'perm_class_delete',
        'perm_settings_add', 'perm_settings_edit', 'perm_settings_delete',
        'perm_student_eval', 'perm_student_email', 'perm_student_note', 'perm_student_roll_back_trial', 'perm_student_convert_official', 'perm_student_transfer', 'perm_student_stop',
        'perm_class_add_student', 'perm_class_delete_attendance', 'perm_class_send_email', 'perm_class_send_report', 'perm_class_clone',
        'perm_attendance_today', 'perm_schedule_change_teacher', 'perm_schedule_change_oa',
        'perm_revenue_create_debt', 'perm_revenue_collect_debt', 'perm_revenue_export_notice', 'perm_revenue_delete_debt', 'perm_revenue_collect_meal'
      ],
      perm_consultant_group: [
        'perm_class_add', 'perm_class_edit', 'perm_kh_add', 'perm_kh_edit',
        'perm_student_roll_back_trial', 'perm_student_convert_official', 'perm_student_transfer', 'perm_student_stop',
        'perm_class_add_student', 'perm_class_send_email', 'perm_class_send_report', 'perm_class_clone',
        'perm_settings_add', 'perm_settings_edit',
        'perm_revenue_create_debt', 'perm_revenue_collect_debt', 'perm_revenue_export_notice', 'perm_revenue_delete_debt', 'perm_revenue_collect_meal'
      ],
      perm_academic_group: [
        'perm_student_eval', 'perm_class_add', 'perm_class_edit', 'perm_class_delete_attendance', 'perm_class_clone',
        'perm_attendance_today', 'perm_schedule_change_teacher', 'perm_schedule_change_oa',
        'perm_settings_add', 'perm_settings_edit'
      ],
      perm_teacher_group: [
        'perm_student_eval', 'perm_attendance_today'
      ]
    };

    setEditPerms((prev) => {
      const next = { ...prev };

      // Update group states
      next.perm_admin_group = false;
      next.perm_consultant_group = false;
      next.perm_academic_group = false;
      next.perm_teacher_group = false;

      next[groupKey] = checked;

      if (checked) {
        // Clear existing permissions that belong to other groups
        Object.values(mappings).flat().forEach((id) => {
          next[id] = false;
        });
        // Set permissions for this group
        mappings[groupKey].forEach((id) => {
          next[id] = true;
        });
      }
      return next;
    });
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacher || !editName.trim()) return;

    try {
      setLocalLoading(true);
      setSubmitting(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/users',
          method: 'PUT',
          loginEmail: user?.email || '',
          data: {
            id: selectedTeacher.id,
            name: editName,
            email: editEmail,
            password: editPassword,
            phoneuser: editPhone,
            role: editRole,
            department: editDept,
            status: editStatus,
            permissions: editPerms,
            avatarUrl: editAvatarUrl,
          },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật giáo viên thành công.');
        setActiveView('list');
        setSelectedTeacher(null);
        fetchTeachers(); // reload list
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setLocalLoading(false);
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    try {
      setShowDeleteModal(false);
      setSubmitting(true);
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/users',
          method: 'DELETE',
          loginEmail: email,
          data: { id: teacherToDelete.id },
        }),
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Xóa giáo viên thành công.');
        fetchTeachers(); // reload list
      } else {
        alert(res.message || 'Có lỗi xảy ra.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
      setTeacherToDelete(null);
    }
  };

  const fetchTeachers = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (user?.email) {
      fetchTeachers();
    }
  }, [user?.email, fetchTeachers]);

  // Keep selectedTeacher in sync with updated teachers list from SWR cache
  useEffect(() => {
    if (selectedTeacher) {
      const updated = teachers.find(t => t.id === selectedTeacher.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedTeacher)) {
        setSelectedTeacher(updated);
      }
    }
  }, [teachers, selectedTeacher]);

  // Statistics
  const totalCount = teachers.length;
  const activeCount = teachers.filter((t) => t.status === 'Đang hoạt động').length;
  const lockedCount = totalCount - activeCount;

  // Filtered teachers
  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(t.phone || '').includes(searchQuery);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && t.status === 'Đang hoạt động') ||
      (statusFilter === 'LOCKED' && t.status !== 'Đang hoạt động');

    return matchesSearch && matchesStatus;
  });

  // Pagination (shared hook - 10 dòng/trang)
  const {
    paginatedData: paginatedTeachers,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(filteredTeachers, 10, [searchQuery, statusFilter]);

  return (
    <div className="space-y-8 animate-fade-in">
      {activeView === 'list' && (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Danh Sách Giáo Viên</h1>
              <p className="text-slate-500 mt-1">
                Quản lý và theo dõi thông tin liên hệ, bộ phận của giáo viên và liên kết xem giờ dạy thực tế.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 self-start">
              <button
                onClick={fetchTeachers}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#21398A] hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-[0.98]"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>Tải lại danh sách</span>
              </button>

              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] rounded-xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
              >
                <UserPlus size={16} />
                <span>Thêm giáo viên mới</span>
              </button>
            </div>
          </div>

          {/* Summary Stats Widgets */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
                <Users size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Tổng giáo viên</div>
                <div className="tht-kpi-value"><AnimatedNumber value={totalCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
                <CheckCircle size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Đang hoạt động</div>
                <div className="tht-kpi-value"><AnimatedNumber value={activeCount} /></div>
              </div>
            </div>

            <div className="tht-kpi-card tht-kpi-card-left group">
              <div className="tht-kpi-icon-wrapper tht-kpi-icon-rose">
                <XCircle size={24} />
              </div>
              <div>
                <div className="tht-kpi-label">Tạm ngừng/Khóa</div>
                <div className="tht-kpi-value"><AnimatedNumber value={lockedCount} /></div>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar (with Integrated Tabs) */}
          <div className="tht-toolbar">
            {/* Tabs Filters */}
            <div className="tht-toolbar-tabs">
              {[
                { id: 'ALL', name: `Tất cả`, color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                { id: 'ACTIVE', name: `Đang hoạt động`, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { id: 'LOCKED', name: `Đã khóa`, color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' }
              ].map((tab) => {
                const isActive = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id as 'ALL' | 'ACTIVE' | 'LOCKED')}
                    className={`tht-tab-btn ${isActive ? 'tht-tab-btn-active' : tab.color}`}
                  >
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Controls Row */}
            <div className="tht-toolbar-controls">
              <div className="tht-toolbar-search">
                <div className="tht-search-wrapper">
                  <Search className="tht-search-icon" size={18} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm theo Tên giáo viên, Email, SĐT..."
                    className="tht-search-input"
                  />
                </div>
              </div>

              <div className="tht-found-count">
                <Users size={16} className="text-[#21398A]" />
                <span>Tìm thấy: <strong className="text-slate-800">{filteredTeachers.length}</strong> giáo viên</span>
              </div>
            </div>
          </div>

          {/* Teachers Data Grid */}
          <div className="tht-table-container">
            {loading ? (
              <div className="tht-loading-state">
                <RefreshCw size={24} className="tht-loading-spinner" />
                <span>Đang tải dữ liệu...</span>
              </div>
            ) : filteredTeachers.length === 0 ? (
              <div className="tht-empty-state">
                <Users size={48} className="tht-empty-icon" />
                <span>Không tìm thấy giáo viên nào khớp với bộ lọc hiện tại.</span>
              </div>
            ) : (
              <>
                <div className="tht-table-wrapper">
                  <table className="tht-table">
                    <thead className="tht-table-thead">
                      <tr>
                        <th className="tht-table-th">Giáo viên</th>
                        <th className="tht-table-th">Bộ phận</th>
                        <th className="tht-table-th">Email</th>
                        <th className="tht-table-th">Số điện thoại</th>
                        <th className="tht-table-th text-center">Trạng thái</th>
                        <th className="tht-table-th text-center">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="tht-table-tbody">
                      {paginatedTeachers.map((teacher) => {
                        const initials = teacher.name
                          .split(' ')
                          .map((n: string) => n[0])
                          .slice(-2)
                          .join('')
                          .toUpperCase();

                        const isActive = teacher.status === 'Đang hoạt động';

                        return (
                          <tr
                            key={teacher.id}
                            className="tht-table-tr group cursor-pointer"
                            onClick={() => handleOpenDetailModal(teacher)}
                          >
                            <td className="tht-table-td">
                              <div className="flex items-center gap-3">
                                {teacher.avatarUrl ? (
                                  <img
                                    src={teacher.avatarUrl}
                                    alt={teacher.name}
                                    className="w-9 h-9 rounded-full object-cover shadow-sm border border-slate-100"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#21398A] to-[#122258] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                    {initials}
                                  </div>
                                )}
                                <div>
                                  <span className="font-semibold text-slate-800 text-sm tracking-wide block">
                                    {teacher.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    {teacher.role}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="tht-table-td">
                              <span className="px-2.5 py-1 bg-blue-50 text-[#21398A] font-semibold text-xs rounded-lg border border-blue-100/50">
                                {teacher.department || 'English'}
                              </span>
                            </td>
                            <td className="tht-table-td">
                              {teacher.email ? (
                                <a
                                  href={`mailto:${teacher.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 hover:text-[#21398A] transition-colors font-medium text-slate-600"
                                >
                                  <Mail size={14} className="text-slate-400" />
                                  <span>{teacher.email}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Chưa có Email</span>
                              )}
                            </td>
                            <td className="tht-table-td">
                              {teacher.phone ? (
                                <a
                                  href={`tel:${teacher.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1.5 hover:text-[#21398A] transition-colors font-medium text-slate-600"
                                >
                                  <Phone size={14} className="text-slate-400" />
                                  <span>{teacher.phone}</span>
                                </a>
                              ) : (
                                <span className="text-slate-300 italic text-xs">Chưa có SĐT</span>
                              )}
                            </td>
                            <td className="tht-table-td text-center">
                              <span className={`tht-badge ${isActive ? 'tht-badge-success' : 'tht-badge-danger'}`}>
                                {isActive ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span>Đang hoạt động</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                    <span>Tạm ngừng/Khóa</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenDetailModal(teacher)}
                                  className="tht-text-action-btn tht-text-action-btn-gray"
                                >
                                  <Eye size={14} />
                                  <span>Chi tiết</span>
                                </button>
                                {(isAdmin || userPerms['perm_user_edit']) && (
                                  <button
                                    onClick={() => handleOpenEditModal(teacher)}
                                    className="tht-text-action-btn tht-text-action-btn-blue"
                                  >
                                    <Edit size={14} />
                                    <span>Sửa</span>
                                  </button>
                                )}
                                {(isAdmin || userPerms['perm_user_delete']) && (
                                  <button
                                    onClick={() => {
                                      setTeacherToDelete(teacher);
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

                {/* Pagination Controls using Reusable THT Pagination System */}
                {totalPages > 1 && (
                  <div className="tht-pagination-container">
                    <div className="tht-pagination-info">
                      Hiển thị từ <span>{startIndex + 1}</span> đến{' '}
                      <span>
                        {Math.min(startIndex + itemsPerPage, filteredTeachers.length)}
                      </span>{' '}
                      trong tổng số <span>{filteredTeachers.length}</span> giáo viên
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
        </>
      )}

      {activeView === 'detail' && selectedTeacher && (
        <div className="space-y-6 animate-fade-in text-slate-800">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-3xl font-extrabold text-[#21398A] tracking-tight">Hồ sơ Giáo viên</h1>
              <p className="text-slate-500 mt-1">
                Xem chi tiết thông tin và phân quyền hệ thống của giáo viên.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveView('list');
                  setSelectedTeacher(null);
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
              >
                Quay lại danh sách
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenEditModal(selectedTeacher);
                }}
                className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d60] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-2 cursor-pointer"
              >
                <Edit size={14} />
                <span>Chỉnh sửa & Phân quyền</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left side: Avatar + Contact Info */}
            <div className="md:col-span-1 space-y-6">
              <div className="flex flex-col items-center text-center py-6 bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                {/* Initials Avatar or Image */}
                {selectedTeacher.avatarUrl ? (
                  <img
                    src={selectedTeacher.avatarUrl}
                    alt={selectedTeacher.name}
                    className="w-24 h-24 rounded-full object-cover shadow-md border-4 border-slate-50"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#21398A] to-[#122258] text-white flex items-center justify-center font-extrabold text-3xl shadow-md border-4 border-slate-50">
                    {selectedTeacher.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(-2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}

                <h4 className="mt-4 text-xl font-extrabold text-slate-800 leading-tight">
                  {selectedTeacher.name}
                </h4>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1.5">
                  <Briefcase size={12} />
                  {selectedTeacher.role || 'Giáo viên'}
                </p>

                {/* Badges */}
                <div className="flex gap-2 mt-4 flex-wrap justify-center">
                  <span className="px-3 py-1 bg-blue-50 text-[#21398A] font-bold text-xs rounded-xl border border-blue-100/50">
                    {selectedTeacher.department || 'Tiếng Anh'}
                  </span>
                  <span className={`tht-badge ${selectedTeacher.status === 'Đang hoạt động' ? 'tht-badge-success' : 'tht-badge-danger'}`}>
                    {selectedTeacher.status === 'Đang hoạt động' ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Đang hoạt động</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        <span>Tạm ngừng/Khóa</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Profile Info Details List */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <span className="text-sm font-extrabold text-[#21398A] flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Users size={16} />
                  Thông tin liên hệ
                </span>

                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mã số ID</span>
                  <span className="text-sm font-bold text-[#21398A]">{selectedTeacher.id}</span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Mail size={12} className="text-slate-400" />
                    <span>Thư điện tử</span>
                  </span>
                  {selectedTeacher.email ? (
                    <a
                      href={`mailto:${selectedTeacher.email}`}
                      className="text-sm font-semibold text-slate-700 hover:text-[#21398A] transition-colors"
                    >
                      {selectedTeacher.email}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa cấu hình</span>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Phone size={12} className="text-slate-400" />
                    <span>Số điện thoại</span>
                  </span>
                  {selectedTeacher.phone ? (
                    <a
                      href={`tel:${selectedTeacher.phone}`}
                      className="text-sm font-semibold text-slate-700 hover:text-[#21398A] transition-colors"
                    >
                      {selectedTeacher.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa cấu hình</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Permissions */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <span className="text-sm font-extrabold text-[#21398A] flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Shield size={18} />
                  Phân quyền hệ thống
                </span>

                {/* 2.1 Quản lý theo nhóm */}
                <div className="space-y-2">
                  <span className="tht-input-label block">Quản lý theo nhóm</span>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { key: 'perm_admin_group', label: 'Quyền Quản trị viên' },
                      { key: 'perm_consultant_group', label: 'Quyền Tư vấn' },
                      { key: 'perm_academic_group', label: 'Quyền Học vụ' },
                      { key: 'perm_teacher_group', label: 'Quyền Giáo viên' },
                    ].map(g => (
                      <label key={g.key} className="flex items-center gap-2.5 bg-slate-50 px-3.5 py-3 rounded-xl border border-slate-200/80 transition-colors select-none opacity-80">
                        <input
                          type="checkbox"
                          checked={!!selectedTeacher.permissions?.[g.key]}
                          readOnly
                          onClick={(e) => e.preventDefault()}
                          className="w-4 h-4 rounded text-[#21398A] focus:ring-0 border-slate-300 cursor-default"
                        />
                        <span className="text-xs font-bold text-slate-600">{g.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* 2.2 Quản lý cơ bản */}
                <div className="space-y-2">
                  <span className="tht-input-label block">Quản lý cơ bản</span>
                  <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                          <th className="py-2.5 px-4">Quyền quản lý</th>
                          <th className="py-2.5 px-4 text-center">Thêm</th>
                          <th className="py-2.5 px-4 text-center">Sửa</th>
                          <th className="py-2.5 px-4 text-center">Xóa</th>
                          <th className="py-2.5 px-4 text-center">Tất cả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {[
                          { label: 'Giáo viên', keys: ['perm_user_add', 'perm_user_edit', 'perm_user_delete'] },
                          { label: 'Học sinh', keys: ['perm_kh_add', 'perm_kh_edit', 'perm_kh_delete'] },
                          { label: 'Lớp học', keys: ['perm_class_add', 'perm_class_edit', 'perm_class_delete'] },
                          { label: 'Cài đặt & TT Công ty', keys: ['perm_settings_add', 'perm_settings_edit', 'perm_settings_delete'] },
                        ].map((row, rIdx) => {
                          const isAllChecked = row.keys.every(k => selectedTeacher.permissions?.[k]);
                          return (
                            <tr key={rIdx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-4 font-bold">{row.label}</td>
                              {row.keys.map(k => (
                                <td key={k} className="py-2 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!selectedTeacher.permissions?.[k]}
                                    readOnly
                                    onClick={(e) => e.preventDefault()}
                                    className="w-4 h-4 rounded text-[#21398A] focus:ring-0 border-slate-300 cursor-default"
                                  />
                                </td>
                              ))}
                              <td className="py-2 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isAllChecked}
                                  readOnly
                                  onClick={(e) => e.preventDefault()}
                                  className="w-4 h-4 rounded text-[#21398A] focus:ring-0 border-slate-300 cursor-default"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2.3 Quản lý nâng cao/chuyên sâu */}
                <div className="space-y-2">
                  <span className="tht-input-label block">Quản lý chuyên sâu</span>
                  <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                          <th className="py-2.5 px-4 w-32">Phân hệ</th>
                          <th className="py-2.5 px-4">Chi tiết quyền hạn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {[
                          {
                            module: 'Học sinh',
                            perms: [
                              { key: 'perm_student_eval', label: 'Đánh giá' },
                              { key: 'perm_student_email', label: 'Email' },
                              { key: 'perm_student_note', label: 'Ghi chú' },
                              { key: 'perm_student_roll_back_trial', label: 'Hoàn tác học thử' },
                              { key: 'perm_student_convert_official', label: 'Chuyển chính thức' },
                              { key: 'perm_student_transfer', label: 'Chuyển lớp' },
                              { key: 'perm_student_approve_transfer_trial_esl', label: 'Duyệt ESL' },
                              { key: 'perm_student_approve_transfer_trial_efl', label: 'Duyệt EFL' },
                              { key: 'perm_student_stop', label: 'Dừng học' },
                            ]
                          },
                          {
                            module: 'Lớp học',
                            perms: [
                              { key: 'perm_class_add_student', label: 'Thêm HS vào lớp' },
                              { key: 'perm_class_delete_attendance', label: 'Xóa điểm danh' },
                              { key: 'perm_class_send_email', label: 'Gửi email lớp' },
                              { key: 'perm_class_send_report', label: 'Gửi báo cáo' },
                              { key: 'perm_class_clone', label: 'Clone lớp học' },
                            ]
                          },
                          {
                            module: 'Lịch biểu',
                            perms: [
                              { key: 'perm_attendance_today', label: 'Điểm danh' },
                              { key: 'perm_schedule_change_teacher', label: 'Đổi GV' },
                              { key: 'perm_schedule_change_oa', label: 'Đổi OA' },
                            ]
                          },
                          {
                            module: 'Tài chính',
                            perms: [
                              { key: 'perm_revenue_create_debt', label: 'Tạo công nợ học phí' },
                              { key: 'perm_revenue_collect_debt', label: 'Thu tiền nợ học phí' },
                              { key: 'perm_revenue_export_notice', label: 'Xuất phiếu thông báo nợ' },
                              { key: 'perm_revenue_delete_debt', label: 'Xóa công nợ' },
                              { key: 'perm_revenue_collect_meal', label: 'Thu tiền ăn' },
                            ]
                          }
                        ].map((m, mIdx) => (
                          <tr key={mIdx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-bold text-slate-800 bg-slate-50/20">{m.module}</td>
                            <td className="py-3 px-4">
                              <div className="flex flex-wrap gap-2.5">
                                {m.perms.map(p => (
                                  <label key={p.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50 transition-colors select-none opacity-85">
                                    <input
                                      type="checkbox"
                                      checked={!!selectedTeacher.permissions?.[p.key]}
                                      readOnly
                                      onClick={(e) => e.preventDefault()}
                                      className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-0 border-slate-300 cursor-default"
                                    />
                                    <span className="text-[11px] text-slate-500 font-bold">{p.label}</span>
                                  </label>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Teacher Form */}
      {activeView === 'edit' && selectedTeacher && (
        <div className="space-y-6 animate-fade-in text-slate-800">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-3xl font-extrabold text-[#21398A] tracking-tight">Chỉnh Sửa Giáo Viên</h1>
              <p className="text-slate-500 mt-1">
                Chỉnh sửa thông tin chi tiết và cập nhật phân quyền hệ thống cho giáo viên.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveView('detail');
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                form="edit-teacher-form"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d60] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-2 cursor-pointer"
              >
                {submitting && <RefreshCw size={16} className="animate-spin" />}
                <span>Cập nhật thông tin</span>
              </button>
            </div>
          </div>

          <form id="edit-teacher-form" onSubmit={handleUpdateTeacher} className="space-y-6">
            {/* PHẦN 1: THÔNG TIN CƠ BẢN */}
            <div className="info-section-card">
              <span className="section-card-title section-title-green">
                <Users size={18} />
                1. Thông tin người dùng
              </span>

              {/* Hàng 1: Họ tên, Email, Mật khẩu */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="tht-input-label">Email đăng nhập *</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="name@tht.edu.vn"
                    className="tht-input"
                    required
                  />
                </div>

                <div>
                  <label className="tht-input-label">Mật khẩu *</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="123"
                    className="tht-input"
                    required
                  />
                </div>
              </div>

              {/* Hàng 2: Chức vụ, Bộ phận, Số điện thoại, Trạng thái */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="tht-input-label">Chức vụ</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Giáo viên">Giáo viên</option>
                    <option value="Admin">Admin</option>
                    <option value="Quản trị viên">Quản trị viên</option>
                    <option value="Nhân viên">Nhân viên</option>
                    <option value="Trợ lý">Trợ lý</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Bộ phận</label>
                  <select
                    value={editDept}
                    onChange={(e) => setEditDept(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tư Vấn">Tư Vấn</option>
                    <option value="IT">IT</option>
                    <option value="Kế toán">Kế toán</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Số điện thoại</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="09XXXXXXXX"
                    className="tht-input"
                  />
                </div>

                <div>
                  <label className="tht-input-label">Trạng thái hoạt động</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm ngừng/Khóa">Tạm ngừng/Khóa</option>
                  </select>
                </div>
              </div>

              {/* Hàng 3: Link ảnh Avatar */}
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="tht-input-label">Link ảnh Avatar (Tùy chọn)</label>
                  <input
                    type="text"
                    value={editAvatarUrl}
                    onChange={(e) => setEditAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="tht-input"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 2: PHÂN QUYỀN HỆ THỐNG */}
            <div className="info-section-card">
              <span className="section-card-title section-title-purple">
                <Shield size={18} />
                2. Phân quyền hệ thống
              </span>

              {/* 2.1 Quản lý theo nhóm */}
              <div className="mb-6">
                <span className="tht-input-label mb-2.5">Quản lý theo nhóm</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'perm_admin_group', label: 'Quyền Quản trị viên' },
                    { key: 'perm_consultant_group', label: 'Quyền Tư vấn' },
                    { key: 'perm_academic_group', label: 'Quyền Học vụ' },
                    { key: 'perm_teacher_group', label: 'Quyền Giáo viên' },
                  ].map(g => (
                    <label key={g.key} className="flex items-center gap-2.5 bg-white px-3.5 py-3 rounded-xl border border-slate-200/80 hover:border-[#21398A]/50 transition-colors cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!editPerms[g.key]}
                        onChange={(e) => handleGroupCheckboxChange(g.key, e.target.checked)}
                        className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700">{g.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2.2 Quản lý cơ bản */}
              <div className="mb-6">
                <span className="tht-input-label mb-2.5">Quản lý cơ bản</span>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                        <th className="py-2.5 px-4">Quyền quản lý</th>
                        <th className="py-2.5 px-4 text-center">Thêm</th>
                        <th className="py-2.5 px-4 text-center">Sửa</th>
                        <th className="py-2.5 px-4 text-center">Xóa</th>
                        <th className="py-2.5 px-4 text-center">Tất cả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {[
                        { label: 'Giáo viên', keys: ['perm_user_add', 'perm_user_edit', 'perm_user_delete'] },
                        { label: 'Học sinh', keys: ['perm_kh_add', 'perm_kh_edit', 'perm_kh_delete'] },
                        { label: 'Lớp học', keys: ['perm_class_add', 'perm_class_edit', 'perm_class_delete'] },
                        { label: 'Cài đặt & TT Công ty', keys: ['perm_settings_add', 'perm_settings_edit', 'perm_settings_delete'] },
                      ].map((row, rIdx) => {
                        const isAllChecked = row.keys.every(k => editPerms[k]);
                        return (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-4 font-bold">{row.label}</td>
                            {row.keys.map(k => (
                              <td key={k} className="py-2 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!editPerms[k]}
                                  onChange={(e) => handlePermToggle(k)}
                                  className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300 cursor-pointer"
                                />
                              </td>
                            ))}
                            <td className="py-2 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isAllChecked}
                                onChange={(e) => handleAllRowToggle(row.keys, e.target.checked)}
                                className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2.3 Quản lý nâng cao/chuyên sâu */}
              <div>
                <span className="tht-input-label mb-2.5">Quản lý chuyên sâu</span>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                        <th className="py-2.5 px-4 w-32">Phân hệ</th>
                        <th className="py-2.5 px-4">Chi tiết quyền hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {[
                        {
                          module: 'Học sinh',
                          perms: [
                            { key: 'perm_student_eval', label: 'Đánh giá' },
                            { key: 'perm_student_email', label: 'Email' },
                            { key: 'perm_student_note', label: 'Ghi chú' },
                            { key: 'perm_student_roll_back_trial', label: 'Hoàn tác học thử' },
                            { key: 'perm_student_convert_official', label: 'Chuyển chính thức' },
                            { key: 'perm_student_transfer', label: 'Chuyển lớp' },
                            { key: 'perm_student_approve_transfer_trial_esl', label: 'Duyệt ESL' },
                            { key: 'perm_student_approve_transfer_trial_efl', label: 'Duyệt EFL' },
                            { key: 'perm_student_stop', label: 'Dừng học' },
                          ]
                        },
                        {
                          module: 'Lớp học',
                          perms: [
                            { key: 'perm_class_add_student', label: 'Thêm HS vào lớp' },
                            { key: 'perm_class_delete_attendance', label: 'Xóa điểm danh' },
                            { key: 'perm_class_send_email', label: 'Gửi email lớp' },
                            { key: 'perm_class_send_report', label: 'Gửi báo cáo' },
                            { key: 'perm_class_clone', label: 'Clone lớp học' },
                          ]
                        },
                        {
                          module: 'Lịch biểu',
                          perms: [
                            { key: 'perm_attendance_today', label: 'Điểm danh' },
                            { key: 'perm_schedule_change_teacher', label: 'Đổi GV' },
                            { key: 'perm_schedule_change_oa', label: 'Đổi OA' },
                          ]
                        },
                        {
                          module: 'Tài chính',
                          perms: [
                            { key: 'perm_revenue_create_debt', label: 'Tạo công nợ học phí' },
                            { key: 'perm_revenue_collect_debt', label: 'Thu tiền nợ học phí' },
                            { key: 'perm_revenue_export_notice', label: 'Xuất phiếu thông báo nợ' },
                            { key: 'perm_revenue_delete_debt', label: 'Xóa công nợ' },
                            { key: 'perm_revenue_collect_meal', label: 'Thu tiền ăn' },
                          ]
                        }
                      ].map((m, mIdx) => (
                        <tr key={mIdx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-800 bg-slate-50/20">{m.module}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2.5">
                              {m.perms.map(p => (
                                <label key={p.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-[#21398A]/30 transition-colors cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!editPerms[p.key]}
                                    onChange={(e) => handlePermToggle(p.key)}
                                    className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300"
                                  />
                                  <span className="text-[11px] text-slate-600 font-bold">{p.label}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>


          </form>
        </div>
      )}



      {/* Add Teacher Form */}
      {activeView === 'add' && (
        <div className="space-y-6 animate-fade-in text-slate-800">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h1 className="text-3xl font-extrabold text-[#21398A] tracking-tight">Thêm Giáo Viên Mới</h1>
              <p className="text-slate-500 mt-1">
                Tạo tài khoản giáo viên mới và cấu hình phân quyền truy cập hệ thống.
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
                form="add-teacher-form"
                disabled={submitting}
                className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d60] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-2 cursor-pointer"
              >
                {submitting && <RefreshCw size={16} className="animate-spin" />}
                <span>Thêm Giáo Viên</span>
              </button>
            </div>
          </div>

          <form id="add-teacher-form" onSubmit={handleAddTeacher} className="space-y-6">
            {/* PHẦN 1: THÔNG TIN CƠ BẢN */}
            <div className="info-section-card">
              <span className="section-card-title section-title-green">
                <Users size={18} />
                1. Thông tin người dùng
              </span>

              {/* Hàng 1: Họ tên, Email, Mật khẩu */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <label className="tht-input-label">Email đăng nhập *</label>
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="name@tht.edu.vn"
                    className="tht-input"
                    required
                  />
                </div>

                <div>
                  <label className="tht-input-label">Mật khẩu *</label>
                  <input
                    type="text"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="123"
                    className="tht-input"
                    required
                  />
                </div>
              </div>

              {/* Hàng 2: Chức vụ, Bộ phận, Số điện thoại, Trạng thái */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <div>
                  <label className="tht-input-label">Chức vụ</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Giáo viên">Giáo viên</option>
                    <option value="Admin">Admin</option>
                    <option value="Quản trị viên">Quản trị viên</option>
                    <option value="Nhân viên">Nhân viên</option>
                    <option value="Trợ lý">Trợ lý</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Bộ phận</label>
                  <select
                    value={addDept}
                    onChange={(e) => setAddDept(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Tiếng Anh">Tiếng Anh</option>
                    <option value="Tư Vấn">Tư Vấn</option>
                    <option value="IT">IT</option>
                    <option value="Kế toán">Kế toán</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Số điện thoại</label>
                  <input
                    type="text"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="09XXXXXXXX"
                    className="tht-input"
                  />
                </div>

                <div>
                  <label className="tht-input-label">Trạng thái hoạt động</label>
                  <select
                    value={addStatus}
                    onChange={(e) => setAddStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Tạm ngừng/Khóa">Tạm ngừng/Khóa</option>
                  </select>
                </div>
              </div>

              {/* Hàng 3: Link ảnh Avatar */}
              <div className="grid grid-cols-1 gap-4 mt-4">
                <div>
                  <label className="tht-input-label">Link ảnh Avatar (Tùy chọn)</label>
                  <input
                    type="text"
                    value={addAvatarUrl}
                    onChange={(e) => setAddAvatarUrl(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                    className="tht-input"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 2: PHÂN QUYỀN HỆ THỐNG */}
            <div className="info-section-card">
              <span className="section-card-title section-title-purple">
                <Shield size={18} />
                2. Phân quyền hệ thống
              </span>

              {/* 2.1 Quản lý theo nhóm */}
              <div className="mb-6">
                <span className="tht-input-label mb-2.5">Quản lý theo nhóm</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'perm_admin_group', label: 'Quyền Quản trị viên' },
                    { key: 'perm_consultant_group', label: 'Quyền Tư vấn' },
                    { key: 'perm_academic_group', label: 'Quyền Học vụ' },
                    { key: 'perm_teacher_group', label: 'Quyền Giáo viên' },
                  ].map(g => (
                    <label key={g.key} className="flex items-center gap-2.5 bg-white px-3.5 py-3 rounded-xl border border-slate-200/80 hover:border-[#21398A]/50 transition-colors cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={!!addPerms[g.key]}
                        onChange={(e) => handleAddGroupCheckboxChange(g.key, e.target.checked)}
                        className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700">{g.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2.2 Quản lý cơ bản */}
              <div className="mb-6">
                <span className="tht-input-label mb-2.5">Quản lý cơ bản</span>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                        <th className="py-2.5 px-4">Quyền quản lý</th>
                        <th className="py-2.5 px-4 text-center">Thêm</th>
                        <th className="py-2.5 px-4 text-center">Sửa</th>
                        <th className="py-2.5 px-4 text-center">Xóa</th>
                        <th className="py-2.5 px-4 text-center">Tất cả</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {[
                        { label: 'Giáo viên', keys: ['perm_user_add', 'perm_user_edit', 'perm_user_delete'] },
                        { label: 'Học sinh', keys: ['perm_kh_add', 'perm_kh_edit', 'perm_kh_delete'] },
                        { label: 'Lớp học', keys: ['perm_class_add', 'perm_class_edit', 'perm_class_delete'] },
                        { label: 'Cài đặt & TT Công ty', keys: ['perm_settings_add', 'perm_settings_edit', 'perm_settings_delete'] },
                      ].map((row, rIdx) => {
                        const isAllChecked = row.keys.every(k => addPerms[k]);
                        return (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-4 font-bold">{row.label}</td>
                            {row.keys.map(k => (
                              <td key={k} className="py-2 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!addPerms[k]}
                                  onChange={(e) => handleAddPermToggle(k)}
                                  className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300 cursor-pointer"
                                />
                              </td>
                            ))}
                            <td className="py-2 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isAllChecked}
                                onChange={(e) => handleAddAllRowToggle(row.keys, e.target.checked)}
                                className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300 cursor-pointer"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2.3 Quản lý nâng cao/chuyên sâu */}
              <div>
                <span className="tht-input-label mb-2.5">Quản lý chuyên sâu</span>
                <div className="overflow-x-auto border border-slate-200/60 rounded-xl bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/60 text-slate-600 font-bold border-b border-slate-200/60">
                        <th className="py-2.5 px-4 w-32">Phân hệ</th>
                        <th className="py-2.5 px-4">Chi tiết quyền hạn</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                      {[
                        {
                          module: 'Học sinh',
                          perms: [
                            { key: 'perm_student_eval', label: 'Đánh giá' },
                            { key: 'perm_student_email', label: 'Email' },
                            { key: 'perm_student_note', label: 'Ghi chú' },
                            { key: 'perm_student_roll_back_trial', label: 'Hoàn tác học thử' },
                            { key: 'perm_student_convert_official', label: 'Chuyển chính thức' },
                            { key: 'perm_student_transfer', label: 'Chuyển lớp' },
                            { key: 'perm_student_approve_transfer_trial_esl', label: 'Duyệt ESL' },
                            { key: 'perm_student_approve_transfer_trial_efl', label: 'Duyệt EFL' },
                            { key: 'perm_student_stop', label: 'Dừng học' },
                          ]
                        },
                        {
                          module: 'Lớp học',
                          perms: [
                            { key: 'perm_class_add_student', label: 'Thêm HS vào lớp' },
                            { key: 'perm_class_delete_attendance', label: 'Xóa điểm danh' },
                            { key: 'perm_class_send_email', label: 'Gửi email lớp' },
                            { key: 'perm_class_send_report', label: 'Gửi báo cáo' },
                            { key: 'perm_class_clone', label: 'Clone lớp học' },
                          ]
                        },
                        {
                          module: 'Lịch biểu',
                          perms: [
                            { key: 'perm_attendance_today', label: 'Điểm danh' },
                            { key: 'perm_schedule_change_teacher', label: 'Đổi GV' },
                            { key: 'perm_schedule_change_oa', label: 'Đổi OA' },
                          ]
                        },
                        {
                          module: 'Tài chính',
                          perms: [
                            { key: 'perm_revenue_create_debt', label: 'Tạo công nợ học phí' },
                            { key: 'perm_revenue_collect_debt', label: 'Thu tiền nợ học phí' },
                            { key: 'perm_revenue_export_notice', label: 'Xuất phiếu thông báo nợ' },
                            { key: 'perm_revenue_delete_debt', label: 'Xóa công nợ' },
                            { key: 'perm_revenue_collect_meal', label: 'Thu tiền ăn' },
                          ]
                        }
                      ].map((m, mIdx) => (
                        <tr key={mIdx} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-bold text-slate-800 bg-slate-50/20">{m.module}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-2.5">
                              {m.perms.map(p => (
                                <label key={p.key} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-[#21398A]/30 transition-colors cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!addPerms[p.key]}
                                    onChange={(e) => handleAddPermToggle(p.key)}
                                    className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-[#21398A] border-slate-300"
                                  />
                                  <span className="text-[11px] text-slate-600 font-bold">{p.label}</span>
                                </label>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </form>
        </div>
      )}
      {mounted && showSuccessToast && createPortal(
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
        </div>,
        document.body
      )}

      {mounted && showDeleteModal && teacherToDelete && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-red-100 shadow-2xl p-6 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100">
              <Trash2 size={24} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-800 text-center mb-2">Xác nhận xóa?</h3>
            <p className="text-sm font-semibold text-slate-500 text-center leading-relaxed mb-6">
              Bạn có chắc chắn muốn xóa giáo viên <strong className="text-slate-800">{teacherToDelete.name}</strong> không? Hành động này không thể hoàn tác.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setTeacherToDelete(null);
                }}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-sm transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/10 cursor-pointer"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && submitting && createPortal(
        <div className="fixed inset-0 z-[1900] flex flex-col items-center justify-center bg-slate-900/15 backdrop-blur-3xs pointer-events-auto cursor-wait">
          <div className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 shadow-2xl p-6 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
            <RefreshCw className="animate-spin text-[#21398A]" size={28} />
            <span className="text-sm font-extrabold text-slate-700">Đang cập nhật...</span>
          </div>
        </div>,
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
