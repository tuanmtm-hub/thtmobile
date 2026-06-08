'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useSchedulePageData, useClassAttendanceDetails } from '@/hooks/useGasData';
import {
  BookOpen,
  Search,
  RefreshCw,
  Calendar,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  Check,
  X,
  Users,
  MapPin,
  Layers,
  Info,
} from 'lucide-react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

const Portal = ({ children }: PortalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;

  return createPortal(children, document.body);
};

interface ClassItem {
  id: string;
  name: string;
  khoiId?: string;
  nhomId: string;
  studyType: string; // 'Theo tháng' | 'Theo khóa' | 'Theo giờ'
  startDate: string;
  endDate: string;
  teacher: string;
  status: string; // 'Đang học'
  room: string;
  ca: string;
  fee: number;
  note: string;
  daysInWeek?: string; // Ngày học trong tuần
  roomCaMap?: string; // Room/Ca theo thứ JSON
  todaySessions: { ca: string; time: string; room: string; oa1?: string; oa2?: string }[]; // Danh sách ca học cụ thể hôm nay
  totalStudents?: number;
  trialStudents?: number;
}

const parseToDate = (dateStr: string): Date => {
  if (!dateStr) return new Date(0);

  let rawDate = dateStr.trim();
  const match = rawDate.match(/^([^(]+)\(([^)]+)\)/);
  if (match) {
    rawDate = match[1].trim();
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
    const parts = rawDate.split('/');
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }

  const parsed = new Date(rawDate);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return new Date(0);
};

