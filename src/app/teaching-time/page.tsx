'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { useAbortController } from '@/hooks/useAbortController';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  BookOpen,
  Calendar,
  Layers,
  MapPin,
  TrendingUp,
  Award,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SessionLog {
  className: string;
  caName: string;
  roomName: string;
  timeRange: string;
  minutes: number;
  hours: number;
  isSub: boolean;
}

interface TeacherHoursItem {
  name: string;
  sessions: number;
  totalHours: number;
  days: {
    [dateStr: string]: SessionLog[];
  };
}

function TeachingTimeContent() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const searchParams = useSearchParams();
  const teacherParam = searchParams.get('teacher') || '';

  const [loading, setLoading] = useState(true);
  const getSignal = useAbortController();
  const [viewMode, setViewMode] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [weekOffset, setWeekOffset] = useState(0);

  // Month Picker State (default: current year-month)
  const currentYM = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const [selectedYM, setSelectedYM] = useState(currentYM);

  const [data, setData] = useState<any>({ dates: [], teachers: [] });
  const [searchQuery, setSearchQuery] = useState(teacherParam);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(teacherParam || null);

  const fetchHours = useCallback(async () => {
    const signal = getSignal();
    try {
      setLoading(true);
      const email = user?.email || '';

      let action = 'getTeacherHoursForWeek';
      let payloadData: any = { weekOffset: weekOffset };

      if (viewMode === 'MONTH') {
        action = 'getTeacherHoursForMonth';
        payloadData = { ym: selectedYM };
      }

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/reports',
          method: 'POST',
          action: action,
          loginEmail: email,
          data: payloadData,
        }),
        signal,
      });

      const res = await response.json();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setData({ dates: [], teachers: [] });
      }
      setLoading(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching teaching hours:', e);
      setLoading(false);
    }
  }, [user?.email, viewMode, weekOffset, selectedYM, getSignal]);

  useEffect(() => {
    if (user?.email) {
      fetchHours();
    }
  }, [user?.email, viewMode, weekOffset, selectedYM, fetchHours]);

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Thời gian dạy' }
    ]);
  }, [setBreadcrumbs]);

  // Aggregate statistics
  const teachersCount = data.teachers?.length || 0;
  const totalSessions = data.teachers?.reduce((sum: number, t: TeacherHoursItem) => sum + t.sessions, 0) || 0;
  const totalHours = data.teachers?.reduce((sum: number, t: TeacherHoursItem) => sum + t.totalHours, 0) || 0;

  // Filter teachers by search query
  const filteredTeachers = (data.teachers || []).filter((t: TeacherHoursItem) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (teacherName: string) => {
    if (expandedTeacher === teacherName) {
      setExpandedTeacher(null);
    } else {
      setExpandedTeacher(teacherName);
    }
  };

  const getRangeLabel = () => {
    if (viewMode === 'WEEK') {
      if (data.dates?.length === 0) return 'Đang tải...';
      return `Tuần từ ${data.dates[0]} đến ${data.dates[data.dates.length - 1]}`;
    } else {
      const parts = selectedYM.split('-');
      return `Tháng ${parts[1]}/${parts[0]}`;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Clock size={28} className="text-[#21398A]" />
            <span>Thống Kê Giờ Dạy</span>
          </h1>
          <p className="text-slate-500 mt-1">
            Tra cứu tổng hợp ca dạy, thời gian đứng lớp thực tế và lịch dạy thay của toàn bộ giáo viên tại trung tâm.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('WEEK')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'WEEK'
                  ? 'bg-white text-[#21398A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Theo Tuần
            </button>
            <button
              onClick={() => setViewMode('MONTH')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'MONTH'
                  ? 'bg-white text-[#21398A] shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Theo Tháng
            </button>
          </div>

          <button
            onClick={fetchHours}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#21398A] hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-[0.98]"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Tải lại</span>
          </button>
        </div>
      </div>

      {/* Summary Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#21398A] flex items-center justify-center font-bold text-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Nhân sự tham gia</div>
            <div className="text-3xl font-extrabold text-slate-800 mt-0.5">{teachersCount} GV</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Tổng số ca dạy</div>
            <div className="text-3xl font-extrabold text-slate-800 mt-0.5">{totalSessions} ca</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
            <Award size={24} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Thời lượng đứng lớp</div>
            <div className="text-3xl font-extrabold text-slate-800 mt-0.5">{totalHours} giờ</div>
          </div>
        </div>
      </div>

      {/* Filter and navigation toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên giáo viên..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-medium transition-all"
          />
        </div>

        {/* Date / Month Picker Navigation */}
        <div className="flex items-center gap-3">
          {viewMode === 'WEEK' ? (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
              <button
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="p-1.5 text-slate-500 hover:text-[#21398A] hover:bg-white rounded-lg transition-all shadow-xs"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-extrabold text-slate-700 px-3 min-w-[120px] text-center">
                {getRangeLabel()}
              </span>
              <button
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="p-1.5 text-slate-500 hover:text-[#21398A] hover:bg-white rounded-lg transition-all shadow-xs"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Chọn tháng:</span>
              <input
                type="month"
                value={selectedYM}
                onChange={(e) => setSelectedYM(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 outline-none text-slate-800 focus:border-[#21398A] text-sm font-semibold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Teachers Hours Table / Detailed Logs */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
          <RefreshCw size={24} className="animate-spin text-[#21398A]" />
          <span>Đang tổng hợp đối soát thời lượng giảng dạy...</span>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <Clock size={48} className="text-slate-200" />
          <span>Không tìm thấy lịch sử dạy học nào.</span>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-4 px-6 text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    Tên giáo viên
                  </th>
                  <th className="py-4 px-6 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-center">
                    Tổng ca đứng lớp
                  </th>
                  <th className="py-4 px-6 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-center">
                    Tổng thời lượng dạy
                  </th>
                  <th className="py-4 px-6 text-xs font-extrabold text-slate-400 uppercase tracking-wider text-center" style={{ width: '120px' }}>
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher: TeacherHoursItem) => {
                  const isExpanded = expandedTeacher === teacher.name;

                  return (
                    <React.Fragment key={teacher.name}>
                      <tr
                        onClick={() => toggleExpand(teacher.name)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-slate-50/50' : 'hover:bg-slate-50/30'
                        }`}
                      >
                        <td className="py-4 px-6 text-sm font-extrabold text-[#21398A]">
                          {teacher.name}
                        </td>
                        <td className="py-4 px-6 text-sm font-bold text-slate-700 text-center">
                          {teacher.sessions} ca dạy
                        </td>
                        <td className="py-4 px-6 text-sm font-black text-slate-800 text-center">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50">
                            {teacher.totalHours} giờ
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="inline-flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Daily Logs Panel */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={4} className="bg-slate-50/30 p-6 border-b border-slate-100">
                            <div className="space-y-4">
                              <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Calendar size={14} />
                                <span>Nhật ký giảng dạy chi tiết — {teacher.name}</span>
                              </h4>

                              {Object.keys(teacher.days).length === 0 ? (
                                <div className="text-xs text-slate-400 italic">Chưa ghi nhận ca dạy nào.</div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {Object.keys(teacher.days).map((dateKey) => {
                                    const logs = teacher.days[dateKey];
                                    return (
                                      <div
                                        key={dateKey}
                                        className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs space-y-3"
                                      >
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                          <span className="text-xs font-bold text-[#21398A] bg-blue-50 px-2 py-0.5 rounded-md">
                                            {dateKey}
                                          </span>
                                          <span className="text-[10px] text-slate-400 font-semibold">
                                            {logs.length} ca dạy
                                          </span>
                                        </div>

                                        <div className="space-y-3">
                                          {logs.map((log: SessionLog, logIdx: number) => (
                                            <div
                                              key={logIdx}
                                              className={`text-xs space-y-1.5 p-2.5 rounded-lg border ${
                                                log.isSub
                                                  ? 'bg-amber-50/20 border-amber-100'
                                                  : 'bg-slate-50/50 border-slate-100'
                                              }`}
                                            >
                                              <div className="flex justify-between items-start">
                                                <span className="font-extrabold text-slate-800">
                                                  {log.className}
                                                </span>
                                                {log.isSub && (
                                                  <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wide">
                                                    DẠY THAY
                                                  </span>
                                                )}
                                              </div>

                                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <Layers size={10} />
                                                <span>Ca: {log.caName} ({log.timeRange})</span>
                                              </div>

                                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                <MapPin size={10} />
                                                <span>Phòng: {log.roomName || '—'}</span>
                                              </div>

                                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-600 border-t border-slate-100/50 pt-1.5">
                                                <span>Thời lượng:</span>
                                                <span className="text-[#21398A]">
                                                  {log.hours} giờ ({log.minutes} phút)
                                                </span>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeachingTimePage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#21398A]" />
        <span>Đang khởi động module thống kê...</span>
      </div>
    }>
      <TeachingTimeContent />
    </Suspense>
  );
}
