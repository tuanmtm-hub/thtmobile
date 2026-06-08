'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  UserCheck,
  Clock,
  MapPin,
  Users,
  Search,
  Settings,
  HelpCircle,
  CheckCircle,
  FileSpreadsheet,
  LayoutGrid,
  List,
} from 'lucide-react';

interface CalendarSession {
  hasClass: boolean;
  className: string;
  teacher: string;
  program: string;
  room: string;
  ca: string;
  shiftKey: string;
  shiftDate: string;
  start: string;
  end: string;
  isSubstitute: boolean;
  onAir1: string;
  onAir2: string;
  oa1Range: string;
  oa2Range: string;
  isToday: boolean;
  totalStudents: number;
  trialStudents: number;
  startDate: string;
  endDate: string;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const getSignal = useAbortController();
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [scheduleData, setScheduleData] = useState<any>({ dates: [], schedule: [] });
  const [teachersList, setTeachersList] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Layout states
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);

  // Modals state
  const [activeModal, setActiveModal] = useState<'NONE' | 'CHANGE_TEACHER' | 'CHANGE_OA'>('NONE');
  const [selectedSession, setSelectedSession] = useState<CalendarSession | null>(null);

  // Teacher override form state
  const [targetTeacher, setTargetTeacher] = useState('');
  const [overrideType, setOverrideType] = useState<'TODAY' | 'FUTURE' | 'SAME_WEEKDAY'>('TODAY');
  const [submitting, setSubmitting] = useState(false);

  // On Air override form state
  const [oa1, setOa1] = useState('');
  const [oa2, setOa2] = useState('');
  const [oa1Start, setOa1Start] = useState('');
  const [oa1End, setOa1End] = useState('');
  const [oa2Start, setOa2Start] = useState('');
  const [oa2End, setOa2End] = useState('');
  const [activeTeachers, setActiveTeachers] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [oaOverrideType, setOaOverrideType] = useState<'single' | 'future' | 'weekdayFuture'>('single');

  const fetchSchedule = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';

      // Fetch all three endpoints in parallel
      const [resSched, resTeach, resActiveTeach] = await Promise.all([
        fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/reports',
            method: 'POST',
            action: 'getScheduleForWeek',
            loginEmail: email,
            data: { weekOffset: weekOffset, options: {} },
          }),
          signal,
        }),
        fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/reports',
            method: 'POST',
            action: 'getTeacherNameList',
            loginEmail: email,
            data: {},
          }),
          signal,
        }),
        fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/users',
            method: 'GET',
            loginEmail: email,
          }),
          signal,
        })
      ]);

      const [resS, resT, resAT] = await Promise.all([
        resSched.json(),
        resTeach.json(),
        resActiveTeach.json()
      ]);

      // 1. Process schedule data
      if (resS.success && resS.data) {
        setScheduleData(resS.data);
      } else {
        setScheduleData({ dates: [], schedule: [] });
      }

      // 2. Process teacher list
      if (resT.success && Array.isArray(resT.data)) {
        setTeachersList(resT.data);
      }

      // 3. Process active teachers for On Air dropdown
      if (resAT.success && Array.isArray(resAT.data)) {
        const viCollator = new Intl.Collator('vi', { sensitivity: 'base', numeric: true });
        const activeNames: string[] = resAT.data
          .filter((item: any) => String(item[4] || '').trim() === 'Đang hoạt động')
          .map((item: any) => String(item[1] || '').trim())
          .filter(Boolean);
        const uniqueNames: string[] = Array.from(new Set(activeNames));
        uniqueNames.sort((a, b) => viCollator.compare(a, b));
        setActiveTeachers(uniqueNames);
      }

      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error loading schedule:', e);
      setLoading(false);
    }
  }, [user?.email, weekOffset, getSignal]);

  useEffect(() => {
    if (user?.email) {
      fetchSchedule();
    }
  }, [user?.email, fetchSchedule]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Thời khóa biểu' }
    ]);
  }, [setBreadcrumbs]);

  // Set default day selector index to today's date if possible
  useEffect(() => {
    if (scheduleData.dates.length > 0) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      const formattedToday = `${dd}/${mm}/${yyyy}`;
      const idx = scheduleData.dates.indexOf(formattedToday);
      setSelectedDayIndex(idx >= 0 ? idx : 0);
      setCurrentPage(1);
    }
  }, [scheduleData.dates]);

  // Reset pagination to page 1 on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleOpenTeacherModal = (session: CalendarSession) => {
    setSelectedSession(session);
    setTargetTeacher(session.teacher);
    setOverrideType('TODAY');
    setActiveModal('CHANGE_TEACHER');
  };

  const handleOpenOAModal = (session: CalendarSession) => {
    setSelectedSession(session);
    setOa1(session.onAir1 || '');
    setOa2(session.onAir2 || '');
    setOaOverrideType('single');
    
    // Parse range labels if any
    const r1 = (session.oa1Range || '').split('-');
    setOa1Start(r1[0] || '');
    setOa1End(r1[1] || '');

    const r2 = (session.oa2Range || '').split('-');
    setOa2Start(r2[0] || '');
    setOa2End(r2[1] || '');

    setActiveModal('CHANGE_OA');
  };

  const submitTeacherChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !targetTeacher) return;

    try {
      setSubmitting(true);
      const email = user?.email || '';
      let action = 'setTeacherOverride';
      const data: any = {
        className: selectedSession.className,
        dateStr: selectedSession.shiftDate,
        selected: targetTeacher,
      };

      if (overrideType === 'FUTURE') {
        action = 'setTeacherOverrideForFuture';
        data.applyAll = true;
      } else if (overrideType === 'SAME_WEEKDAY') {
        action = 'setTeacherOverrideForSameWeekdayFuture';
        data.applyAll = true;
      }

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/reports',
          method: 'POST',
          action: action,
          loginEmail: email,
          data: data,
        }),
      });

      const res = await response.json();
      if (res.success) {
        alert('Cập nhật giáo viên thành công!');
        setActiveModal('NONE');
        fetchSchedule();
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

  const submitOAChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;

    try {
      setSubmitting(true);
      const email = user?.email || '';

      const promises = [];

      // Check if OA1 has changed compared to the session's original value
      if (oa1 !== (selectedSession.onAir1 || '')) {
        promises.push(
          fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: '/api/v1/reports',
              method: 'POST',
              action: 'setOnAirOverrideUnified',
              loginEmail: email,
              data: {
                className: selectedSession.className,
                dateStr: selectedSession.shiftDate,
                slot: 'OA1',
                teacherName: oa1,
                mode: oaOverrideType,
              },
            }),
          })
        );
      }

      // Check if OA2 has changed compared to the session's original value
      if (oa2 !== (selectedSession.onAir2 || '')) {
        promises.push(
          fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              path: '/api/v1/reports',
              method: 'POST',
              action: 'setOnAirOverrideUnified',
              loginEmail: email,
              data: {
                className: selectedSession.className,
                dateStr: selectedSession.shiftDate,
                slot: 'OA2',
                teacherName: oa2,
                mode: oaOverrideType,
              },
            }),
          })
        );
      }

      if (promises.length === 0) {
        setActiveModal('NONE');
        return;
      }

      const responses = await Promise.all(promises);
      let hasError = false;
      let errMsg = '';

      for (const res of responses) {
        const json = await res.json();
        if (!json.success) {
          hasError = true;
          errMsg = json.message || 'Có lỗi xảy ra.';
          break;
        }
      }

      if (!hasError) {
        alert('Cập nhật Giáo viên On Air thành công!');
        setActiveModal('NONE');
        fetchSchedule();
      } else {
        alert('Có lỗi xảy ra: ' + errMsg);
      }
    } catch (err) {
      console.error(err);
      alert('Không thể kết nối đến máy chủ.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: Count classes on a specific date for tab badge
  const getSessionCountForDate = (dateStr: string) => {
    let count = 0;
    if (Array.isArray(scheduleData.schedule)) {
      scheduleData.schedule.forEach((classRow: any) => {
        if (classRow && classRow.days) {
          Object.keys(classRow.days).forEach((sessionKey) => {
            if (sessionKey.startsWith(dateStr)) {
              const session = classRow.days[sessionKey];
              if (session && session.hasClass) {
                count++;
              }
            }
          });
        }
      });
    }
    return count;
  };

  // Compute DAILY mode variables (Selected day sessions, grouped by Ca with pagination)
  const selectedDayDate = scheduleData.dates[selectedDayIndex];
  const allSessionsForSelectedDay: CalendarSession[] = [];
  
  if (selectedDayDate && Array.isArray(scheduleData.schedule)) {
    scheduleData.schedule.forEach((classRow: any) => {
      if (classRow && classRow.days) {
        Object.keys(classRow.days).forEach((sessionKey) => {
          if (sessionKey.startsWith(selectedDayDate)) {
            const session = classRow.days[sessionKey];
            if (session && session.hasClass) {
              const matchesSearch =
                !searchQuery ||
                session.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
                session.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (session.room || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                (session.ca || '').toLowerCase().includes(searchQuery.toLowerCase());
                
              if (matchesSearch) {
                allSessionsForSelectedDay.push(session);
              }
            }
          }
        });
      }
    });
  }
  allSessionsForSelectedDay.sort((a, b) => (a.ca || '').localeCompare(b.ca || ''));

  const totalItems = allSessionsForSelectedDay.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const paginatedSessions = allSessionsForSelectedDay.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const shiftsMap: { [ca: string]: CalendarSession[] } = {};
  paginatedSessions.forEach((session) => {
    const caLabel = session.ca || 'Chưa xếp ca';
    if (!shiftsMap[caLabel]) {
      shiftsMap[caLabel] = [];
    }
    shiftsMap[caLabel].push(session);
  });
  const shiftKeys = Object.keys(shiftsMap).sort((a, b) => a.localeCompare(b));

  // Group classes by weekday based on returned date array (For WEEKLY view mode)
  const columns = scheduleData.dates.map((dateStr: string) => {
    const sessionsForDay: CalendarSession[] = [];

    if (Array.isArray(scheduleData.schedule)) {
      scheduleData.schedule.forEach((classRow: any) => {
        if (classRow && classRow.days) {
          Object.keys(classRow.days).forEach((sessionKey) => {
            if (sessionKey.startsWith(dateStr)) {
              const session = classRow.days[sessionKey];
              if (session && session.hasClass) {
                // Check if matches search
                const matchesSearch =
                  !searchQuery ||
                  session.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  session.teacher.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (session.room || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (session.ca || '').toLowerCase().includes(searchQuery.toLowerCase());

                if (matchesSearch) {
                  sessionsForDay.push(session);
                }
              }
            }
          });
        }
      });
    }

    // Sort by shift / start time
    sessionsForDay.sort((a, b) => (a.ca || '').localeCompare(b.ca || ''));

    // Compute display weekday header robustly
    let dayIndex = 0;
    try {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        dayIndex = parsed.getDay();
      }
    } catch (e) {
      console.error('Error parsing date string:', dateStr, e);
    }
    const daysLabel = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const formattedToday = `${dd}/${mm}/${yyyy}`;

    return {
      dateStr,
      dayLabel: daysLabel[dayIndex],
      sessions: sessionsForDay,
      isToday: dateStr === formattedToday,
    };
  });

  const getWeekRangeLabel = () => {
    if (scheduleData.dates.length === 0) return 'Đang tải...';
    return `Tuần từ ${scheduleData.dates[0]} đến ${scheduleData.dates[scheduleData.dates.length - 1]}`;
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Calendar size={28} className="text-[#21398A]" />
            <span>Thời Khóa Biểu</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Theo dõi lịch học trong tuần, bố trí phòng học, chỉ định giáo viên dạy thay hoặc trợ giảng On Air.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Week offset controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
            <button
              onClick={() => setWeekOffset(weekOffset - 1)}
              className="p-2 text-slate-500 hover:text-[#21398A] hover:bg-slate-50 rounded-lg transition-all"
              title="Tuần trước"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-[#21398A] rounded-lg transition-all"
            >
              Tuần này
            </button>
            <button
              onClick={() => setWeekOffset(weekOffset + 1)}
              className="p-2 text-slate-500 hover:text-[#21398A] hover:bg-slate-50 rounded-lg transition-all"
              title="Tuần sau"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={fetchSchedule}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#21398A] hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* Toolbar filter & week string */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm lớp, giáo viên, phòng học, ca..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium transition-all"
          />
        </div>

        <div className="text-slate-700 font-extrabold text-sm md:text-base bg-[#21398A]/5 px-4 py-2 rounded-xl border border-[#21398a]/10">
          {getWeekRangeLabel()}
        </div>
      </div>

      {/* View Mode & Day Selector Tabs */}
      <div className="flex flex-col gap-4">
        {/* View Info Banner */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-xs">
          <div className="text-slate-700 font-extrabold text-sm flex items-center gap-2 px-2">
            <List size={16} className="text-[#21398A]" />
            <span>Chi tiết lịch học theo ngày (Có chia ca)</span>
          </div>
          
          <div className="text-slate-500 text-xs font-semibold px-2">
            Lớp khớp bộ lọc: <span className="text-[#21398A] font-extrabold">{totalItems} lớp</span>
          </div>
        </div>

        {/* Day Tabs */}
        {scheduleData.dates.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100/50">
            {scheduleData.dates.map((dateStr: string, idx: number) => {
              // Compute day labels
              let dayIndex = 0;
              try {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                  const parsed = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                  dayIndex = parsed.getDay();
                }
              } catch (e) {}
              const daysLabelLong = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
              
              const classCount = getSessionCountForDate(dateStr);
              const isSelected = selectedDayIndex === idx;

              return (
                <button
                  key={dateStr}
                  onClick={() => {
                    setSelectedDayIndex(idx);
                    setCurrentPage(1);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'bg-[#21398A] border-[#21398A] text-white shadow-md shadow-[#21398a]/10 scale-[1.02]'
                      : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="text-[10px] uppercase font-extrabold tracking-wider opacity-85">
                    {daysLabelLong[dayIndex]}
                  </div>
                  <div className="text-xs font-bold mt-0.5">
                    {dateStr.substring(0, 5)}
                  </div>
                  <span className={`mt-1.5 text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-white text-[#21398A]'
                      : classCount > 0
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-slate-50 text-slate-400'
                  }`}>
                    {classCount} lớp
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Timetable View Area */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-[#21398A]" />
          <span>Đang tải danh sách lịch học...</span>
        </div>
      ) : scheduleData.dates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Calendar size={48} className="text-slate-200" />
          <span>Không có dữ liệu thời khóa biểu cho tuần này.</span>
        </div>
      ) : (
        // DAILY DETAIL VIEW GROUPED BY SHIFT WITH PAGINATION
        <div className="space-y-6 min-h-[400px]">
          {totalItems === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <Calendar size={36} className="text-slate-200" />
              <span>Không có lớp học nào vào ngày này.</span>
            </div>
          ) : (
            <div className="space-y-6">
              {shiftKeys.map((shiftLabel) => {
                const shiftSessions = shiftsMap[shiftLabel];
                return (
                  <div key={shiftLabel} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                    {/* Shift Time Header */}
                    <div className="flex items-center gap-2 pb-2.5 border-b border-slate-100">
                      <Clock size={16} className="text-[#21398A]" />
                      <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wide">
                        Ca học: {shiftLabel}
                      </h3>
                      <span className="bg-[#21398A]/10 text-[#21398A] text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {shiftSessions.length} lớp
                      </span>
                    </div>

                    {/* Classes Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {shiftSessions.map((session, sIdx) => (
                        <div
                          key={sIdx}
                          className={`p-4 rounded-xl border transition-all duration-150 flex flex-col justify-between gap-3 ${
                            session.isSubstitute
                              ? 'bg-amber-50/30 border-amber-200 hover:border-amber-300'
                              : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-xs'
                          }`}
                        >
                          {/* Time & Room */}
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-slate-400" />
                              {session.ca || 'Ca'}
                            </span>
                            <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md text-slate-600">
                              <MapPin size={11} className="text-[#21398A]" />
                              {session.room || 'Phòng'}
                            </span>
                          </div>

                          {/* Class details */}
                          <div>
                            <div className="font-extrabold text-xs text-[#21398A] truncate" title={session.className}>
                              {session.className}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {session.program || 'Khóa học'}
                            </div>
                          </div>

                          {/* Teacher & Substitute Status */}
                          <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100/50">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-semibold">Giáo viên:</span>
                              {session.isSubstitute && (
                                <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wide">
                                  DẠY THAY
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-slate-700 truncate flex items-center gap-1">
                              <UserCheck size={12} className={session.isSubstitute ? 'text-amber-500' : 'text-emerald-500'} />
                              <span>{session.teacher}</span>
                            </div>
                          </div>

                          {/* On Air support staff */}
                          {(session.onAir1 || session.onAir2) && (
                            <div className="space-y-1 bg-indigo-50/20 p-2.5 rounded-lg border border-indigo-100/30 text-[10px]">
                              <div className="text-indigo-600 font-bold flex items-center gap-1">
                                <Users size={11} />
                                <span>Trợ giảng On Air:</span>
                              </div>
                              <div className="text-slate-600 font-medium space-y-0.5">
                                {session.onAir1 && (
                                  <div className="truncate">
                                    1. {session.onAir1} {session.oa1Range && `(${session.oa1Range})`}
                                  </div>
                                )}
                                {session.onAir2 && (
                                  <div className="truncate">
                                    2. {session.onAir2} {session.oa2Range && `(${session.oa2Range})`}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Admin Action Menu */}
                          <div className="flex gap-1.5 pt-2 border-t border-slate-50">
                            <button
                              onClick={() => handleOpenTeacherModal(session)}
                              className="flex-1 py-1 text-[9px] font-bold text-[#21398A] hover:bg-blue-50 border border-blue-100 rounded-md transition-all uppercase tracking-wider"
                            >
                              Đổi GV
                            </button>
                            <button
                              onClick={() => handleOpenOAModal(session)}
                              className="flex-1 py-1 text-[9px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-100 rounded-md transition-all uppercase tracking-wider"
                            >
                              Đổi OA
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs mt-6">
                  <div className="text-xs text-slate-500 font-semibold">
                    Hiển thị từ <span className="text-slate-700 font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> đến{' '}
                    <span className="text-slate-700 font-bold">{Math.min(currentPage * itemsPerPage, totalItems)}</span> trong tổng số{' '}
                    <span className="text-slate-700 font-bold">{totalItems}</span> lớp
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pNum) => (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                          currentPage === pNum
                            ? 'bg-[#21398A] text-white shadow-md shadow-[#21398a]/10'
                            : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {pNum}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Change Teacher */}
      {activeModal === 'CHANGE_TEACHER' && selectedSession && mounted && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-scale-up">
            <div className="p-6 bg-[#21398A] text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base uppercase tracking-wider">Đổi Giáo Viên Dạy Thế</h3>
                <p className="text-xs text-blue-100 mt-1">Lớp: {selectedSession.className} — {selectedSession.shiftDate}</p>
              </div>
              <button
                onClick={() => setActiveModal('NONE')}
                className="text-white hover:text-blue-200 font-semibold text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitTeacherChange} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Chọn giáo viên thay thế
                </label>
                <select
                  value={targetTeacher}
                  onChange={(e) => setTargetTeacher(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium"
                >
                  <option value="">-- Chọn Giáo Viên --</option>
                  {teachersList.map((tName) => (
                    <option key={tName} value={tName}>
                      {tName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phạm vi áp dụng
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="overrideType"
                      checked={overrideType === 'TODAY'}
                      onChange={() => setOverrideType('TODAY')}
                      className="text-[#21398A] focus:ring-[#21398A]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Chỉ buổi hôm nay</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Thay thế cho ngày {selectedSession.shiftDate}</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="overrideType"
                      checked={overrideType === 'FUTURE'}
                      onChange={() => setOverrideType('FUTURE')}
                      className="text-[#21398A] focus:ring-[#21398A]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tất cả các buổi từ nay về sau</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Cập nhật toàn bộ thời khóa biểu tương lai</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="overrideType"
                      checked={overrideType === 'SAME_WEEKDAY'}
                      onChange={() => setOverrideType('SAME_WEEKDAY')}
                      className="text-[#21398A] focus:ring-[#21398A]"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Cùng ngày thứ trong các tuần tới</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Ví dụ: Chỉ đổi giáo viên cho tất cả các ngày thứ này</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#21398A] hover:bg-[#152763] text-white font-bold rounded-xl text-sm transition-all shadow-md"
                >
                  {submitting ? 'Đang cập nhật...' : 'Xác nhận đổi'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('NONE')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Change On Air Support */}
      {activeModal === 'CHANGE_OA' && selectedSession && mounted && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[1100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-scale-up">
            <div className="p-6 bg-indigo-700 text-white flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base uppercase tracking-wider">Cấu Hình Trợ Giảng On Air</h3>
                <p className="text-xs text-indigo-100 mt-1">Lớp: {selectedSession.className} — {selectedSession.shiftDate}</p>
              </div>
              <button
                onClick={() => setActiveModal('NONE')}
                className="text-white hover:text-indigo-200 font-semibold text-lg focus:outline-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitOAChange} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* OA 1 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Trợ giảng On Air 1
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Họ và tên</label>
                  <select
                    value={oa1}
                    onChange={(e) => setOa1(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                  >
                    <option value="">-- Chọn Trợ giảng --</option>
                    {activeTeachers.map((tName) => (
                      <option key={tName} value={tName}>
                        {tName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ bắt đầu</label>
                    <input
                      type="text"
                      value={oa1Start}
                      onChange={(e) => setOa1Start(e.target.value)}
                      placeholder="VD: 08:00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ kết thúc</label>
                    <input
                      type="text"
                      value={oa1End}
                      onChange={(e) => setOa1End(e.target.value)}
                      placeholder="VD: 09:30"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* OA 2 */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <div className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Trợ giảng On Air 2
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Họ và tên</label>
                  <select
                    value={oa2}
                    onChange={(e) => setOa2(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                  >
                    <option value="">-- Chọn Trợ giảng --</option>
                    {activeTeachers.map((tName) => (
                      <option key={tName} value={tName}>
                        {tName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ bắt đầu</label>
                    <input
                      type="text"
                      value={oa2Start}
                      onChange={(e) => setOa2Start(e.target.value)}
                      placeholder="VD: 08:00"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Giờ kết thúc</label>
                    <input
                      type="text"
                      value={oa2End}
                      onChange={(e) => setOa2End(e.target.value)}
                      placeholder="VD: 09:30"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Phạm vi áp dụng */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Phạm vi áp dụng
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white bg-white hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="oaOverrideType"
                      checked={oaOverrideType === 'single'}
                      onChange={() => setOaOverrideType('single')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Chỉ buổi hôm nay</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Thay thế cho ngày {selectedSession.shiftDate}</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white bg-white hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="oaOverrideType"
                      checked={oaOverrideType === 'future'}
                      onChange={() => setOaOverrideType('future')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Tất cả các buổi từ nay về sau</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Cập nhật toàn bộ thời khóa biểu tương lai</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-white bg-white hover:bg-slate-50 cursor-pointer transition-all">
                    <input
                      type="radio"
                      name="oaOverrideType"
                      checked={oaOverrideType === 'weekdayFuture'}
                      onChange={() => setOaOverrideType('weekdayFuture')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">Cùng ngày thứ trong các tuần tới</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Ví dụ: Chỉ đổi trợ giảng cho tất cả các ngày thứ này</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-sm transition-all shadow-md"
                >
                  {submitting ? 'Đang lưu...' : 'Lưu trợ giảng'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('NONE')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-all"
                >
                  Hủy bỏ
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