export default function DailySchedule() {
  const { user } = useAuth();
  const userPerms = user?.permissions || {};
  const isAdmin = user?.role === 'Admin' || userPerms['perm_admin'] === true;
  const { setBreadcrumbs } = useBreadcrumb();
  const router = useRouter();

  const {
    classesToday,
    roomsList,
    shiftsList,
    teachersList,
    isLoading,
    refresh
  } = useSchedulePageData(user?.email);

  const loading = isLoading;
  const [searchQuery, setSearchQuery] = useState('');

  // States quản lý Điểm danh (Attendance States)
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<ClassItem | null>(null);
  const [showAttendancePanel, setShowAttendancePanel] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const { attendanceDetails, isLoading: loadingAttendanceDetails, mutate: mutateAttendance } = useClassAttendanceDetails(
    selectedClassForAttendance?.name || '',
    attendanceDate,
    user?.email
  );

  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [attendanceStates, setAttendanceStates] = useState<Record<string, 'A' | 'C' | 'K'>>({});
  const [attendanceShifts, setAttendanceShifts] = useState<{ ca: string; time: string; onAir1?: string; onAir2?: string }[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  useEffect(() => {
    if (attendanceDetails) {
      const { students, exists, shifts } = attendanceDetails;
      if (!exists) {
        setAttendanceStudents([]);
        setAttendanceStates({});
        setAttendanceShifts([]);
        setSelectedShift('');
      } else {
        const list: any[] = (students || []).filter((s: any) => s.name);
        setAttendanceStudents(list);
        const initial: Record<string, 'A' | 'C' | 'K'> = {};
        list.forEach((s: any) => {
          initial[s.name] = (s.todayStatus === 'C' || s.todayStatus === 'K') ? s.todayStatus : 'A';
        });
        setAttendanceStates(initial);
        const shiftList = (shifts || []).map((s: any) => {
          const shObj = shiftsList.find(sf => sf.id === s.ca || sf.name === s.ca);
          return {
            ca: shObj ? shObj.name : s.ca,
            time: s.time || '',
            onAir1: s.onAir1 || '',
            onAir2: s.onAir2 || ''
          };
        });
        setAttendanceShifts(shiftList);
        if (shiftList.length === 1) setSelectedShift(shiftList[0].ca);
        else setSelectedShift('');
      }
    } else {
      setAttendanceStudents([]);
      setAttendanceStates({});
      setAttendanceShifts([]);
      setSelectedShift('');
    }
  }, [attendanceDetails, shiftsList]);

  const loadingStudents = loadingAttendanceDetails;

  // Nhận diện ngày hôm nay
  const [todayString, setTodayString] = useState('');

  useEffect(() => {
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const today = new Date();
    const wd = today.getDay();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setTodayString(`${dayNames[wd]}, Ngày ${dd}/${mm}/${yyyy}`);
  }, []);

  // Lấy danh sách học sinh từ sheet lớp riêng (action=getClassDetails) - Quản lý bởi SWR
  const fetchStudentsForClass = useCallback(async (classItem: ClassItem, dateStr?: string) => {
    if (dateStr) {
      setAttendanceDate(dateStr);
    }
    await mutateAttendance();
  }, [mutateAttendance]);

  // Lưu điểm danh vào sheet lớp riêng (action=recordAttendance)
  const handleSaveAttendance = async () => {
    if (!selectedClassForAttendance) return;
    if (attendanceShifts.length > 1 && !selectedShift) {
      alert('Vui lòng chọn ca học trước khi lưu điểm danh!');
      return;
    }
    try {
      setSavingAttendance(true);
      const email = user?.email || '';
      const attendanceList = attendanceStudents.map((s: any) => ({
        name: s.name,
        status: attendanceStates[s.name] || 'A',
      }));

      // Tìm Ca ID nguyên bản từ Ca Name hiển thị nếu được chọn
      const shOriginal = shiftsList.find(s => s.name === selectedShift);
      const shiftPayloadVal = shOriginal ? shOriginal.id : selectedShift;

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'recordAttendance',
          loginEmail: email,
          data: {
            className: selectedClassForAttendance.name,
            date: attendanceDate,
            attendanceList,
            shiftInfo: shiftPayloadVal,
          },
        }),
      });
      const res = await response.json();
      if (res.success) {
        alert(`Đã lưu điểm danh lớp ${selectedClassForAttendance.name} ngày ${attendanceDate}${selectedShift ? ' (ca ' + selectedShift + ')' : ''
          } thành công!`);
        await mutateAttendance();
        handleCloseAttendancePanel();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể lưu điểm danh.'));
      }
    } catch (e) {
      console.error('Error saving attendance:', e);
      alert('Có lỗi xảy ra khi lưu điểm danh.');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleCloseAttendancePanel = () => {
    setShowAttendancePanel(false);
    setSelectedClassForAttendance(null);
    setAttendanceStudents([]);
    setAttendanceStates({});
    setAttendanceShifts([]);
    setSelectedShift('');
  };

  const fetchDailySchedule = useCallback(async () => {
    await refresh();
  }, [refresh]);


  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Lớp học', href: '/classes' },
      { label: 'Lịch học hôm nay' }
    ]);
  }, [setBreadcrumbs]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
  };

  // Filter logic
  const filteredTodayClasses = classesToday.filter(cls => {
    return cls.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.teacher?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.room?.toLowerCase().includes(searchQuery.toLowerCase());
  });



  // Pagination (shared hook - 10 dòng/trang)
  const {
    paginatedData: paginatedClassesToday,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(filteredTodayClasses, 10, [searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Lịch học hôm nay</h1>
          <p className="text-slate-500 mt-1 flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-extrabold text-[#21398A] bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg text-xs w-max">
              {todayString || 'Đang tải ngày hiện tại...'}
            </span>
            <span className="text-xs sm:text-sm text-slate-400 sm:text-slate-500">
              Theo dõi các ca dạy, phòng học và thực hiện điểm danh học sinh trực tiếp.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={fetchDailySchedule}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#21398A] hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-[0.98] text-xs sm:text-sm"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại lịch học</span>
          </button>
        </div>
      </div>



      {/* Search & Actions Bar */}
      <div className="tht-toolbar">
        {/* Controls Row */}
        <div className="tht-toolbar-controls w-full">
          <div className="tht-toolbar-search">
            <div className="tht-search-wrapper">
              <Search className="tht-search-icon" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm lớp học, giáo viên, phòng dạy hôm nay..."
                className="tht-search-input"
              />
            </div>
          </div>

          <div className="tht-found-count">
            <BookOpen size={16} className="text-[#21398A]" />
            <span>Đang học hôm nay: <strong className="text-slate-800">{filteredTodayClasses.length}</strong> lớp</span>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
            <RefreshCw size={24} className="animate-spin text-[#21398A]" />
            <span>Đang tải lịch học hôm nay...</span>
          </div>
        ) : filteredTodayClasses.length === 0 ? (
          <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
            <BookOpen size={48} className="text-slate-200" />
            <span>Hôm nay không có lớp học nào khớp với điều kiện lọc.</span>
          </div>
        ) : (
          <>
            {/* Desktop View: Table */}
            <div className="hidden md:block tht-table-wrapper">
              <table className="tht-table thttable">
                <thead className="tht-table-thead">
                  <tr>
                    <th className="tht-table-th text-left">Tên lớp học</th>
                    <th className="tht-table-th text-left">Giáo viên chủ nhiệm</th>
                    <th className="tht-table-th text-center">Sĩ số</th>
                    <th className="tht-table-th text-center">Học thử</th>
                    <th className="tht-table-th text-center">Phòng dạy</th>
                    <th className="tht-table-th text-center">Ca dạy hôm nay</th>
                    <th className="tht-table-th text-center">Giáo viên OA</th>
                    <th className="tht-table-th text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="tht-table-tbody">
                  {paginatedClassesToday.map((item, idx) => (
                    <tr
                      key={idx}
                      className="tht-table-tr thttable-tr"
                      onClick={() => {
                        router.push(`/classes?id=${item.id}`);
                      }}
                    >
                      <td className="tht-table-td text-left">
                        <div className="font-semibold text-[#21398A] text-sm hover:underline cursor-pointer">
                          {item.name}
                        </div>
                      </td>
                      <td className="tht-table-td text-left">
                        <div className="flex items-center gap-1.5 font-medium text-slate-600 text-sm">
                          <User size={14} className="text-slate-400" />
                          <span>{item.teacher || 'Chưa phân công'}</span>
                        </div>
                      </td>
                      <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="font-extrabold text-slate-700 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md text-xs">{item.totalStudents ?? 0}</span>
                      </td>
                      <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-md text-xs">{item.trialStudents ?? 0}</span>
                      </td>
                      <td className="tht-table-td text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-700 font-bold bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">
                          <MapPin size={12} className="text-[#21398A]" />
                          <span>{item.todaySessions[0]?.room || item.room || '—'}</span>
                        </div>
                      </td>
                      <td className="tht-table-td text-center">
                        <div className="space-y-1">
                          {item.todaySessions.map((sess: any, sIdx: number) => (
                            <div key={sIdx} className="flex items-center justify-center gap-1 text-xs font-bold text-slate-700">
                              <span className="px-1.5 py-0.5 bg-blue-50 text-[#21398A] rounded border border-blue-100 text-[10px]">
                                {sess.ca}
                              </span>
                              {sess.time && <span className="text-[10px] text-slate-400 font-normal">{sess.time}</span>}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="tht-table-td text-center">
                        <div className="flex flex-col gap-1 items-center justify-center">
                          {item.todaySessions.map((sess: any, sIdx: number) => {
                            const oas = [sess.oa1, sess.oa2].filter(Boolean);
                            return (
                              <div key={sIdx} className="w-full flex flex-col items-center gap-0.5">
                                {oas.length > 0 ? (
                                  oas.map((oaName: any, oaIdx: number) => (
                                    <span
                                      key={oaIdx}
                                      className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 text-[10px] font-bold text-center block"
                                    >
                                      {oaName}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-slate-400 font-normal italic text-xs">Chưa phân công</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="tht-table-td thtaction">
                        <div className="flex items-center justify-center gap-2">
                          {(isAdmin || userPerms['perm_attendance_today']) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Ngăn sự kiện click dòng hiển thị chi tiết
                                setSelectedClassForAttendance(item);
                                setShowAttendancePanel(true);
                                fetchStudentsForClass(item);
                              }}
                              className="tht-text-action-btn tht-text-action-btn-green"
                            >
                              <ClipboardCheck size={14} />
                              <span>Điểm danh</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View: Card List */}
            <div className="md:hidden space-y-3 p-4 bg-slate-50/50">
              {paginatedClassesToday.map((item, idx) => (
                <div
                  key={idx}
                  className="tht-mobile-card cursor-pointer"
                  onClick={() => {
                    router.push(`/classes?id=${item.id}`);
                  }}
                >
                  {/* Card Header */}
                  <div className="tht-mobile-card-header">
                    <div className="font-bold text-[#21398A] text-sm hover:underline">
                      {item.name}
                    </div>
                    {(isAdmin || userPerms['perm_attendance_today']) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent card click navigation
                          setSelectedClassForAttendance(item);
                          setShowAttendancePanel(true);
                          fetchStudentsForClass(item);
                        }}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200/50 text-[10px] font-bold flex items-center gap-1 transition-all shrink-0"
                      >
                        <ClipboardCheck size={12} />
                        <span>Điểm danh</span>
                      </button>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="space-y-2">
                    <div className="tht-mobile-card-row">
                      <span className="tht-mobile-card-label">
                        <User size={12} className="text-slate-400" />
                        <span>Giáo viên CN:</span>
                      </span>
                      <span className="tht-mobile-card-value font-medium text-slate-600">
                        {item.teacher || 'Chưa phân công'}
                      </span>
                    </div>

                    <div className="tht-mobile-card-row">
                      <span className="tht-mobile-card-label">
                        <MapPin size={12} className="text-[#21398A]" />
                        <span>Phòng học:</span>
                      </span>
                      <span className="tht-mobile-card-value font-bold text-slate-700">
                        {item.todaySessions[0]?.room || item.room || '—'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 pt-1 border-t border-slate-100/50" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Users size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500 font-bold">Sĩ số:</span>
                        <span className="font-extrabold text-slate-700 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded text-[10px]">{item.totalStudents ?? 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-500 font-bold">Học thử:</span>
                        <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-150 px-1.5 py-0.5 rounded text-[10px]">{item.trialStudents ?? 0}</span>
                      </div>
                    </div>

                    {/* Sessions list */}
                    {item.todaySessions.length > 0 && (
                      <div className="border-t border-slate-100 pt-2 mt-1 space-y-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Chi tiết ca dạy hôm nay
                        </div>
                        {item.todaySessions.map((sess: any, sIdx: number) => {
                          const oas = [sess.oa1, sess.oa2].filter(Boolean);
                          return (
                            <div key={sIdx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1.5">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-extrabold text-[#21398A] bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 text-[10px]">
                                  Ca: {sess.ca}
                                </span>
                                {sess.time && (
                                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                                    <Clock size={10} />
                                    {sess.time}
                                  </span>
                                )}
                              </div>
                              <div className="flex justify-between items-start gap-2 text-xs">
                                <span className="text-[10px] text-slate-400 font-bold">On Air:</span>
                                <div className="text-right">
                                  {oas.length > 0 ? (
                                    oas.map((oaName: any, oaIdx: number) => (
                                      <span
                                        key={oaIdx}
                                        className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 text-[9px] font-bold inline-block ml-1"
                                      >
                                        {oaName}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-400 italic text-[10px]">Chưa phân công</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="tht-pagination-container">
                <div className="tht-pagination-info">
                  Hiển thị từ <span>{startIndex + 1}</span> đến{' '}
                  <span>
                    {Math.min(startIndex + itemsPerPage, filteredTodayClasses.length)}
                  </span>{' '}
                  trong tổng số <span>{filteredTodayClasses.length}</span> lớp học hôm nay
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
                        className={`tht-pagination-btn tht-pagination-num ${currentPage === page ? 'tht-pagination-num-active' : ''}`}
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

      {/* Modal Điểm danh */}
      {showAttendancePanel && selectedClassForAttendance && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => { setShowAttendancePanel(false); setSelectedClassForAttendance(null); setAttendanceStudents([]); }}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><ClipboardCheck size={20} /></span>
                  <span>Điểm danh: {selectedClassForAttendance.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowAttendancePanel(false); setSelectedClassForAttendance(null); setAttendanceStudents([]); }}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {/* Lớp & Giáo viên Banner */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-blue-50 text-[#21398A] rounded-xl">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-slate-800">{selectedClassForAttendance.name}</h4>
                        <p className="text-xs text-slate-400 font-semibold">Giáo viên: {selectedClassForAttendance.teacher || 'Chưa phân công'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Hình thức</span>
                      <span className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-100">{selectedClassForAttendance.studyType || 'Theo tháng'}</span>
                    </div>
                  </div>

                  {/* Bộ chọn Ngày điểm danh */}
                  <div className="pt-3 border-t border-slate-200/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                        <Calendar size={16} className="text-[#21398A]" />
                        <span>Ngày điểm danh:</span>
                      </label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={attendanceDate}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          setAttendanceDate(newDate);
                          if (selectedClassForAttendance) {
                            fetchStudentsForClass(selectedClassForAttendance, newDate);
                          }
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[#21398A] focus:ring-1 focus:ring-[#21398A]/20 transition-all shadow-xs"
                      />
                    </div>

                    {/* Chọn ca học */}
                    {attendanceShifts.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        Không có ca học cho ngày này
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                            <Clock size={14} className="text-slate-400" />
                            Ca học:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {attendanceShifts.map((s) => (
                              <button
                                key={s.ca}
                                type="button"
                                onClick={() => setSelectedShift(s.ca)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${selectedShift === s.ca
                                  ? 'bg-[#21398A] text-white border-[#21398A] shadow-sm'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-[#21398A]/40 hover:text-[#21398A]'
                                  }`}
                              >
                                {s.ca}{s.time ? ` (${s.time})` : ''}
                              </button>
                            ))}
                          </div>
                          {attendanceShifts.length > 1 && !selectedShift && (
                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                              <AlertTriangle size={12} />
                              Bắt buộc chọn ca
                            </span>
                          )}
                        </div>
                        {(() => {
                          const currentShift = attendanceShifts.find((s) => s.ca === selectedShift) || attendanceShifts[0];
                          if (!currentShift || (!currentShift.onAir1 && !currentShift.onAir2)) return null;
                          return (
                            <div className="text-xs font-semibold text-slate-600 bg-white border border-slate-100 rounded-xl px-3 py-2">
                              Giáo viên On Air: {[currentShift.onAir1, currentShift.onAir2].filter(Boolean).join(' / ')}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Thống kê nhanh KPI */}
                {!loadingStudents && attendanceStudents.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Sỹ số</div>
                      <div className="text-base font-extrabold text-slate-700">{attendanceStudents.length}</div>
                    </div>
                    <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                      <div className="text-[10px] font-bold text-emerald-600 uppercase">Đi học</div>
                      <div className="text-base font-extrabold text-emerald-600">
                        {Object.values(attendanceStates).filter(s => s === 'A').length}
                      </div>
                    </div>
                    <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100">
                      <div className="text-[10px] font-bold text-amber-600 uppercase">Có phép</div>
                      <div className="text-base font-extrabold text-amber-600">
                        {Object.values(attendanceStates).filter(s => s === 'C').length}
                      </div>
                    </div>
                    <div className="bg-red-50 p-2.5 rounded-xl border border-red-100">
                      <div className="text-[10px] font-bold text-red-600 uppercase">Không phép</div>
                      <div className="text-base font-extrabold text-red-600">
                        {Object.values(attendanceStates).filter(s => s === 'K').length}
                      </div>
                    </div>
                  </div>
                )}

                {/* Danh sách học sinh */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-slate-400" />
                    <span>Danh sách học viên</span>
                  </h5>

                  {loadingStudents ? (
                    <div className="py-12 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-[#21398A]" />
                      <span>Đang tải danh sách học sinh...</span>
                    </div>
                  ) : attendanceStudents.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Users size={32} className="text-slate-300" />
                      <span>Không tìm thấy học sinh nào thuộc lớp này.</span>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                      {attendanceStudents.map((student) => {
                        return (
                          <div
                            key={student.id}
                            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs hover:shadow-sm hover:border-slate-200/80 transition-all space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="font-bold text-slate-800 text-sm">{student.name}</div>
                                {student.nickName && (
                                  <span className="inline-block mt-0.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                                    {student.nickName}
                                  </span>
                                )}
                              </div>

                              {/* Bộ chọn trạng thái A/C/K */}
                              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/50">
                                {([
                                  { key: 'A', label: 'Đi học', color: 'bg-emerald-500 text-white shadow-xs' },
                                  { key: 'C', label: 'Có phép', color: 'bg-amber-500 text-white shadow-xs' },
                                  { key: 'K', label: 'Không phép', color: 'bg-red-500 text-white shadow-xs' }
                                ] as const).map((btn) => {
                                  const isActive = (attendanceStates[student.name] || 'A') === btn.key;
                                  return (
                                    <button
                                      key={btn.key}
                                      type="button"
                                      onClick={() => setAttendanceStates(prev => ({
                                        ...prev,
                                        [student.name]: btn.key
                                      }))}
                                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${isActive
                                          ? btn.color
                                          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                        }`}
                                    >
                                      {btn.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={handleCloseAttendancePanel}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                  disabled={savingAttendance}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={savingAttendance || loadingStudents || attendanceStudents.length === 0}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingAttendance ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Lưu điểm danh</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
