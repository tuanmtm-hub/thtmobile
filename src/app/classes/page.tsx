'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { usePagination } from '@/hooks/usePagination';
import { useAuth } from '@/context/AuthContext';
import { useAbortController } from '@/hooks/useAbortController';
import { useClassesPageData, useClassRoster } from '@/hooks/useGasData';
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
  Plus,
  ClipboardCheck,
  Edit,
  Check,
  X,
  Users,
  Trash2,
  Info,
  Pause,
  Mail,
  FileSpreadsheet,
  ChevronLeft,
  UploadCloud,
  Shield,
  FileText,
  Eye
} from 'lucide-react';
import { renderLocalEmailTemplate } from '@/utils/emailTemplates';
import AnimatedNumber from '@/components/AnimatedNumber';

interface ClassItem {
  id: string;
  name: string;
  khoiId: string;
  nhomId: string;
  studyType: string; // 'Theo tháng' | 'Theo khóa' | 'Theo giờ'
  startDate: string;
  endDate: string;
  teacher: string;
  status: string; // 'Đang học' | 'Chờ lớp' | 'Kết thúc' | ...
  room: string;
  ca: string;
  fee: number;
  note: string;
  businessBlock: string;
  course: string;
  roomCaMapStr: string;
  totalStudents?: number;
  trialStudents?: number;
}

interface HolidayItem {
  name: string;
  start: string;
  end: string;
  scope: string; // 'ALL' | 'CLASS'
  classes: string;
}

const isEnglishTeacher = (dept?: string) => {
  if (!dept) return false;
  return dept.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === 'tieng anh';
};

const normalizeHeaderKey = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const findHeaderIndex = (headers: string[], names: string[]) => {
  const wanted = new Set(names.map(normalizeHeaderKey));
  return headers.findIndex((h) => wanted.has(normalizeHeaderKey(h)));
};

const getCourseFromStartDate = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    return `${parts[1]}/${parts[0]}`; // MM/YYYY
  }
  return '';
};

const parseTimeToMinutes = (timeStr: string) => {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  }
  return 0;
};

const formatAnyDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const s = String(dateStr).trim();

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s;
  }

  if (s.includes(' ') && isNaN(Number(s))) {
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    } catch (e) { }
  }

  if (s.includes('T')) {
    const datePart = s.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }

  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
  }

  return s;
};

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

const isClassPastEndDate = (endDateStr: string): boolean => {
  if (!endDateStr) return false;
  const end = parseToDate(endDateStr);
  const today = new Date();
  end.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return end < today;
};

const formatHeaderDate = (dateStr: string): { dateDisplay: string; caName: string } => {
  if (!dateStr) return { dateDisplay: '', caName: '' };

  let rawDate = dateStr.trim();
  let caPart = '';

  const match = rawDate.match(/^([^(]+)\(([^)]+)\)/);
  if (match) {
    rawDate = match[1].trim();
    caPart = match[2].trim();
  }

  return {
    dateDisplay: formatAnyDate(rawDate),
    caName: caPart
  };
};

const isClassStatusEnded = (status: string) => {
  const s = String(status || '').trim().toLowerCase();
  return s.includes('káº¿t thÃºc') || s.includes('ket thuc') || s.includes('Ä‘Ã£ dá»«ng');
};

const validateClassForm = (startDate: string, endDate: string, scheduleConfig: any): boolean => {
  if (!startDate || !endDate) {
    alert('Vui lòng nhập đầy đủ Ngày bắt đầu và Ngày kết thúc lớp học!');
    return false;
  }

  if (new Date(endDate) <= new Date(startDate)) {
    alert('Ngày kết thúc lớp học bắt buộc phải lớn hơn Ngày bắt đầu!');
    return false;
  }

  let timeConflict = false;
  Object.values(scheduleConfig).forEach((sessions: any) => {
    sessions.forEach((s: any) => {
      if (s.oa1 && s.oa1Start && s.oa1End) {
        if (parseTimeToMinutes(s.oa1End) <= parseTimeToMinutes(s.oa1Start)) timeConflict = true;
      }
      if (s.oa2 && s.oa2Start && s.oa2End) {
        if (parseTimeToMinutes(s.oa2End) <= parseTimeToMinutes(s.oa2Start)) timeConflict = true;
      }
    });
  });

  if (timeConflict) {
    alert('Thời gian kết thúc ca dạy của Giáo viên On-Air bắt buộc phải lớn hơn Thời gian bắt đầu!');
    return false;
  }

  return true;
};

const formatDateForInput = (dateStr: string): string => {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const parts = s.split('/');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) { }
  return '';
};

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

interface PortalProps {
  children: React.ReactNode;
}

const Portal = ({ children }: PortalProps) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

interface EmailPreviewModalProps {
  show: boolean;
  onClose: () => void;
  loading: boolean;
  initialRecipients: string[];
  initialSubject: string;
  initialHtml: string;
  selectedClass: any;
  teachersList: any[];
  onConfirm: (recipients: string[], subject: string, html: string) => Promise<void>;
}

const EmailPreviewModal = ({
  show,
  onClose,
  loading,
  initialRecipients,
  initialSubject,
  initialHtml,
  selectedClass,
  teachersList,
  onConfirm
}: EmailPreviewModalProps) => {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [emailSubjectInput, setEmailSubjectInput] = useState('');
  const [emailHtmlInput, setEmailHtmlInput] = useState('');
  const emailHtmlRef = React.useRef<HTMLDivElement>(null);

  // Sync state with parent's fetched templates when loading finishes
  useEffect(() => {
    if (show && !loading) {
      setRecipients(initialRecipients || []);
      setEmailSubjectInput(initialSubject || '');
      setEmailHtmlInput(initialHtml || '');
      setNewRecipientEmail('');
    }
  }, [show, loading, initialRecipients, initialSubject, initialHtml]);

  if (!show) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" style={{ zIndex: 1200 }} onClick={onClose}>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-4xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-155 flex items-center justify-between bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#21398A]"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
              Biên tập & Gửi email thông báo cho Giáo viên
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
              <X size={18} />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-8 h-8 border-4 border-[#21398A] border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-400 font-bold">Đang sinh bản dịch email...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Người nhận (Email Recipients) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Người nhận (Email Recipients)</label>
                  <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
                    {recipients.map((rec) => (
                      <span key={rec} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-[#21398A] border border-blue-200 rounded-lg text-xs font-extrabold shadow-xs">
                        <span>{rec}</span>
                        <button
                          type="button"
                          onClick={() => setRecipients(prev => prev.filter(r => r !== rec))}
                          className="text-blue-400 hover:text-blue-600 font-black transition-colors ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="flex-1 min-w-[200px] flex gap-2">
                      <input
                        type="email"
                        value={newRecipientEmail}
                        onChange={(e) => setNewRecipientEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = newRecipientEmail.trim().toLowerCase();
                            if (trimmed && trimmed.includes('@') && !recipients.includes(trimmed)) {
                              setRecipients(prev => [...prev, trimmed]);
                              setNewRecipientEmail('');
                            }
                          }
                        }}
                        placeholder="Thêm email người nhận (nhấn Enter)..."
                        className="flex-1 bg-transparent border-0 outline-none text-xs text-slate-700 font-semibold placeholder-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newRecipientEmail.trim().toLowerCase();
                          if (trimmed && trimmed.includes('@') && !recipients.includes(trimmed)) {
                            setRecipients(prev => [...prev, trimmed]);
                            setNewRecipientEmail('');
                          }
                        }}
                        className="px-2.5 py-1 bg-[#21398A] text-white rounded-lg text-xs font-bold hover:bg-[#1a2d6e] transition-colors"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>

                  {/* Nhóm email nhận tin nhanh */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 pt-1">
                    <span>Thêm nhanh theo nhóm:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClass) {
                          const gvcnObj = teachersList.find(t => t.name === selectedClass.teacher || t.id === selectedClass.teacher);
                          const gvcnEmail = gvcnObj?.email;
                          if (gvcnEmail && !recipients.includes(gvcnEmail)) {
                            setRecipients(prev => [...prev, gvcnEmail]);
                          } else if (selectedClass.teacher && selectedClass.teacher.includes('@') && !recipients.includes(selectedClass.teacher)) {
                            setRecipients(prev => [...prev, selectedClass.teacher]);
                          }
                        }
                      }}
                      className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-150 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                    >
                      + GV Chủ nhiệm ({selectedClass?.teacher || 'Chưa phân công'})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newEmails: string[] = [];
                        teachersList.forEach((t) => {
                          if (t.dept && t.dept.toLowerCase().trim() === 'tư vấn' && t.email) {
                            if (!newEmails.includes(t.email)) {
                              newEmails.push(t.email);
                            }
                          }
                        });
                        if (newEmails.length > 0) {
                          setRecipients(prev => [...prev, ...newEmails].filter((v, i, a) => a.indexOf(v) === i));
                        }
                      }}
                      className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-150 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer"
                    >
                      + Bộ phận Tư vấn
                    </button>
                  </div>
                </div>

                {/* Tiêu đề Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tiêu đề Email (Subject)</label>
                  <input
                    type="text"
                    value={emailSubjectInput}
                    onChange={(e) => setEmailSubjectInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-800"
                    placeholder="Nhập tiêu đề email..."
                  />
                </div>

                {/* Nội dung thư (Preview) */}
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nội dung thư xem trước (Email Content Preview)</label>
                    <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/50 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      Có thể click trực tiếp vào văn bản để sửa
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50 focus-within:ring-2 focus-within:ring-[#21398A]/20 focus-within:border-[#21398A]">
                    <div className="p-4 overflow-y-auto max-h-[400px] bg-white text-slate-800" style={{ fontFamily: 'Inter, sans-serif' }}>
                      <div
                        ref={emailHtmlRef}
                        contentEditable
                        suppressContentEditableWarning
                        dangerouslySetInnerHTML={{ __html: emailHtmlInput }}
                        className="outline-none min-h-[250px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-155 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
              Quay lại chỉnh sửa
            </button>
            <button
              onClick={async () => {
                const finalHtml = emailHtmlRef.current ? emailHtmlRef.current.innerHTML : emailHtmlInput;
                await onConfirm(recipients, emailSubjectInput, finalHtml);
              }}
              disabled={loading || recipients.length === 0}
              className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/20 cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Xác nhận gửi Email & Hoàn tất</span>
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

interface ScheduleGridProps {
  filteredGridShifts: any[];
  filteredGridRooms: any[];
  occupancyMap: any;
  selectedSet: Set<string>;
  conflictMap: any;
  activeConfigDay: number;
  toggleCellSelection: (dayNum: number, roomId: string, caId: string) => void;
}

const ScheduleGrid = React.memo(({
  filteredGridShifts,
  filteredGridRooms,
  occupancyMap,
  selectedSet,
  conflictMap,
  activeConfigDay,
  toggleCellSelection
}: ScheduleGridProps) => {
  if (filteredGridShifts.length === 0 || filteredGridRooms.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-xs font-medium">
        Không tìm thấy phòng hoặc ca học nào khớp với từ khóa tìm kiếm.
      </div>
    );
  }

  return (
    <table className="min-w-full text-xs text-left table-fixed border-separate border-spacing-0">
      <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-20">
        <tr>
          <th className="px-3 py-2.5 border-b border-r border-slate-200 bg-slate-50 w-[140px] shrink-0 sticky left-0 top-0 z-30 font-extrabold text-slate-700 shadow-[1px_1px_0_0_#e2e8f0]">
            Ca học
          </th>
          {filteredGridRooms.map((room) => (
            <th key={room.id} className="px-3 py-2.5 text-center border-b border-r border-slate-200 bg-slate-50 w-[110px] font-extrabold text-slate-700 shadow-[0_1px_0_0_#e2e8f0]">
              {room.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {filteredGridShifts.map((shift) => (
          <tr key={shift.id} className="hover:bg-slate-50/50">
            <td className="px-3 py-2 font-bold text-slate-700 bg-slate-50 sticky left-0 z-10 border-b border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
              <div className="text-slate-800 text-xs font-bold leading-tight">{shift.name}</div>
              <div className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-none">{shift.startTime} - {shift.endTime}</div>
            </td>
            {filteredGridRooms.map((room) => {
              const occupant = occupancyMap[room.id]?.[shift.id];
              const selected = selectedSet.has(`${shift.id}::${room.id}`);
              const conflicts = conflictMap[`${room.id}::${shift.id}`] || [];

              return (
                <td
                  key={room.id}
                  className={`px-1.5 py-1.5 text-center border-b border-r border-slate-200 last:border-r-0 transition-all ${occupant ? 'cursor-not-allowed bg-slate-50/5' : 'cursor-pointer active:scale-98'
                    }`}
                  onClick={() => !occupant && toggleCellSelection(activeConfigDay, room.id, shift.id)}
                >
                  {occupant ? (
                    occupant.isExact ? (
                      <div
                        className="mx-auto inline-flex items-center justify-center px-1.5 py-1 bg-rose-50 text-rose-700 rounded-lg border border-rose-100 font-bold text-[9px] w-full truncate leading-tight"
                        title={`Bị chiếm bởi lớp ${occupant.className}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mr-1"></span>
                        <span className="truncate">{occupant.className}</span>
                      </div>
                    ) : (
                      <div
                        className="mx-auto inline-flex items-center justify-center px-1.5 py-1 bg-amber-50 text-amber-700 rounded-lg border border-amber-200/80 font-bold text-[9px] w-full truncate leading-tight"
                        title={`Trùng khung giờ: Lớp ${occupant.className}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mr-1"></span>
                        <span className="truncate">{occupant.className}</span>
                      </div>
                    )
                  ) : selected ? (
                    <div
                      className="mx-auto inline-flex items-center justify-center px-1.5 py-1 bg-[#21398A] text-white rounded-lg border border-[#21398A] font-bold text-[9px] shadow-xs animate-pulse w-full leading-tight"
                      title="Đã chọn ca & phòng này"
                    >
                      <span>✓ Chọn</span>
                    </div>
                  ) : (
                    <div
                      className="mx-auto inline-flex items-center justify-center px-1.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100 font-bold text-[9px] w-full leading-tight hover:bg-emerald-100/50 transition-colors"
                      title="Nhấp để chọn ca & phòng này"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mr-1"></span>
                      <span>Trống</span>
                    </div>
                  )}

                  {/* Cảnh báo trùng lịch cho các ca đã chọn nếu có xung đột */}
                  {!occupant && selected && conflicts.length > 0 && (
                    <div className="mt-0.5 text-[8px] text-amber-600 font-bold block w-full truncate animate-bounce" title={`Trùng lịch với lớp: ${conflicts.join(', ')}`}>
                      ⚠️ Trùng: {conflicts.join(', ')}
                    </div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});
ScheduleGrid.displayName = 'ScheduleGrid';

function ClassesContent() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();
  const userPerms = user?.permissions || {};
  const isAdmin = user?.role === 'Admin' || userPerms['perm_admin'] === true;

  const [showPermModal, setShowPermModal] = useState(false);

  const checkPermission = (permKey: string) => {
    if (isAdmin) return true;
    if (userPerms[permKey] === true) return true;
    setShowPermModal(true);
    return false;
  };

  const searchParams = useSearchParams();
  const classIdParam = searchParams.get('id');
  const getClassesSignal = useAbortController();
  const getRosterSignal = useAbortController();
  const getAttendanceSignal = useAbortController();

  const {
    classes,
    levels,
    groups,
    roomsList,
    shiftsList,
    teachersList,
    holidays,
    allStudentsList,
    isLoading,
    refresh
  } = useClassesPageData(user?.email);

  const [actionLoading, setActionLoading] = useState(false);
  const loading = isLoading || actionLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'pending' | 'ended'
  const [totalSessions, setTotalSessions] = useState<number>(0);

  const getCaName = useCallback((caIdOrName: string) => {
    if (!caIdOrName) return '';
    const shift = shiftsList.find(s =>
      String(s.id).trim().toLowerCase() === caIdOrName.trim().toLowerCase() ||
      String(s.name).trim().toLowerCase() === caIdOrName.trim().toLowerCase()
    );
    return shift ? shift.name : caIdOrName;
  }, [shiftsList]);

  // SidePanel Open/Close States
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Điều hướng và Tabs toàn màn hình
  const [activeView, setActiveView] = useState<'list' | 'detail' | 'bulk-report'>('list');
  const [detailTab, setDetailTab] = useState<'roster' | 'evals'>('roster');

  // Quản lý email chỉnh sửa và danh sách người nhận
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  const [emailSubjectInput, setEmailSubjectInput] = useState('');
  const [emailHtmlInput, setEmailHtmlInput] = useState('');

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



  // Class Roster States
  const { rosterData, isLoading: swrLoadingRoster, mutate: mutateRoster } = useClassRoster(
    selectedClass?.name || '',
    user?.email
  );

  const [rosterStudents, setRosterStudents] = useState<any[]>([]);
  const [rosterAttendanceHeaders, setRosterAttendanceHeaders] = useState<string[]>([]);

  useEffect(() => {
    if (rosterData) {
      setRosterStudents(rosterData.students || []);
      setRosterAttendanceHeaders(rosterData.attendanceHeaders || []);
    } else {
      setRosterStudents([]);
      setRosterAttendanceHeaders([]);
    }
  }, [rosterData]);

  const loadingRoster = swrLoadingRoster;
  const [selectedRosterStudents, setSelectedRosterStudents] = useState<string[]>([]);
  const rosterStudentNames = useMemo(
    () => rosterStudents.map((s) => String(s.name || '').trim()).filter(Boolean),
    [rosterStudents]
  );
  const validSelectedRosterStudents = useMemo(
    () => selectedRosterStudents.filter((name) => rosterStudentNames.includes(name)),
    [selectedRosterStudents, rosterStudentNames]
  );

  useEffect(() => {
    setSelectedRosterStudents((prev) => {
      const next = prev.filter((name) => rosterStudentNames.includes(name));
      return next.length === prev.length ? prev : next;
    });
  }, [rosterStudentNames]);

  // Delete Attendance Modal
  const [showDeleteAttendanceModal, setShowDeleteAttendanceModal] = useState(false);
  const [deleteAttendanceDate, setDeleteAttendanceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [savingDeleteAttendance, setSavingDeleteAttendance] = useState(false);

  // Single Student Eval Modal (Roster)
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalStudentInfo, setEvalStudentInfo] = useState<{
    id: string;
    name: string;
    enrollId: string;
    className: string;
    currentNote: string;
  } | null>(null);
  const [newEvalNote, setNewEvalNote] = useState('');
  const [savingEval, setSavingEval] = useState(false);

  // Bulk Email / Report Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailType, setEmailType] = useState<'bulk' | 'report'>('bulk');
  const [savingEmail, setSavingEmail] = useState(false);

  // Bulk / Single Transfer & Stop Modals in Class Page
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferStudent, setTransferStudent] = useState<any | null>(null);
  const [transferStudentActiveClasses, setTransferStudentActiveClasses] = useState<string[]>([]);
  const [transferNewClassName, setTransferNewClassName] = useState('');
  const [transferNewStatus, setTransferNewStatus] = useState('Đang học');
  const [transferNote, setTransferNote] = useState('');
  const [transferSendEmail, setTransferSendEmail] = useState(true);
  const [savingTransfer, setSavingTransfer] = useState(false);

  const [showStopModal, setShowStopModal] = useState(false);
  const [stopStudent, setStopStudent] = useState<any | null>(null);
  const [stopStatus, setStopStatus] = useState('Tạm ngưng');
  const [stopDate, setStopDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [stopReason, setStopReason] = useState('');
  const [savingStop, setSavingStop] = useState(false);

  // Email Preview state hooks
  const [stopSendEmail, setStopSendEmail] = useState(true);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [emailPreviewSubject, setEmailPreviewSubject] = useState('');
  const [emailPreviewHtml, setEmailPreviewHtml] = useState('');
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);
  const [pendingEmailAction, setPendingEmailAction] = useState<(recipients?: string[], subject?: string, html?: string) => Promise<void>>(() => async () => { });

  // States và hàm giả lập tiến trình gửi email khi Chuyển lớp & Dừng học
  const [sendingEmailProgress, setSendingEmailProgress] = useState<number | null>(null);
  const [emailSendSuccess, setEmailSendSuccess] = useState(false);
  const [progressStatusTitle, setProgressStatusTitle] = useState('');
  const [progressSuccessTitle, setProgressSuccessTitle] = useState('');

  const runProgressSimulation = async (
    sendAction: () => Promise<void>,
    statusTitle: string,
    successTitle: string
  ) => {
    setSendingEmailProgress(1);
    setEmailSendSuccess(false);
    setProgressStatusTitle(statusTitle);
    setProgressSuccessTitle(successTitle);

    let currentProgress = 1;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 5) + 2;
      if (currentProgress >= 95) {
        currentProgress = 95;
        clearInterval(interval);
      }
      setSendingEmailProgress(currentProgress);
    }, 100);

    try {
      await sendAction();

      clearInterval(interval);
      setSendingEmailProgress(100);

      await new Promise(resolve => setTimeout(resolve, 300));
      setSendingEmailProgress(null);
      setEmailSendSuccess(true);

      setTimeout(() => {
        setEmailSendSuccess(false);
      }, 2000);
    } catch (err: any) {
      clearInterval(interval);
      setSendingEmailProgress(null);
      alert(err.message || 'Có lỗi xảy ra khi thực hiện!');
    }
  };
  const emailHtmlRef = React.useRef<HTMLDivElement>(null);

  // States cho tính năng gửi báo cáo hàng loạt (Bulk Report)
  const [bulkReportSubject, setBulkReportSubject] = useState('');
  const [bulkReportBody, setBulkReportBody] = useState('');
  const [bulkReportFiles, setBulkReportFiles] = useState<Record<string, File | null>>({});
  const [bulkReportStatuses, setBulkReportStatuses] = useState<Record<string, 'pending' | 'sending' | 'sent' | 'error'>>({});
  const [bulkReportSubjects, setBulkReportSubjects] = useState<Record<string, string>>({});
  const [bulkReportBodies, setBulkReportBodies] = useState<Record<string, string>>({});
  const [showBulkSinglePreview, setShowBulkSinglePreview] = useState(false);
  const [bulkSinglePreviewHtml, setBulkSinglePreviewHtml] = useState('');
  const [bulkSinglePreviewSubject, setBulkSinglePreviewSubject] = useState('');
  const [bulkSinglePreviewStudentName, setBulkSinglePreviewStudentName] = useState('');
  const [loadingSinglePreview, setLoadingSinglePreview] = useState(false);

  // States cho tiến trình gửi báo cáo hàng loạt (Progress Modal)
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressCurrent, setProgressCurrent] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [progressStudentName, setProgressStudentName] = useState('');

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
  const [attendanceStudents, setAttendanceStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [attendanceStates, setAttendanceStates] = useState<Record<string, 'A' | 'C' | 'K'>>({});
  const [attendanceShifts, setAttendanceShifts] = useState<{ ca: string; time: string; onAir1?: string; onAir2?: string }[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Form inputs states for Add/Edit
  const [className, setClassName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedKhoiId, setSelectedKhoiId] = useState('');
  const [selectedNhomId, setSelectedNhomId] = useState('');
  const [studyType, setStudyType] = useState('Theo tháng');
  const [fee, setFee] = useState(0);
  const [businessBlock, setBusinessBlock] = useState('Lê Hồng Phong'); // Default to Lê Hồng Phong
  const [teacherId, setTeacherId] = useState('');
  const [status, setStatus] = useState('Đang học'); // Default to Đang học
  const [course, setCourse] = useState('');
  const isCourseOrHourly = studyType === 'Theo khóa' || studyType === 'Theo giờ';
  const [scheduleConfig, setScheduleConfig] = useState<Record<number, Array<{
    ca: string;
    time: string;
    room: string;
    oa1: string;
    oa1Start: string;
    oa1End: string;
    oa2: string;
    oa2Start: string;
    oa2End: string;
  }>>>({
    1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: []
  });

  const [submitting, setSubmitting] = useState(false);
  const [activeConfigDay, setActiveConfigDay] = useState<number>(1);
  const [dayOnAirConfig, setDayOnAirConfig] = useState<Record<number, {
    oa1: string;
    oa1Start: string;
    oa1End: string;
    oa2: string;
    oa2Start: string;
    oa2End: string;
  }>>({
    1: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    2: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    3: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    4: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    5: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    6: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    0: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
  });

  const [gridSearchQuery, setGridSearchQuery] = useState('');

  // Add student to class state
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);

  // Reopen/Clone Class state
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenClassName, setReopenClassName] = useState('');
  const [reopenStartDate, setReopenStartDate] = useState('');
  const [reopenEndDate, setReopenEndDate] = useState('');
  const [reopenTotalSessions, setReopenTotalSessions] = useState<number>(0);
  const loadingAllStudents = isLoading;
  const [selectedStudentsData, setSelectedStudentsData] = useState<Array<{ id: string; name: string; status: string; date: string }>>([]);
  const [modalStudentSearch, setModalStudentSearch] = useState('');
  const [enrollSendEmail, setEnrollSendEmail] = useState(true);
  const [savingEnroll, setSavingEnroll] = useState(false);

  // Kiểm tra ngày trùng với lịch nghỉ lễ
  const isHolidayDate = (dateObj: Date, currentClassName?: string, currentClassId?: string) => {
    const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    for (const h of holidays) {
      const start = parseToDate(h.start);
      const end = h.end ? parseToDate(h.end) : start;
      if (start.getTime() === 0) continue;

      const hStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const hEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      if (d >= hStart && d <= hEnd) {
        const scope = String(h.scope || 'ALL').trim().toUpperCase();
        const clsRaw = String(h.classes || '').trim();
        const isAll = !clsRaw || scope === 'ALL';
        if (!isAll) {
          const parts = clsRaw.split(/[,;\n]/).map(x => x.trim().toLowerCase()).filter(Boolean);
          const classNameLower = currentClassName ? currentClassName.toLowerCase() : '';
          const classIdLower = currentClassId ? currentClassId.toLowerCase() : '';
          if (parts.includes(classNameLower) || (classIdLower && parts.includes(classIdLower))) {
            return true;
          }
        } else {
          return true;
        }
      }
    }
    return false;
  };

  // Tính Ngày kết thúc động phía client
  const calculateEndDateClient = (
    startDateStr: string,
    totalSessionsCount: number,
    schedConfig: typeof scheduleConfig,
    currentClassName?: string,
    currentClassId?: string
  ): string => {
    if (!startDateStr || totalSessionsCount <= 0) return '';
    const parts = startDateStr.split('-');
    if (parts.length !== 3) return '';

    const startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    if (isNaN(startDate.getTime())) return '';

    let hasStudyDays = false;
    for (let day = 0; day < 7; day++) {
      if ((schedConfig[day] || []).length > 0) {
        hasStudyDays = true;
        break;
      }
    }
    if (!hasStudyDays) return '';

    const cur = new Date(startDate.getTime());
    let done = 0;
    let guard = 0;
    while (guard < 1000) {
      const jsDay = cur.getDay();
      const hasSession = (schedConfig[jsDay] || []).length > 0;
      if (hasSession) {
        const holiday = isHolidayDate(cur, currentClassName, currentClassId);
        if (!holiday) {
          done++;
          if (done >= totalSessionsCount) {
            const yyyy = cur.getFullYear();
            const mm = String(cur.getMonth() + 1).padStart(2, '0');
            const dd = String(cur.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return '';
  };

  // Tính số buổi hoạt động thực tế
  const countActiveSessionsClient = (
    startDateStr: string,
    endDateStr: string,
    schedConfig: typeof scheduleConfig,
    currentClassName?: string,
    currentClassId?: string
  ): number => {
    if (!startDateStr || !endDateStr) return 0;
    const startParts = startDateStr.split('-');
    const endParts = endDateStr.split('-');
    if (startParts.length !== 3 || endParts.length !== 3) return 0;

    const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));
    const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return 0;

    let count = 0;
    const cur = new Date(start.getTime());
    let guard = 0;
    while (cur <= end && guard < 1000) {
      const jsDay = cur.getDay();
      const hasSession = (schedConfig[jsDay] || []).length > 0;
      if (hasSession) {
        const holiday = isHolidayDate(cur, currentClassName, currentClassId);
        if (!holiday) {
          count++;
        }
      }
      cur.setDate(cur.getDate() + 1);
      guard++;
    }
    return count;
  };

  // useEffect tự động cập nhật Ngày kết thúc khi nhập thông tin ở Form Thêm
  useEffect(() => {
    const isCourseOrHourly = studyType === 'Theo khóa' || studyType === 'Theo giờ';
    if (isCourseOrHourly && showAddPanel) {
      const calculatedEnd = calculateEndDateClient(startDate, totalSessions, scheduleConfig, className, '');
      if (calculatedEnd) {
        setEndDate(calculatedEnd);
      }
    }
  }, [studyType, startDate, totalSessions, scheduleConfig, holidays, showAddPanel, className]);

  // useEffect tự động cập nhật Ngày kết thúc khi nhập thông tin ở Form Sửa
  useEffect(() => {
    const isCourseOrHourly = studyType === 'Theo khóa' || studyType === 'Theo giờ';
    if (isCourseOrHourly && showEditPanel && selectedClass) {
      const calculatedEnd = calculateEndDateClient(startDate, totalSessions, scheduleConfig, className, selectedClass.id);
      if (calculatedEnd) {
        setEndDate(calculatedEnd);
      }
    }
  }, [studyType, startDate, totalSessions, scheduleConfig, holidays, showEditPanel, className, selectedClass]);

  // useEffect tự động cập nhật Ngày kết thúc trong Form Mở lại / Clone lớp học
  useEffect(() => {
    if (!showReopenModal || !selectedClass) return;
    if (selectedClass.studyType === 'Theo tháng') return;

    let scheduleConfigParsed: Record<number, any[]> = {};
    try {
      if (selectedClass.roomCaMapStr) {
        scheduleConfigParsed = JSON.parse(selectedClass.roomCaMapStr);
      }
    } catch (e) { }

    const calculatedEnd = calculateEndDateClient(
      reopenStartDate,
      reopenTotalSessions,
      scheduleConfigParsed as any,
      reopenClassName,
      ''
    );
    setReopenEndDate(calculatedEnd);
  }, [showReopenModal, selectedClass, reopenStartDate, reopenTotalSessions, reopenClassName]);

  // Tính toán bản đồ chiếm dụng phòng & ca học cho một thứ cụ thể (Hỗ trợ khóa thời gian trùng lặp)
  const getOccupancyMap = (day: number, excludeClassId?: string) => {
    const map: Record<string, Record<string, { className: string; isExact: boolean } | null>> = {};
    if (!showAddPanel && !showEditPanel) {
      return map;
    }

    // Khởi tạo trạng thái trống ban đầu
    roomsList.forEach(r => {
      map[r.id] = {};
      shiftsList.forEach(s => {
        map[r.id][s.id] = null;
      });
    });

    const parseTimeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
      }
      return 0;
    };

    const parseRange = (timeStr: string) => {
      if (!timeStr) return null;
      const parts = timeStr.split('-');
      if (parts.length === 2) {
        return {
          start: parseTimeToMinutes(parts[0]),
          end: parseTimeToMinutes(parts[1])
        };
      }
      return null;
    };

    // Điền thông tin các lớp học đang hoạt động vào bản đồ
    classes.forEach(c => {
      if (excludeClassId && c.id === excludeClassId) return;
      try {
        if (c.roomCaMapStr) {
          const rawMap = JSON.parse(c.roomCaMapStr);
          const sessions = rawMap[String(day)];
          if (sessions) {
            const arr = Array.isArray(sessions) ? sessions : [sessions];
            arr.forEach((s: any) => {
              if (!s.room || !s.ca) return;

              // Tìm phòng khớp (theo ID hoặc Tên)
              const roomObj = roomsList.find(
                (r) =>
                  String(r.id).trim().toLowerCase() === String(s.room).trim().toLowerCase() ||
                  String(r.name).trim().toLowerCase() === String(s.room).trim().toLowerCase()
              );

              if (!roomObj) return;

              const isOnlineRoom =
                String(roomObj.name).trim().toUpperCase() === 'ONLINE' ||
                String(roomObj.id).trim().toUpperCase() === 'ONLINE';

              if (isOnlineRoom) return; // Bỏ qua khóa phòng ONLINE

              // Tính khung thời gian của ca học này
              const shObj = shiftsList.find(
                (sh) =>
                  String(sh.id).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
                  String(sh.name).trim().toLowerCase() === String(s.ca).trim().toLowerCase()
              );

              let start = 0;
              let end = 0;
              if (shObj) {
                start = parseTimeToMinutes(shObj.startTime);
                end = parseTimeToMinutes(shObj.endTime);
              } else {
                const range = parseRange(s.time) || parseRange(s.ca);
                if (range) {
                  start = range.start;
                  end = range.end;
                }
              }

              if (start === 0 && end === 0) return;

              // Duyệt qua tất cả các ca học trên lưới để tìm ca bị trùng thời gian trong phòng này
              shiftsList.forEach((cellShift) => {
                const cellStart = parseTimeToMinutes(cellShift.startTime);
                const cellEnd = parseTimeToMinutes(cellShift.endTime);

                // Kiểm tra giao thoa/trùng khung giờ: start < cellEnd && cellStart < end
                if (start < cellEnd && cellStart < end) {
                  if (map[roomObj.id]) {
                    const isExactShift = shObj
                      ? (cellShift.id === shObj.id)
                      : (String(cellShift.id).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
                        String(cellShift.name).trim().toLowerCase() === String(s.ca).trim().toLowerCase());

                    const existing = map[roomObj.id][cellShift.id];
                    // Ưu tiên hiển thị ca khớp chính xác (exact match)
                    if (!existing || isExactShift) {
                      map[roomObj.id][cellShift.id] = { className: c.name, isExact: isExactShift };
                    }
                  }
                }
              });
            });
          }
        }
      } catch (e) { }
    });

    return map;
  };

  // Kiểm tra xem tổ hợp Ca & Phòng này đã được chọn trong form chưa (Hỗ trợ đối chiếu cả ID, Tên và Khung giờ)
  const isSelected = (dayNum: number, caId: string, roomId: string) => {
    const sessions = scheduleConfig[dayNum] || [];
    return sessions.some((s) => {
      if (!s.room || !s.ca) return false;

      // So khớp phòng học
      const roomMatch =
        String(s.room).trim().toLowerCase() === String(roomId).trim().toLowerCase() ||
        roomsList.some(r => r.id === roomId && String(s.room).trim().toLowerCase() === String(r.name).trim().toLowerCase());

      // So khớp ca học
      const caMatch =
        String(s.ca).trim().toLowerCase() === String(caId).trim().toLowerCase() ||
        shiftsList.some(sh => sh.id === caId && (
          String(s.ca).trim().toLowerCase() === String(sh.name).trim().toLowerCase() ||
          String(s.ca).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase() ||
          (s.time && String(s.time).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase())
        ));

      return roomMatch && caMatch;
    });
  };

  // Toggle thêm hoặc xóa ca học & phòng học trực tiếp từ click trên lưới
  const toggleCellSelection = useCallback((dayNum: number, roomId: string, caId: string) => {
    const currentSessions = scheduleConfig[dayNum] || [];
    const index = currentSessions.findIndex((s) => {
      if (!s.room || !s.ca) return false;

      // So khớp phòng học
      const roomMatch =
        String(s.room).trim().toLowerCase() === String(roomId).trim().toLowerCase() ||
        roomsList.some(r => r.id === roomId && String(s.room).trim().toLowerCase() === String(r.name).trim().toLowerCase());

      // So khớp ca học
      const caMatch =
        String(s.ca).trim().toLowerCase() === String(caId).trim().toLowerCase() ||
        shiftsList.some(sh => sh.id === caId && (
          String(s.ca).trim().toLowerCase() === String(sh.name).trim().toLowerCase() ||
          String(s.ca).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase() ||
          (s.time && String(s.time).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase())
        ));

      return roomMatch && caMatch;
    });

    let updatedSessions = [...currentSessions];
    if (index > -1) {
      // Đã chọn rồi -> Xóa đi (hủy chọn)
      updatedSessions.splice(index, 1);
    } else {
      // Chưa chọn -> Thêm vào
      const shiftObj = shiftsList.find((s) => s.id === caId || s.name === caId);
      const timeStr = shiftObj ? `${shiftObj.startTime} - ${shiftObj.endTime}` : '';
      updatedSessions.push({
        ca: caId,
        time: timeStr,
        room: roomId,
        oa1: '',
        oa1Start: shiftObj ? shiftObj.startTime : '',
        oa1End: shiftObj ? shiftObj.endTime : '',
        oa2: '',
        oa2Start: '',
        oa2End: ''
      });
    }

    setScheduleConfig((prev) => ({
      ...prev,
      [dayNum]: updatedSessions
    }));
  }, [scheduleConfig, roomsList, shiftsList]);

  // Availability Conflict Detector (Kiểm tra trùng phòng và ca học, hỗ trợ kiểm tra giao thoa thời gian)
  const checkConflict = (day: number, roomId: string, caId: string, excludeClassId?: string) => {
    if (!showAddPanel && !showEditPanel) {
      return [];
    }
    if (!roomId || !caId) return [];

    // Bypass conflict check for ONLINE room
    const isOnlineRoom = roomsList.some(r => r.id === roomId && (String(r.name).trim().toUpperCase() === 'ONLINE' || String(r.id).trim().toUpperCase() === 'ONLINE'));
    if (isOnlineRoom) return [];

    const conflictingClasses: string[] = [];

    const parseTimeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
      }
      return 0;
    };

    const parseRange = (timeStr: string) => {
      if (!timeStr) return null;
      const parts = timeStr.split('-');
      if (parts.length === 2) {
        return {
          start: parseTimeToMinutes(parts[0]),
          end: parseTimeToMinutes(parts[1])
        };
      }
      return null;
    };

    const checkShift = shiftsList.find(
      (sh) =>
        String(sh.id).trim().toLowerCase() === String(caId).trim().toLowerCase() ||
        String(sh.name).trim().toLowerCase() === String(caId).trim().toLowerCase()
    );
    if (!checkShift) return [];

    const checkStart = parseTimeToMinutes(checkShift.startTime);
    const checkEnd = parseTimeToMinutes(checkShift.endTime);

    classes.forEach((c) => {
      if (excludeClassId && c.id === excludeClassId) return;
      try {
        if (c.roomCaMapStr) {
          const map = JSON.parse(c.roomCaMapStr);
          const sessions = map[String(day)];
          if (sessions) {
            const arr = Array.isArray(sessions) ? sessions : [sessions];
            arr.forEach((s: any) => {
              if (!s.room || !s.ca) return;

              // So khớp phòng học
              const roomMatch =
                String(s.room).trim().toLowerCase() === String(roomId).trim().toLowerCase() ||
                roomsList.some(r => r.id === roomId && String(s.room).trim().toLowerCase() === String(r.name).trim().toLowerCase());

              if (!roomMatch) return;

              // Lấy thời gian của ca học trong danh sách
              const shObj = shiftsList.find(
                (sh) =>
                  String(sh.id).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
                  String(sh.name).trim().toLowerCase() === String(s.ca).trim().toLowerCase()
              );

              let start = 0;
              let end = 0;
              if (shObj) {
                start = parseTimeToMinutes(shObj.startTime);
                end = parseTimeToMinutes(shObj.endTime);
              } else {
                const range = parseRange(s.time) || parseRange(s.ca);
                if (range) {
                  start = range.start;
                  end = range.end;
                }
              }

              if (start === 0 && end === 0) return;

              // Kiểm tra xem có giao thoa thời gian không
              if (start < checkEnd && checkStart < end) {
                conflictingClasses.push(c.name);
              }
            });
          }
        }
      } catch (e) { }
    });
    return conflictingClasses;
  };

  // Memoized computations for performance optimization
  const occupancyMap = useMemo(() => {
    return getOccupancyMap(activeConfigDay, selectedClass?.id);
  }, [activeConfigDay, showAddPanel, showEditPanel, classes, roomsList, shiftsList, selectedClass?.id]);

  const selectedSet = useMemo(() => {
    const set = new Set<string>();
    if (!showAddPanel && !showEditPanel) return set;

    const sessions = scheduleConfig[activeConfigDay] || [];
    sessions.forEach((s) => {
      if (!s.room || !s.ca) return;

      const matchingRoomIds = roomsList.filter(r =>
        String(s.room).trim().toLowerCase() === String(r.id).trim().toLowerCase() ||
        String(s.room).trim().toLowerCase() === String(r.name).trim().toLowerCase()
      ).map(r => r.id);

      if (matchingRoomIds.length === 0) {
        matchingRoomIds.push(s.room);
      }

      const matchingShiftIds = shiftsList.filter(sh =>
        String(s.ca).trim().toLowerCase() === String(sh.id).trim().toLowerCase() ||
        String(s.ca).trim().toLowerCase() === String(sh.name).trim().toLowerCase() ||
        String(s.ca).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase() ||
        (s.time && String(s.time).trim().toLowerCase() === `${sh.startTime.trim()} - ${sh.endTime.trim()}`.toLowerCase())
      ).map(sh => sh.id);

      if (matchingShiftIds.length === 0) {
        matchingShiftIds.push(s.ca);
      }

      matchingShiftIds.forEach(shId => {
        matchingRoomIds.forEach(rId => {
          set.add(`${shId}::${rId}`);
        });
      });
    });

    return set;
  }, [activeConfigDay, showAddPanel, showEditPanel, scheduleConfig, roomsList, shiftsList]);

  const conflictMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    if (!showAddPanel && !showEditPanel) {
      return map;
    }

    const excludeClassId = selectedClass?.id;
    const dayStr = String(activeConfigDay);

    const parseTimeToMinutes = (timeStr: string) => {
      if (!timeStr) return 0;
      const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
      if (match) {
        const hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        return hours * 60 + minutes;
      }
      return 0;
    };

    const parseRange = (timeStr: string) => {
      if (!timeStr) return null;
      const parts = timeStr.split('-');
      if (parts.length === 2) {
        return {
          start: parseTimeToMinutes(parts[0]),
          end: parseTimeToMinutes(parts[1])
        };
      }
      return null;
    };

    const parsedShifts = shiftsList.map(sh => ({
      id: sh.id,
      name: sh.name,
      start: parseTimeToMinutes(sh.startTime),
      end: parseTimeToMinutes(sh.endTime)
    }));

    classes.forEach((c) => {
      if (excludeClassId && c.id === excludeClassId) return;
      if (!c.roomCaMapStr) return;
      try {
        const parsedMap = JSON.parse(c.roomCaMapStr);
        const sessions = parsedMap[dayStr];
        if (!sessions) return;
        const arr = Array.isArray(sessions) ? sessions : [sessions];

        arr.forEach((s: any) => {
          if (!s.room || !s.ca) return;

          const matchedRooms = roomsList.filter(r => {
            const isMatch = String(s.room).trim().toLowerCase() === String(r.id).trim().toLowerCase() ||
              String(s.room).trim().toLowerCase() === String(r.name).trim().toLowerCase();
            const isOnline = String(r.name).trim().toUpperCase() === 'ONLINE' || String(r.id).trim().toUpperCase() === 'ONLINE';
            return isMatch && !isOnline; // Bỏ qua ONLINE
          });

          if (matchedRooms.length === 0) return;

          const shObj = shiftsList.find(
            (sh) =>
              String(sh.id).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
              String(sh.name).trim().toLowerCase() === String(s.ca).trim().toLowerCase()
          );

          let start = 0;
          let end = 0;
          if (shObj) {
            start = parseTimeToMinutes(shObj.startTime);
            end = parseTimeToMinutes(shObj.endTime);
          } else {
            const range = parseRange(s.time) || parseRange(s.ca);
            if (range) {
              start = range.start;
              end = range.end;
            }
          }

          if (start === 0 && end === 0) return;

          parsedShifts.forEach((cellShift) => {
            if (start < cellShift.end && cellShift.start < end) {
              matchedRooms.forEach(room => {
                const key = `${room.id}::${cellShift.id}`;
                if (!map[key]) {
                  map[key] = [];
                }
                if (!map[key].includes(c.name)) {
                  map[key].push(c.name);
                }
              });
            }
          });
        });
      } catch (e) { }
    });

    return map;
  }, [activeConfigDay, showAddPanel, showEditPanel, classes, roomsList, shiftsList, selectedClass?.id]);

  const { filteredGridRooms, filteredGridShifts } = useMemo<{
    filteredGridRooms: Array<{ id: string; name: string }>;
    filteredGridShifts: Array<{ id: string; name: string; startTime: string; endTime: string }>;
  }>(() => {
    const q = gridSearchQuery.toLowerCase().trim();
    if (!showAddPanel && !showEditPanel) {
      return { filteredGridRooms: roomsList, filteredGridShifts: shiftsList };
    }
    if (!q) {
      return { filteredGridRooms: roomsList, filteredGridShifts: shiftsList };
    }

    const hasRoomMatches = roomsList.some(r => r.name.toLowerCase().includes(q));
    const hasShiftMatches = shiftsList.some(s => s.name.toLowerCase().includes(q) || s.startTime.includes(q) || s.endTime.includes(q));
    const hasOccupantMatches = roomsList.some(r => shiftsList.some(s => occupancyMap[r.id]?.[s.id]?.className?.toLowerCase().includes(q)));

    let finalRooms = roomsList;
    if (hasRoomMatches || hasOccupantMatches) {
      finalRooms = roomsList.filter(r =>
        r.name.toLowerCase().includes(q) ||
        shiftsList.some(s => occupancyMap[r.id]?.[s.id]?.className?.toLowerCase().includes(q))
      );
    } else if (hasShiftMatches) {
      finalRooms = roomsList;
    } else {
      finalRooms = [];
    }

    let finalShifts = shiftsList;
    if (hasShiftMatches || hasOccupantMatches) {
      finalShifts = shiftsList.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.startTime.includes(q) ||
        s.endTime.includes(q) ||
        roomsList.some(r => occupancyMap[r.id]?.[s.id]?.className?.toLowerCase().includes(q))
      );
    } else if (hasRoomMatches) {
      finalShifts = shiftsList;
    } else {
      finalShifts = [];
    }

    return { filteredGridRooms: finalRooms, filteredGridShifts: finalShifts };
  }, [gridSearchQuery, occupancyMap, roomsList, shiftsList, showAddPanel, showEditPanel]);

  // Reset Add/Edit Form State
  const resetForm = () => {
    setClassName('');
    setStartDate('');
    setEndDate('');
    setSelectedKhoiId('');
    setSelectedNhomId('');
    setStudyType('Theo tháng');
    setTotalSessions(0);
    setFee(0);
    setBusinessBlock('Lê Hồng Phong');
    setTeacherId('');
    setStatus('Đang học');
    setCourse('');
    setScheduleConfig({
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: []
    });
    setDayOnAirConfig({
      1: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      2: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      3: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      4: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      5: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      6: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      0: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    });
    setActiveConfigDay(1);
    setGridSearchQuery('');
  };

  // Load Class into Add/Edit Form State
  const loadClassIntoForm = (item: ClassItem) => {
    setClassName(item.name || '');
    setStartDate(formatDateForInput(item.startDate));
    setEndDate(formatDateForInput(item.endDate));
    setSelectedKhoiId(item.khoiId || '');
    setSelectedNhomId(item.nhomId || '');
    setStudyType(item.studyType || 'Theo tháng');
    setFee(item.fee || 0);
    setBusinessBlock(item.businessBlock || 'Lê Hồng Phong');

    // GVCN is teacher ID in sheet, let's resolve it
    const tObj = teachersList.find(t => t.name === item.teacher || t.id === item.teacher);
    setTeacherId(tObj?.id || item.teacher || '');

    setStatus(item.status || 'Đang học');
    setCourse(item.course || '');

    // Parse Room/Ca theo thứ JSON
    const initialSchedule: Record<number, any[]> = {
      1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 0: []
    };
    const initialOnAir: Record<number, { oa1: string; oa1Start: string; oa1End: string; oa2: string; oa2Start: string; oa2End: string }> = {
      1: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      2: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      3: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      4: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      5: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      6: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
      0: { oa1: '', oa1Start: '', oa1End: '', oa2: '', oa2Start: '', oa2End: '' },
    };
    try {
      if (item.roomCaMapStr) {
        const rawMap = JSON.parse(item.roomCaMapStr);
        [1, 2, 3, 4, 5, 6, 0].forEach(day => {
          const dayVal = rawMap[String(day)];
          if (dayVal) {
            const arr = Array.isArray(dayVal) ? dayVal : [dayVal];
            initialSchedule[day] = arr.map((s: any) => {
              // Tìm ID phòng học khớp
              const rObj = roomsList.find(
                (r) =>
                  String(r.id).trim().toLowerCase() === String(s.room).trim().toLowerCase() ||
                  String(r.name).trim().toLowerCase() === String(s.room).trim().toLowerCase()
              );
              const roomVal = rObj ? rObj.id : (s.room || '');

              // Tìm ID ca học khớp
              const shObj = shiftsList.find(
                (sh) =>
                  String(sh.id).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
                  String(sh.name).trim().toLowerCase() === String(s.ca).trim().toLowerCase() ||
                  `${String(sh.startTime).trim()} - ${String(sh.endTime).trim()}`.toLowerCase() === String(s.ca).trim().toLowerCase() ||
                  (s.time && `${String(sh.startTime).trim()} - ${String(sh.endTime).trim()}`.toLowerCase() === String(s.time).trim().toLowerCase())
              );
              const caVal = shObj ? shObj.id : (s.ca || '');
              const timeVal = s.time || (shObj ? `${shObj.startTime} - ${shObj.endTime}` : '');

              // Giải quyết GV On-Air 1/2 từ tên hoặc ID
              const oa1Raw = s.oa1 || s.onAir1 || '';
              const tObj1 = teachersList.find(
                (t) =>
                  String(t.name).trim().toLowerCase() === String(oa1Raw).trim().toLowerCase() ||
                  String(t.id).trim().toLowerCase() === String(oa1Raw).trim().toLowerCase()
              );
              const oa1Val = tObj1 ? tObj1.id : oa1Raw;

              const oa2Raw = s.oa2 || s.onAir2 || '';
              const tObj2 = teachersList.find(
                (t) =>
                  String(t.name).trim().toLowerCase() === String(oa2Raw).trim().toLowerCase() ||
                  String(t.id).trim().toLowerCase() === String(oa2Raw).trim().toLowerCase()
              );
              const oa2Val = tObj2 ? tObj2.id : oa2Raw;

              return {
                ca: caVal,
                time: timeVal,
                room: roomVal,
                oa1: oa1Val,
                oa1Start: s.oa1Start || s.onAir1Start || '',
                oa1End: s.oa1End || s.onAir1End || '',
                oa2: oa2Val,
                oa2Start: s.oa2Start || s.onAir2Start || '',
                oa2End: s.oa2End || s.onAir2End || '',
              };
            });
            const first = arr[0];
            if (first) {
              const oa1Raw = first.oa1 || first.onAir1 || '';
              const tObj1 = teachersList.find(
                (t) =>
                  String(t.name).trim().toLowerCase() === String(oa1Raw).trim().toLowerCase() ||
                  String(t.id).trim().toLowerCase() === String(oa1Raw).trim().toLowerCase()
              );
              const oa1Val = tObj1 ? tObj1.id : oa1Raw;

              const oa2Raw = first.oa2 || first.onAir2 || '';
              const tObj2 = teachersList.find(
                (t) =>
                  String(t.name).trim().toLowerCase() === String(oa2Raw).trim().toLowerCase() ||
                  String(t.id).trim().toLowerCase() === String(oa2Raw).trim().toLowerCase()
              );
              const oa2Val = tObj2 ? tObj2.id : oa2Raw;

              initialOnAir[day] = {
                oa1: oa1Val,
                oa1Start: first.oa1Start || first.onAir1Start || '',
                oa1End: first.oa1End || first.onAir1End || '',
                oa2: oa2Val,
                oa2Start: first.oa2Start || first.onAir2Start || '',
                oa2End: first.oa2End || first.onAir2End || '',
              };
            }
          }
        });
      }
    } catch (e) {
      console.error('Error parsing schedule config during load:', e);
    }
    setScheduleConfig(initialSchedule);
    setDayOnAirConfig(initialOnAir);
    setActiveConfigDay(1);

    const isCourseOrHourly = (item.studyType === 'Theo khóa' || item.studyType === 'Theo giờ');
    if (isCourseOrHourly) {
      const initialSessions = countActiveSessionsClient(
        formatDateForInput(item.startDate),
        formatDateForInput(item.endDate),
        initialSchedule,
        item.name,
        item.id
      );
      setTotalSessions(initialSessions);
    } else {
      setTotalSessions(0);
    }
  };

  // Tải song song danh mục và danh sách lớp học (Batch Fetch Tối Ưu) - Quản lý bởi SWR
  const fetchAllData = useCallback(async () => {
    await refresh();
  }, [refresh]);

  const fetchCatalogs = async () => {
    await refresh();
  };

  // Tải danh sách Học viên của lớp - Quản lý bởi SWR
  const fetchRoster = useCallback(async (className: string, classStatus?: string) => {
    if (classStatus && isClassStatusEnded(classStatus)) {
      setRosterStudents([]);
      setSelectedRosterStudents([]);
      setRosterAttendanceHeaders([]);
      return;
    }
    await mutateRoster();
  }, [mutateRoster]);

  const handleSingleCellAttendance = async (studentId: string, dateStr: string, status: string) => {
    // Optimistic Update in UI
    setRosterStudents(prev => prev.map(std => {
      if (std.id === studentId) {
        return {
          ...std,
          attendance: {
            ...std.attendance,
            [dateStr]: status
          }
        };
      }
      return std;
    }));

    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'saveSingleCellAttendance',
          loginEmail: email,
          data: {
            className: selectedClass?.name || '',
            studentId,
            dateStr,
            status
          }
        })
      });
      const res = await response.json();
      if (!res.success) {
        console.error('Lỗi khi lưu điểm danh:', res.message);
        if (selectedClass) {
          fetchRoster(selectedClass.name);
        }
      }
    } catch (e) {
      console.error('Lỗi mạng khi lưu điểm danh:', e);
      if (selectedClass) {
        fetchRoster(selectedClass.name);
      }
    }
  };

  // Lấy danh sách học sinh từ sheet lớp riêng (cho Điểm danh)
  const fetchStudentsForClass = useCallback(async (classItem: ClassItem, dateStr?: string) => {
    const signal = getAttendanceSignal();
    try {
      setLoadingStudents(true);
      setAttendanceStudents([]);
      setAttendanceStates({});
      setAttendanceShifts([]);
      setSelectedShift('');
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'getClassDetails',
          loginEmail: email,
          data: { className: classItem.name, date: dateStr || attendanceDate },
        }),
        signal,
      });
      const res = await response.json();
      if (res.success && res.data) {
        const { students, exists, shifts } = res.data;
        if (!exists) {
          setAttendanceStudents([]);
        } else {
          const list: any[] = (students || []).filter((s: any) => s.name);
          setAttendanceStudents(list);
          const initial: Record<string, 'A' | 'C' | 'K'> = {};
          list.forEach((s: any) => {
            initial[s.name] = (s.todayStatus === 'C' || s.todayStatus === 'K') ? s.todayStatus : 'A';
          });
          setAttendanceStates(initial);

          let sourceShifts = Array.isArray(shifts) ? shifts : [];
          if (sourceShifts.length === 0 && classItem.roomCaMapStr) {
            try {
              const selectedDate = dateStr || attendanceDate;
              const parts = selectedDate.split('-').map((n) => parseInt(n, 10));
              if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
                const jsDay = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
                const roomCaMap = JSON.parse(classItem.roomCaMapStr);
                const dayConf = roomCaMap[String(jsDay)];
                sourceShifts = dayConf ? (Array.isArray(dayConf) ? dayConf : [dayConf]) : [];
              }
            } catch (e) {
              sourceShifts = [];
            }
          }

          // Ánh xạ ca học
          const shiftList: { ca: string; time: string; onAir1?: string; onAir2?: string }[] = sourceShifts
            .filter((s: any) => s && (s.ca || s.time || s.room))
            .map((s: any) => {
              const shObj = shiftsList.find(sf => sf.id === s.ca || sf.name === s.ca);
              return {
                ca: shObj ? shObj.name : (s.ca || s.time || 'Theo lịch'),
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
      }
      setLoadingStudents(false);
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      console.error('Error fetching class students:', e);
      setAttendanceStudents([]);
      setLoadingStudents(false);
    }
  }, [user, attendanceDate, shiftsList, getAttendanceSignal]);

  // Lưu điểm danh
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
        triggerSuccess(`Đã lưu điểm danh lớp ${selectedClassForAttendance.name} ngày ${attendanceDate}${selectedShift ? ' (ca ' + selectedShift + ')' : ''
          } thành công!`);
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

  const handleDeleteAttendance = async () => {
    if (!selectedClass || !deleteAttendanceDate) return;
    setSavingDeleteAttendance(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'deleteAttendance',
          data: {
            className: selectedClass.name,
            date: deleteAttendanceDate
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || 'Xóa điểm danh thành công.');
        setShowDeleteAttendanceModal(false);
        fetchRoster(selectedClass.name);
      } else {
        alert(res.message || 'Xóa điểm danh thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingDeleteAttendance(false);
    }
  };

  const handleDownloadAttendanceToday = () => {
    if (!selectedClass || rosterStudents.length === 0) {
      alert('Không có dữ liệu điểm danh để tải!');
      return;
    }

    // 1. Tạo tiêu đề cột
    const headers = ['STT', 'Mã Học Sinh', 'Họ và Tên', 'Trạng Thái', 'Ngày Nhập Học', ...rosterAttendanceHeaders.map(h => h.split('|')[0].trim())];

    // 2. Tạo nội dung dòng dữ liệu
    const rows = rosterStudents.map((std, idx) => {
      const rowData = [
        String(idx + 1),
        std.id || '—',
        std.name || '',
        std.status || 'Đang học',
        std.start || '—'
      ];

      rosterAttendanceHeaders.forEach(date => {
        const rawHeader = date.split('|')[0].trim();
        const val = std.attendance ? std.attendance[rawHeader] : '';
        const statusClean = String(val || '').trim().toUpperCase();
        let displayVal = '—';
        if (statusClean === 'A' || statusClean === '✓' || statusClean === 'X') displayVal = 'Có mặt';
        else if (statusClean === 'C' || statusClean === 'P') displayVal = 'Có phép';
        else if (statusClean === 'K' || statusClean === 'V') displayVal = 'Không phép';
        rowData.push(displayVal);
      });

      return rowData;
    });

    // 3. Chuyển đổi thành CSV string (bao gồm escaping dấu phẩy và nháy kép)
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // 4. Download file bằng blob và tạo link tạm thời
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();

    link.href = url;
    link.setAttribute('download', `DiemDanh_${selectedClass.name}_${d}-${m}-${y}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveEvalNote = async () => {
    if (!evalStudentInfo || !newEvalNote.trim()) {
      alert('Vui lòng nhập nội dung đánh giá!');
      return;
    }
    setSavingEval(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/students',
          method: 'POST',
          action: 'updateEnrollTeacherNote',
          enrollId: evalStudentInfo.enrollId,
          studentId: evalStudentInfo.id,
          className: selectedClass?.name || '',
          note: newEvalNote,
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.ok) {
        triggerSuccess('Đánh giá đã được cập nhật thành công.');
        setShowEvalModal(false);
        if (selectedClass) {
          fetchRoster(selectedClass.name);
        }
      } else {
        alert(res.error || 'Lỗi khi lưu đánh giá.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi khi lưu đánh giá.');
    } finally {
      setSavingEval(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedClass || validSelectedRosterStudents.length === 0 || !emailSubject.trim() || !emailBody.trim()) {
      alert('Vui lòng điền đầy đủ tiêu đề và nội dung email!');
      return;
    }
    setSavingEmail(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: emailType === 'bulk' ? 'sendEmailBulk' : 'sendEmailReport',
          data: {
            className: selectedClass.name,
            studentNames: validSelectedRosterStudents,
            subject: emailSubject,
            body: emailBody
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        alert(res.message || 'Gửi email thành công.');
        setShowEmailModal(false);
        setSelectedRosterStudents([]);
      } else {
        alert(res.message || 'Gửi email thất bại.');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi kết nối API.');
    } finally {
      setSavingEmail(false);
    }
  };

  const handleTransferClass = async (sendEmail: boolean = transferSendEmail, showAlert: boolean = true) => {
    if (!selectedClass || !transferStudent || !transferNewClassName) {
      if (showAlert) alert('Vui lòng chọn lớp mới!');
      return;
    }
    setSavingTransfer(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'TRANSFER_CLASS',
          data: {
            khId: transferStudent.id,
            oldEnrollId: transferStudent.enrollId,
            oldClassName: selectedClass.name,
            newClassName: transferNewClassName,
            note: transferNote,
            newStatus: transferNewStatus,
            sendEmail: sendEmail
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        if (showAlert) alert(res.message || 'Chuyển lớp thành công.');
        setShowTransferModal(false);
        setSelectedRosterStudents([]);
        setTransferStudent(null);
        setTransferNewClassName('');
        setTransferNote('');
        fetchRoster(selectedClass.name);
      } else {
        if (showAlert) alert(res.message || 'Chuyển lớp thất bại.');
        else throw new Error(res.message || 'Chuyển lớp thất bại.');
      }
    } catch (e: any) {
      if (showAlert) alert(e.message || 'Lỗi kết nối API.');
      else throw e;
    } finally {
      setSavingTransfer(false);
    }
  };

  const handleStopClass = async (sendEmail: boolean = stopSendEmail, showAlert: boolean = true) => {
    if (!selectedClass || !stopStudent || !stopDate) {
      if (showAlert) alert('Vui lòng nhập ngày kết thúc thực tế!');
      return;
    }
    setSavingStop(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'ENROLL',
          action: 'STOP_CLASS',
          data: {
            khId: stopStudent.id,
            enrollId: stopStudent.enrollId,
            className: selectedClass.name,
            targetStatus: stopStatus,
            endDate: stopDate,
            reason: stopReason,
            sendEmail: sendEmail
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        if (showAlert) alert(res.message || 'Dừng lớp thành công.');
        setShowStopModal(false);
        setSelectedRosterStudents([]);
        setStopStudent(null);
        setStopReason('');
        fetchRoster(selectedClass.name);
      } else {
        if (showAlert) alert(res.message || 'Dừng lớp thất bại.');
        else throw new Error(res.message || 'Dừng lớp thất bại.');
      }
    } catch (e: any) {
      if (showAlert) alert(e.message || 'Lỗi kết nối API.');
      else throw e;
    } finally {
      setSavingStop(false);
    }
  };

  const fetchAllStudentsList = async () => { };

  const handleEnrollStudent = async () => {
    if (!selectedClass || selectedStudentsData.length === 0) {
      alert('Vui lòng chọn ít nhất một học sinh!');
      return;
    }

    const executeEnrollment = async (sendEmailOverride?: boolean) => {
      setSavingEnroll(true);
      try {
        const email = user?.email || '';
        let successCount = 0;
        for (const std of selectedStudentsData) {
          const response = await fetch('/api/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sheet: 'ENROLL',
              action: 'ENROLL_STUDENT',
              data: {
                studentId: std.id,
                className: selectedClass.name,
                enrollDate: std.date,
                status: std.status,
                sendEmail: sendEmailOverride !== undefined ? sendEmailOverride : enrollSendEmail
              },
              loginEmail: email
            })
          });
          const res = await response.json();
          if (res.success) {
            successCount++;
          }
        }

        if (successCount === selectedStudentsData.length) {
          triggerSuccess(`Đã thêm thành công ${successCount} học sinh vào lớp.`);
          setShowAddStudentModal(false);
          setSelectedStudentsData([]);
          fetchRoster(selectedClass.name);
        } else {
          triggerSuccess(`Đã thêm thành công ${successCount}/${selectedStudentsData.length} học sinh. Có một số lỗi xảy ra.`);
          setShowAddStudentModal(false);
          setSelectedStudentsData([]);
          fetchRoster(selectedClass.name);
        }
      } catch (e: any) {
        alert(e.message || 'Lỗi kết nối API.');
      } finally {
        setSavingEnroll(false);
      }
    };

    if (enrollSendEmail) {
      setEmailPreviewLoading(true);
      setShowEmailPreview(true);
      try {
        const email = user?.email || '';
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: 'LH',
            action: 'previewEmail',
            data: {
              templateName: 'thong_bao_hoc_sinh_moi',
              tplData: {
                className: selectedClass.name,
                newStudents: selectedStudentsData.map(s => ({
                  name: s.name,
                  isTrial: s.status === 'Học thử'
                }))
              }
            },
            loginEmail: email
          })
        });
        const res = await response.json();
        if (res.success) {
          setEmailPreviewSubject(res.subject || 'Thông báo học sinh mới');
          setEmailPreviewHtml(res.html || '');

          setEmailSubjectInput(res.subject || 'Thông báo học sinh mới');
          setEmailHtmlInput(res.html || '');

          // Lấy email mặc định của Giáo viên chủ nhiệm lớp
          const teacherObj = teachersList.find(t => t.name === selectedClass.teacher || t.id === selectedClass.teacher);
          const initialEmails: string[] = [];
          if (teacherObj?.email) {
            initialEmails.push(teacherObj.email);
          } else if (selectedClass.teacher && selectedClass.teacher.includes('@')) {
            initialEmails.push(selectedClass.teacher);
          }
          setEmailRecipients(initialEmails);

          setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
            // 1. Thực hiện thêm học viên vào sheet, vô hiệu hóa email mặc định từ backend
            await executeEnrollment(false);

            // 2. Gửi email từ frontend lên sử dụng HTML gốc
            const targetRecipients = finalRecipients || initialEmails;
            if (targetRecipients.length > 0) {
              const emailSub = finalSubject || res.subject || 'Thông báo học sinh mới';
              const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

              await fetch('/api/proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sheet: 'LH',
                  action: 'sendEmailDirect',
                  data: {
                    className: selectedClass.name,
                    recipients: targetRecipients,
                    subject: emailSub,
                    html: formattedHtml,
                    khId: selectedStudentsData.map(s => s.id).join(', ')
                  },
                  loginEmail: user?.email || ''
                })
              });
            }
          });
        } else {
          alert('Lỗi tải email preview: ' + res.message);
          setShowEmailPreview(false);
        }
      } catch (e: any) {
        alert('Lỗi kết nối preview: ' + e.message);
        setShowEmailPreview(false);
      } finally {
        setEmailPreviewLoading(false);
      }
    } else {
      await executeEnrollment();
    }
  };

  const triggerStopClass = async () => {
    if (!selectedClass || !stopStudent || !stopDate) {
      alert('Vui lòng nhập ngày kết thúc thực tế!');
      return;
    }
    if (!stopSendEmail) {
      await runProgressSimulation(
        async () => {
          await handleStopClass(false, false);
        },
        'Đang thực hiện dừng học...',
        'Dừng học lớp thành công!'
      );
      return;
    }

    setEmailPreviewLoading(true);
    setShowEmailPreview(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'previewEmail',
          data: {
            templateName: 'thong_bao_dung_lop',
            tplData: {
              studentName: stopStudent.name,
              className: selectedClass.name,
              stopDate: stopDate,
              reason: stopReason || 'Theo nguyện vọng của gia đình học sinh.'
            }
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        setEmailPreviewSubject(res.subject || 'Thông báo dừng học');
        setEmailPreviewHtml(res.html || '');

        setEmailSubjectInput(res.subject || 'Thông báo dừng học');
        setEmailHtmlInput(res.html || '');

        // Lấy email mặc định của Giáo viên chủ nhiệm lớp
        const teacherObj = teachersList.find(t => t.name === selectedClass.teacher || t.id === selectedClass.teacher);
        const initialEmails: string[] = [];
        if (teacherObj?.email) {
          initialEmails.push(teacherObj.email);
        } else if (selectedClass.teacher && selectedClass.teacher.includes('@')) {
          initialEmails.push(selectedClass.teacher);
        }
        setEmailRecipients(initialEmails);

        setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
          // 1. Thực hiện dừng lớp, vô hiệu hóa email mặc định từ backend
          await handleStopClass(false, false);

          // 2. Gửi email từ frontend lên sử dụng HTML gốc
          const targetRecipients = finalRecipients || initialEmails;
          if (targetRecipients.length > 0) {
            const emailSub = finalSubject || res.subject || 'Thông báo dừng học';
            const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

            await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheet: 'LH',
                action: 'sendEmailDirect',
                data: {
                  className: selectedClass.name,
                  recipients: targetRecipients,
                  subject: emailSub,
                  html: formattedHtml,
                  khId: stopStudent.id
                },
                loginEmail: user?.email || ''
              })
            });
          }
        });
      } else {
        alert('Lỗi tải email preview: ' + res.message);
        setShowEmailPreview(false);
      }
    } catch (e: any) {
      alert('Lỗi kết nối preview: ' + e.message);
      setShowEmailPreview(false);
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const triggerTransferClass = async () => {
    if (!selectedClass || !transferStudent || !transferNewClassName) {
      alert('Vui lòng chọn lớp mới!');
      return;
    }
    if (!transferSendEmail) {
      await runProgressSimulation(
        async () => {
          await handleTransferClass(false, false);
        },
        'Đang thực hiện chuyển lớp...',
        'Chuyển lớp thành công!'
      );
      return;
    }

    setEmailPreviewLoading(true);
    setShowEmailPreview(true);
    try {
      const email = user?.email || '';
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'previewEmail',
          data: {
            templateName: 'thong_bao_hoc_sinh_moi',
            tplData: {
              className: transferNewClassName,
              newStudents: [{ name: transferStudent.name, isTrial: transferNewStatus === 'Học thử' }]
            }
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        // Cập nhật tiêu đề hiển thị rõ là chuyển lớp
        const computedSubject = `THÔNG BÁO CHUYỂN LỚP: ${transferStudent.name} từ ${selectedClass.name} sang ${transferNewClassName}`;
        setEmailPreviewSubject(computedSubject);
        setEmailPreviewHtml(res.html || '');

        setEmailSubjectInput(computedSubject);
        setEmailHtmlInput(res.html || '');

        // Lấy email mặc định của Giáo viên chủ nhiệm lớp mới
        const newClassObj = classes.find(c => c.name === transferNewClassName || c.id === transferNewClassName);
        const teacherObj = newClassObj ? teachersList.find(t => t.name === newClassObj.teacher || t.id === newClassObj.teacher) : null;
        const initialEmails: string[] = [];
        if (teacherObj?.email) {
          initialEmails.push(teacherObj.email);
        } else if (newClassObj && newClassObj.teacher && newClassObj.teacher.includes('@')) {
          initialEmails.push(newClassObj.teacher);
        }
        setEmailRecipients(initialEmails);

        setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
          // 1. Thực hiện chuyển lớp, vô hiệu hóa email mặc định từ backend
          await handleTransferClass(false, false);

          // 2. Gửi email từ frontend lên sử dụng HTML gốc
          const targetRecipients = finalRecipients || initialEmails;
          if (targetRecipients.length > 0) {
            const emailSub = finalSubject || computedSubject;
            const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

            await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheet: 'LH',
                action: 'sendEmailDirect',
                data: {
                  className: transferNewClassName,
                  recipients: targetRecipients,
                  subject: emailSub,
                  html: formattedHtml,
                  khId: transferStudent.id
                },
                loginEmail: user?.email || ''
              })
            });
          }
        });
      } else {
        alert('Lỗi tải email preview: ' + res.message);
        setShowEmailPreview(false);
      }
    } catch (e: any) {
      alert('Lỗi kết nối preview: ' + e.message);
      setShowEmailPreview(false);
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  const formatWarningText = (text: string) => {
    if (!text) return '';
    return text
      .replace(
        /Chú ý:\s*Đây là email tự động từ hệ thống,\s*vui lòng không phản hồi\s*\(reply\)\s*lại email này\.?/gi,
        '<span style="color: #dc2626; font-style: italic;">Chú ý: Đây là email tự động từ hệ thống, vui lòng không phản hồi (reply) lại email này.</span>'
      )
      .replace(
        /Note:\s*This is an automated email from our system,\s*please do not reply to this email\.?/gi,
        '<span style="color: #dc2626; font-style: italic;">Note: This is an automated email from our system, please do not reply to this email.</span>'
      )
      .replace(
        /Note:\s*This is an automated email from the system,\s*please do not reply\.?/gi,
        '<span style="color: #dc2626; font-style: italic;">Note: This is an automated email from our system, please do not reply to this email.</span>'
      );
  };

  const handlePreviewSingleStudentEmail = async (name: string, id: string) => {
    if (!selectedClass) return;
    setLoadingSinglePreview(true);
    setShowBulkSinglePreview(true);
    setBulkSinglePreviewStudentName(name);

    const teacherObj = teachersList.find(t => t.id === selectedClass.teacher || t.name === selectedClass.teacher);
    const teacherName = teacherObj ? teacherObj.name : (selectedClass.teacher || 'Chưa phân công');

    try {
      let subject = '';
      let html = '';

      if (bulkReportBodies[id]) {
        subject = bulkReportSubject
          ? bulkReportSubject
            .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, name)
            .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
            .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName)
          : 'Báo cáo học tập';
        const formatted = formatWarningText(bulkReportBodies[id].replace(/\n/g, '<br/>'));
        html = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">${formatted}</div>`;
      } else if (bulkReportBody) {
        subject = bulkReportSubject
          ? bulkReportSubject
            .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, name)
            .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
            .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName)
          : 'Báo cáo học tập';

        const formattedCustomBody = bulkReportBody
          .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, name)
          .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
          .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName);
        const formatted = formatWarningText(formattedCustomBody.replace(/\n/g, '<br/>'));
        html = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">${formatted}</div>`;
      } else {
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: 'LH',
            action: 'previewEmail',
            data: {
              templateName: 'bao_cao_hoc_ky',
              tplData: {
                className: selectedClass.name,
                studentName: name
              }
            },
            loginEmail: user?.email || ''
          })
        });
        const res = await response.json();
        if (res.success) {
          subject = res.subject || 'Báo cáo học tập';
          html = formatWarningText(res.html || '');
        } else {
          throw new Error(res.message || 'Lỗi khi tải mẫu email từ server.');
        }
      }

      setBulkSinglePreviewSubject(subject);
      setBulkSinglePreviewHtml(html);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải xem trước email.');
      setShowBulkSinglePreview(false);
    } finally {
      setLoadingSinglePreview(false);
    }
  };

  const handleStartBulkSend = async () => {
    if (!selectedClass || validSelectedRosterStudents.length === 0) {
      alert('Vui lòng chọn ít nhất một học sinh!');
      return;
    }

    const missingFiles = validSelectedRosterStudents.filter(name => {
      const std = rosterStudents.find(s => s.name === name);
      if (!std) return true;
      const studentData = allStudentsList.find(s => s.name === name || s.id === std.id);
      const targetKhId = std.id || studentData?.id || '';
      return targetKhId ? !bulkReportFiles[std.id] && !bulkReportFiles[targetKhId] && !bulkReportFiles[std.name] : !bulkReportFiles[std.id] && !bulkReportFiles[std.name];
    });

    if (missingFiles.length > 0) {
      const conf = window.confirm(`Cảnh báo: Có ${missingFiles.length} học sinh chưa đính kèm tệp PDF (${missingFiles.join(', ')}). Bạn có chắc chắn muốn tiếp tục gửi không đính kèm không?`);
      if (!conf) return;
    }

    const email = user?.email || '';

    // helper to convert File -> Base64
    const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
        reader.onerror = error => reject(error);
      });
    };

    // Open progress modal & initialize counts
    setProgressTotal(validSelectedRosterStudents.length);
    setProgressCurrent(0);
    setProgressStudentName('');
    setShowProgressModal(true);

    let ok = 0;
    let fail = 0;

    const cleanNormalize = (str: string) =>
      str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    for (let i = 0; i < validSelectedRosterStudents.length; i++) {
      const name = validSelectedRosterStudents[i];
      const std = rosterStudents.find(s => s.name === name);
      if (!std) continue;

      setProgressStudentName(name);
      setProgressCurrent(i + 1);

      const studentData = allStudentsList.find(
        s =>
          cleanNormalize(s.name) === cleanNormalize(name) ||
          (std.id && s.id === std.id)
      );
      const targetKhId = std.id || studentData?.id || '';
      const statusKey = std.id || targetKhId || name;

      setBulkReportStatuses(prev => ({
        ...prev,
        [statusKey]: 'sending'
      }));

      const parentEmail = std.parentEmail || studentData?.parentEmail || '';
      if (!parentEmail || !parentEmail.includes('@')) {
        setBulkReportStatuses(prev => ({ ...prev, [statusKey]: 'error' }));
        fail++;
        continue;
      }

      const teacherObj = teachersList.find(t => t.id === selectedClass.teacher || t.name === selectedClass.teacher);
      const teacherName = teacherObj ? teacherObj.name : (selectedClass.teacher || 'Chưa phân công');

      const personalizedSubject = bulkReportSubject
        ? bulkReportSubject
          .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, name)
          .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
          .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName)
        : `[THT Center] Báo cáo học tập định kỳ lớp ${selectedClass.name}`;

      let finalHtml = '';
      if (bulkReportBodies[std.id] || (targetKhId && bulkReportBodies[targetKhId]) || bulkReportBodies[name]) {
        const bodyVal = bulkReportBodies[std.id] || (targetKhId ? bulkReportBodies[targetKhId] : bulkReportBodies[name] || '');
        const formatted = formatWarningText(bodyVal.replace(/\n/g, '<br/>'));
        finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">${formatted}</div>`;
      } else if (bulkReportBody) {
        const formattedCustomBody = bulkReportBody
          .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, name)
          .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
          .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName);
        const formatted = formatWarningText(formattedCustomBody.replace(/\n/g, '<br/>'));
        finalHtml = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333333;">${formatted}</div>`;
      }

      const fileObj =
        (std.id && bulkReportFiles[std.id]) ||
        (targetKhId && bulkReportFiles[targetKhId]) ||
        bulkReportFiles[name] ||
        null;
      let attachmentsB64: any[] = [];
      if (fileObj) {
        try {
          const b64 = await fileToBase64(fileObj);
          attachmentsB64.push({
            base64: b64,
            mimeType: fileObj.type || 'application/pdf',
            filename: fileObj.name || 'BaoCaoHocTap.pdf'
          });
        } catch (e) {
          console.error('Error converting file to base64 for ' + name, e);
        }
      }

      try {
        const sendResponse = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: 'LH',
            action: 'sendEmailDirect',
            loginEmail: email,
            data: {
              className: selectedClass.name,
              recipients: [parentEmail],
              subject: personalizedSubject,
              html: finalHtml,
              attachmentsB64: attachmentsB64,
              khId: targetKhId
            }
          })
        });

        const sendRes = await sendResponse.json();
        if (sendRes.success) {
          setBulkReportStatuses(prev => ({
            ...prev,
            [statusKey]: 'sent'
          }));
          ok++;
        } else {
          throw new Error(sendRes.message || 'Gửi email thất bại.');
        }
      } catch (err: any) {
        console.error(`Error sending email to ${name}:`, err);
        setBulkReportStatuses(prev => ({
          ...prev,
          [statusKey]: 'error'
        }));
        fail++;
      }

      // Small delay between calls to prevent rate limits
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Auto-close progress modal after 1.5 seconds and trigger success toast!
    setTimeout(() => {
      setShowProgressModal(false);
      triggerSuccess(`Đã gửi hoàn tất báo cáo hàng loạt! Thành công: ${ok}/${validSelectedRosterStudents.length}, Thất bại: ${fail}`);
    }, 1500);
  };

  const triggerSendReportEmail = async () => {
    if (!selectedClass || validSelectedRosterStudents.length === 0) {
      alert('Vui lòng chọn ít nhất một học sinh!');
      return;
    }

    setEmailPreviewLoading(true);
    setShowEmailPreview(true);
    try {
      const email = user?.email || '';
      const studentNameStr = validSelectedRosterStudents.join(', ');

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'previewEmail',
          data: {
            templateName: 'bao_cao_hoc_ky',
            tplData: {
              className: selectedClass.name,
              studentName: studentNameStr
            }
          },
          loginEmail: email
        })
      });
      const res = await response.json();
      if (res.success) {
        setEmailPreviewSubject(res.subject || 'Báo cáo học tập');
        setEmailPreviewHtml(res.html || '');

        setEmailSubjectInput(res.subject || 'Báo cáo học tập');
        setEmailHtmlInput(res.html || '');

        const initialEmails = res.recipients || [];
        setEmailRecipients(initialEmails);

        setPendingEmailAction(() => async (finalRecipients?: string[], finalSubject?: string, finalHtml?: string) => {
          const targetRecipients = finalRecipients || initialEmails;
          if (targetRecipients.length === 0) {
            alert('Vui lòng nhập ít nhất một email người nhận!');
            return;
          }

          setSavingEmail(true);
          try {
            const emailSub = finalSubject || res.subject || 'Báo cáo học tập';
            const formattedHtml = finalHtml || emailHtmlInput || res.html || '';

            // Lấy Student ID nếu chỉ có 1 học sinh được chọn làm khId
            const cleanNormalize = (str: string) =>
              str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
            const targetKhId = validSelectedRosterStudents
              .map(name => {
                const sObj = rosterStudents.find(s => s.name === name);
                const sData = allStudentsList.find(
                  s =>
                    cleanNormalize(s.name) === cleanNormalize(name) ||
                    (sObj?.id && s.id === sObj.id)
                );
                return sObj?.id || sData?.id || '';
              })
              .filter(Boolean)
              .join(', ');

            const sendRes = await fetch('/api/proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sheet: 'LH',
                action: 'sendEmailDirect',
                data: {
                  className: selectedClass.name,
                  recipients: targetRecipients,
                  subject: emailSub,
                  html: formattedHtml,
                  khId: targetKhId
                },
                loginEmail: user?.email || ''
              })
            });
            const sendData = await sendRes.json();
            if (sendData.success) {
              alert(sendData.message || 'Gửi báo cáo học tập thành công!');
              setSelectedRosterStudents([]);
            } else {
              alert('Gửi email thất bại: ' + sendData.message);
            }
          } catch (e: any) {
            alert('Lỗi gửi email: ' + e.message);
          } finally {
            setSavingEmail(false);
          }
        });
      } else {
        alert('Lỗi tải email preview: ' + res.message);
        setShowEmailPreview(false);
      }
    } catch (e: any) {
      alert('Lỗi kết nối preview: ' + e.message);
      setShowEmailPreview(false);
    } finally {
      setEmailPreviewLoading(false);
    }
  };

  // Lấy toàn bộ danh sách lớp học
  const fetchClasses = async () => {
    await fetchAllData();
  };

  // Thêm lớp học mới
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      alert('Vui lòng nhập tên lớp học!');
      return;
    }
    if (!validateClassForm(startDate, endDate, scheduleConfig)) return;
    try {
      setSubmitting(true);

      const cleanSchedule: Record<string, any> = {};
      Object.entries(scheduleConfig).forEach(([dayStr, sessions]) => {
        const active = sessions.filter(s => s.ca && s.room);
        if (active.length > 0) {
          cleanSchedule[dayStr] = active.map(s => ({
            ca: s.ca,
            time: s.time,
            room: s.room,
            oa1: s.oa1 || '',
            oa1Start: s.oa1Start || '',
            oa1End: s.oa1End || '',
            oa2: s.oa2 || '',
            oa2Start: s.oa2Start || '',
            oa2End: s.oa2End || ''
          }));
        }
      });

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('LH'),
            name: className.trim(),
            startDate,
            endDate,
            khoiId: selectedKhoiId,
            nhomId: selectedNhomId,
            studyType,
            fee,
            businessBlock,
            userId: teacherId,
            status,
            course: getCourseFromStartDate(startDate),
            roomCaMap: JSON.stringify(cleanSchedule)
          }
        })
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Thêm lớp học thành công!');
        setShowAddPanel(false);
        resetForm();
        fetchClasses();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể tạo lớp học.'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Sửa lớp học
  const handleEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!className.trim()) {
      alert('Vui lòng nhập tên lớp học!');
      return;
    }
    if (!validateClassForm(startDate, endDate, scheduleConfig)) return;
    try {
      setSubmitting(true);

      const cleanSchedule: Record<string, any> = {};
      Object.entries(scheduleConfig).forEach(([dayStr, sessions]) => {
        const active = sessions.filter(s => s.ca && s.room);
        if (active.length > 0) {
          cleanSchedule[dayStr] = active.map(s => ({
            ca: s.ca,
            time: s.time,
            room: s.room,
            oa1: s.oa1 || '',
            oa1Start: s.oa1Start || '',
            oa1End: s.oa1End || '',
            oa2: s.oa2 || '',
            oa2Start: s.oa2Start || '',
            oa2End: s.oa2End || ''
          }));
        }
      });

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'PUT',
          loginEmail: user?.email || '',
          data: {
            id: selectedClass.id,
            name: className.trim(),
            startDate,
            endDate,
            khoiId: selectedKhoiId,
            nhomId: selectedNhomId,
            studyType,
            fee,
            businessBlock,
            userId: teacherId,
            status,
            course: getCourseFromStartDate(startDate),
            roomCaMap: JSON.stringify(cleanSchedule)
          }
        })
      });

      const res = await response.json();
      if (res.success) {
        triggerSuccess(res.message || 'Cập nhật thông tin lớp học thành công!');
        setShowEditPanel(false);
        setSelectedClass(null);
        resetForm();
        fetchClasses();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể cập nhật lớp học.'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Xóa lớp học
  const handleDeleteClass = async (item: ClassItem) => {
    const conf = window.confirm(`Bạn có chắc chắn muốn xóa lớp học "${item.name}"?\nHành động này sẽ xóa dòng lớp học trong sheet LH và xóa cả sheet điểm danh của lớp!`);
    if (!conf) return;

    try {
      setActionLoading(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'DELETE',
          loginEmail: user?.email || '',
          data: { id: item.id }
        })
      });

      const res = await response.json();
      if (res.success) {
        alert(res.message || 'Xóa lớp học thành công!');
        fetchClasses();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể xóa lớp học.'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Kết thúc lớp học
  const handleEndClass = async (item: ClassItem) => {
    const conf = window.confirm(`Bạn có chắc chắn muốn KẾT THÚC lớp học "${item.name}"?\nHành động này sẽ:\n1. Đổi trạng thái lớp học thành "Hoàn thành"\n2. Chuyển tất cả học sinh đang học/học thử trong lớp sang trạng thái "Hoàn thành" trong sheet ENROLL và tự động đồng bộ trạng thái học sinh.\n3. XÓA sheet điểm danh của lớp để giải phóng tài nguyên.\n\nHành động này không thể hoàn tác!`);
    if (!conf) return;

    try {
      setActionLoading(true);
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sheet: 'LH',
          action: 'END_CLASS',
          loginEmail: user?.email || '',
          data: { id: item.id }
        })
      });

      const res = await response.json();
      if (res.success) {
        alert(res.message || 'Kết thúc lớp học thành công!');
        setActiveView('list');
        setSelectedClass(null);
        fetchClasses();
      } else {
        alert('Lỗi: ' + (res.message || 'Không thể kết thúc lớp học.'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Mở reopen modal và khởi tạo giá trị
  const handleOpenReopenModal = () => {
    if (!checkPermission('perm_class_clone')) return;
    if (!selectedClass) return;
    setReopenClassName(selectedClass.name);
    setReopenStartDate(new Date().toISOString().split('T')[0]); // Default to today
    setReopenEndDate('');
    setReopenTotalSessions(0);
    setShowReopenModal(true);
  };

  // Thao tác mở lại lớp / clone lớp
  const handleReopenClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!reopenClassName.trim()) {
      alert('Vui lòng nhập tên lớp học mới!');
      return;
    }
    if (!reopenStartDate) {
      alert('Vui lòng nhập ngày bắt đầu!');
      return;
    }
    if (!reopenEndDate) {
      alert('Vui lòng nhập ngày kết thúc (hoặc kiểm tra lại cấu hình số buổi)!');
      return;
    }

    // Check if new class name matches any existing class in "Đang học" state
    const duplicate = classes.find(
      (c) =>
        c.name.trim().toLowerCase() === reopenClassName.trim().toLowerCase() &&
        c.status === 'Đang học'
    );
    if (duplicate) {
      alert(`Đã có lớp học với tên "${reopenClassName.trim()}" ở trạng thái "Đang học". Vui lòng chọn tên khác!`);
      return;
    }

    try {
      setSubmitting(true);

      // Step 1: If original class is not ended, end it first
      if (!isClassEnded(selectedClass.status)) {
        const responseEnd = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet: 'LH',
            action: 'END_CLASS',
            loginEmail: user?.email || '',
            data: { id: selectedClass.id }
          })
        });
        const resEnd = await responseEnd.json();
        if (!resEnd.success) {
          alert('Không thể kết thúc lớp học cũ: ' + (resEnd.message || 'Lỗi không xác định.'));
          setSubmitting(false);
          return;
        }
      }

      // Step 2: Clone properties and submit new class creation
      const tObj = teachersList.find(
        (t) => t.name === selectedClass.teacher || t.id === selectedClass.teacher
      );
      const clonedTeacherId = tObj ? tObj.id : (selectedClass.teacher || '');

      let scheduleMapParsed = {};
      try {
        if (selectedClass.roomCaMapStr) {
          scheduleMapParsed = JSON.parse(selectedClass.roomCaMapStr);
        }
      } catch (e) { }

      const responseCreate = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: '/api/v1/classes',
          method: 'POST',
          loginEmail: user?.email || '',
          data: {
            id: generateID('LH'),
            name: reopenClassName.trim(),
            startDate: reopenStartDate,
            endDate: reopenEndDate,
            khoiId: selectedClass.khoiId || '',
            nhomId: selectedClass.nhomId || '',
            studyType: selectedClass.studyType || 'Theo tháng',
            fee: selectedClass.fee || 0,
            businessBlock: selectedClass.businessBlock || '',
            userId: clonedTeacherId,
            status: 'Đang học',
            course: getCourseFromStartDate(reopenStartDate),
            roomCaMap: JSON.stringify(scheduleMapParsed)
          }
        })
      });

      const resCreate = await responseCreate.json();
      if (resCreate.success) {
        triggerSuccess('Mở lại / Clone lớp học thành công!');
        setShowReopenModal(false);
        setActiveView('list');
        setSelectedClass(null);
        fetchClasses();
      } else {
        alert('Lỗi khi tạo lớp mới: ' + (resCreate.message || 'Không thể tạo lớp học.'));
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Đã có SWR tự động tải dữ liệu khi mount trang

  // Tải danh sách lớp đang học của học sinh khi mở modal chuyển lớp
  useEffect(() => {
    if (!transferStudent || !user?.email) {
      setTransferStudentActiveClasses([]);
      return;
    }
    const fetchTransferStudentClasses = async () => {
      try {
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: '/api/v1/students',
            method: 'POST',
            action: 'getEnrolls',
            studentId: transferStudent.id,
            loginEmail: user.email
          })
        });
        if (response.ok) {
          const res = await response.json();
          if (res.success && Array.isArray(res.data)) {
            // Lọc các ghi danh có trạng thái active như "Đang học" hoặc "Học thử"
            const activeClasses = res.data
              .filter((enroll: any) => {
                const st = String(enroll.status || '').trim().toLowerCase();
                return st === 'đang học' || st === 'dang hoc' || st === 'học thử' || st === 'hoc thu';
              })
              .map((enroll: any) => String(enroll.className || enroll.class || '').trim().toLowerCase());
            setTransferStudentActiveClasses(activeClasses);
          }
        }
      } catch (e) {
        console.error('Error fetching transfer student active classes:', e);
      }
    };
    fetchTransferStudentClasses();
  }, [transferStudent, user?.email]);

  // Re-trigger fetchClasses when catalog lists change to resolve default rooms/ca names correctly
  useEffect(() => {
    if (roomsList.length > 0 && shiftsList.length > 0 && classes.length > 0) {
      // Re-map simple values if catalogs were loaded later
    }
  }, [roomsList, shiftsList]);

  // Tự động mở chi tiết lớp học nếu có tham số id trên URL
  useEffect(() => {
    if (classIdParam && classes.length > 0) {
      const matched = classes.find(c => c.id === classIdParam);
      if (matched) {
        setSelectedClass(matched);
        setDetailTab('roster');
        fetchRoster(matched.name, matched.status);
        setActiveView('detail');
      }
    }
  }, [classIdParam, classes]);

  // Đồng bộ Breadcrumbs Navbar toàn cục
  useEffect(() => {
    if (activeView === 'bulk-report' && selectedClass) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        {
          label: 'Lớp học',
          href: '/classes',
          onClick: () => {
            setActiveView('list');
            setSelectedClass(null);
            setRosterStudents([]);
            setRosterAttendanceHeaders([]);
          }
        },
        { label: selectedClass.name, onClick: () => { setActiveView('detail'); } },
        { label: 'Gửi báo cáo hàng loạt' }
      ]);
    } else if (activeView === 'detail' && selectedClass) {
      if (showEditPanel) {
        setBreadcrumbs([
          { label: 'Trang chủ', href: '/' },
          {
            label: 'Lớp học',
            href: '/classes',
            onClick: () => {
              setShowEditPanel(false);
              setActiveView('list');
              setSelectedClass(null);
              setRosterStudents([]);
              setRosterAttendanceHeaders([]);
            }
          },
          { label: selectedClass.name, onClick: () => { setShowEditPanel(false); setActiveView('detail'); } },
          { label: 'Chỉnh sửa' }
        ]);
      } else {
        setBreadcrumbs([
          { label: 'Trang chủ', href: '/' },
          {
            label: 'Lớp học',
            href: '/classes',
            onClick: () => {
              setActiveView('list');
              setSelectedClass(null);
              setRosterStudents([]);
              setRosterAttendanceHeaders([]);
            }
          },
          { label: selectedClass.name }
        ]);
      }
    } else if (showAddPanel) {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        {
          label: 'Lớp học',
          href: '/classes',
          onClick: () => {
            setShowAddPanel(false);
          }
        },
        { label: 'Thêm lớp học' }
      ]);
    } else {
      setBreadcrumbs([
        { label: 'Trang chủ', href: '/' },
        { label: 'Lớp học' }
      ]);
    }
  }, [activeView, selectedClass, showAddPanel, showEditPanel, setBreadcrumbs]);

  // Tự động tải danh sách học sinh để lấy email phụ huynh làm fallback khi gửi báo cáo hàng loạt
  useEffect(() => {
    if (activeView === 'bulk-report') {
      fetchAllStudentsList();
    }
  }, [activeView]);

  const getStatusBadge = (status: string) => {
    const s = String(status || '').trim().toLowerCase();
    if (s.includes('đang học') || s.includes('dang hoc')) {
      return (
        <span className="tht-badge tht-badge-success">
          <CheckCircle size={12} />
          Đang học
        </span>
      );
    }
    if (s.includes('kết thúc') || s.includes('ket thuc') || s.includes('đã dừng')) {
      return (
        <span className="tht-badge tht-badge-danger">
          <XCircle size={12} />
          Đã kết thúc
        </span>
      );
    }
    return (
      <span className="tht-badge tht-badge-warning">
        <AlertTriangle size={12} />
        {status || 'Đang chờ lớp'}
      </span>
    );
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN').format(val || 0);
  };

  // Kiểm tra lớp đã kết thúc (ẩn các thao tác điểm danh, chỉnh sửa)
  const isClassEnded = (status: string) => {
    const s = String(status || '').trim().toLowerCase();
    return s.includes('kết thúc') || s.includes('ket thuc') || s.includes('đã dừng');
  };

  // Filter logic
  const filteredClasses = classes.filter(cls => {
    const nameMatch = cls.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.teacher?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!nameMatch) return false;

    const s = String(cls.status || '').trim().toLowerCase();
    if (activeTab === 'active') return s.includes('đang học') || s.includes('dang hoc');
    if (activeTab === 'pending') return !s.includes('đang học') && !s.includes('dang hoc') && !s.includes('kết thúc') && !s.includes('ket thuc');
    if (activeTab === 'ended') return s.includes('kết thúc') || s.includes('ket thuc') || s.includes('đã dừng');

    return true;
  });

  // KPI calculations
  const totalClasses = classes.length;
  const activeCount = classes.filter(c => String(c.status || '').trim().toLowerCase().includes('đang học')).length;
  const endedCount = classes.filter(c => String(c.status || '').trim().toLowerCase().includes('kết thúc')).length;

  // Pagination
  const {
    paginatedData: paginatedClasses,
    currentPage,
    setCurrentPage,
    totalPages,
    startIndex,
    itemsPerPage,
    getPageNumbers,
  } = usePagination(filteredClasses, 10, [searchQuery, activeTab]);

  const selectedClassEnded = selectedClass ? isClassEnded(selectedClass.status) : false;

  return (
    <div className="space-y-8 animate-fade-in w-full overflow-x-hidden min-w-0">
      {!showAddPanel && (!showEditPanel || !selectedClass) ? (
        activeView === 'bulk-report' && selectedClass ? (
          <div className="tht-bulk-composer-container space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gửi báo cáo hàng loạt - Lớp {selectedClass.name}</h1>
                <p className="text-xs text-slate-500 mt-1">Biên tập riêng biệt và gửi báo cáo học tập đến phụ huynh học viên lớp.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('detail');
                  }}
                  className="tht-btn-outline"
                >
                  Quay lại
                </button>

                <button
                  type="button"
                  onClick={handleStartBulkSend}
                  className="tht-btn-primary"
                >
                  <Mail size={16} />
                  <span>Bắt đầu gửi ngay</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl text-amber-800 text-xs leading-relaxed space-y-1">
              <p className="font-bold text-amber-900 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Lưu ý quan trọng</span>
              </p>
              <p>
                Dung lượng mỗi file đính kèm không nên quá <strong>5MB</strong>. Vui lòng đính kèm tệp tin PDF tương ứng cho từng học viên.
                Bạn có thể biên tập trực tiếp nội dung email riêng biệt cho từng học sinh ngay dưới đây. Tiêu đề email sẽ được áp dụng chung cho tất cả các học sinh.
              </p>
            </div>

            {/* Centralized Email Subject Input */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="space-y-2">
                <label className="tht-input-label">Tiêu đề Email chung</label>
                <input
                  type="text"
                  value={bulkReportSubject}
                  onChange={(e) => setBulkReportSubject(e.target.value)}
                  className="tht-input font-bold"
                  placeholder="Nhập tiêu đề email..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {validSelectedRosterStudents.map((name, sidx) => {
                const std = rosterStudents.find(s => s.name === name);
                if (!std) return null;
                const status = bulkReportStatuses[std.id] || 'pending';
                const file = (std.id && bulkReportFiles[std.id]) || bulkReportFiles[std.name];
                const bodyValue = bulkReportBodies[std.id] || '';

                // Tìm email phụ huynh từ allStudentsList làm fallback
                const cleanNormalize = (str: string) =>
                  str
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim();
                const studentData = allStudentsList.find(
                  s =>
                    cleanNormalize(s.name) === cleanNormalize(name) ||
                    (std.id && s.id === std.id)
                );
                const parentEmailVal = studentData?.parentEmail || std.parentEmail || '';

                return (
                  <div key={std.id || std.name} className="tht-bulk-student-card space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                          {sidx + 1}
                        </span>
                        <div className="flex items-baseline gap-2.5 flex-wrap">
                          <h4 className="text-sm font-black text-slate-800">{std.name}</h4>
                          {parentEmailVal && (
                            <span className="text-xs text-slate-400 font-semibold">({parentEmailVal})</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handlePreviewSingleStudentEmail(std.name, std.id)}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer"
                        >
                          Xem trước Email
                        </button>
                        {status === 'pending' && (
                          <span className="tht-badge tht-badge-info">Chờ gửi</span>
                        )}
                        {status === 'sending' && (
                          <span className="tht-badge tht-badge-warning flex items-center gap-1">
                            <RefreshCw size={10} className="animate-spin" />
                            Đang gửi...
                          </span>
                        )}
                        {status === 'sent' && (
                          <span className="tht-badge tht-badge-success">Đã gửi</span>
                        )}
                        {status === 'error' && (
                          <span className="tht-badge tht-badge-danger" title="Gửi thất bại">Lỗi</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="md:col-span-1 space-y-3">
                        <label className="tht-input-label">Tệp PDF đính kèm</label>
                        <div className="p-4 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                          <UploadCloud size={24} className="text-slate-400 mb-2" />
                          <input
                            type="file"
                            accept="application/pdf"
                            onChange={(e) => {
                              const uploadedFile = e.target.files?.[0] || null;
                              setBulkReportFiles(prev => ({
                                ...prev,
                                [std.id]: uploadedFile
                              }));
                            }}
                            className="w-full text-[10px] font-semibold text-slate-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[9px] file:font-black file:bg-slate-200 file:text-slate-700 hover:file:bg-slate-300 file:cursor-pointer cursor-pointer"
                          />
                          {file && (
                            <div className="text-[10px] text-emerald-600 font-bold mt-2 text-center leading-snug">
                              ✓ {file.name} <br /> ({Math.round(file.size / 1024)} KB)
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2 space-y-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="tht-input-label">Nội dung email</label>
                            <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                              Có thể click trực tiếp vào văn bản để sửa
                            </span>
                          </div>
                          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-inner bg-slate-50/50 focus-within:ring-2 focus-within:ring-[#21398A]/20 focus-within:border-[#21398A]">
                            <div className="p-4 overflow-y-auto max-h-[350px] bg-white text-slate-800" style={{ fontFamily: 'Inter, sans-serif' }}>
                              <div
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const val = e.currentTarget.innerHTML;
                                  setBulkReportBodies(prev => ({
                                    ...prev,
                                    [std.id]: val
                                  }));
                                }}
                                dangerouslySetInnerHTML={{ __html: bodyValue || '' }}
                                className="outline-none min-h-[250px] text-xs leading-relaxed"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : activeView === 'detail' && selectedClass ? (
          <div className="space-y-6">

            {/* Row 1: Class Info Banner & Weekly Schedule side-by-side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Core Info Banner */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-[#21398A] rounded-xl border border-blue-100">
                      <BookOpen size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800 leading-tight">{selectedClass.name}</h3>
                      <span className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase block mt-0.5">ID: {selectedClass.id}</span>
                    </div>
                  </div>
                  <div>{getStatusBadge(selectedClass.status)}</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium text-slate-600">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Giáo viên chủ nhiệm</span>
                    <span className="font-extrabold text-slate-700 block mt-0.5">{selectedClass.teacher || 'Chưa phân công'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Khóa học</span>
                    <span className="font-extrabold text-slate-700 block mt-0.5">{selectedClass.course || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Thời gian lớp học</span>
                    <span className="font-extrabold text-slate-700 block mt-0.5">{formatAnyDate(selectedClass.startDate) || '—'} đến {formatAnyDate(selectedClass.endDate) || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Hình thức học</span>
                    <span className="font-extrabold text-slate-700 block mt-0.5">{selectedClass.studyType || 'Theo tháng'}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-bold block uppercase tracking-wider text-[9px]">Học phí</span>
                    <span className="font-extrabold text-[#21398A] text-sm block mt-0.5">{formatCurrency(selectedClass.fee)}</span>
                  </div>
                </div>

                {/* Class Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  {!isClassEnded(selectedClass.status) ? (
                    <>
                      {/* Thêm học sinh (chỉ hiển thị khi có quyền) */}
                      {(isAdmin || userPerms['perm_class_add_student']) && (
                        <button
                          type="button"
                          onClick={() => {
                            fetchAllStudentsList();
                            setShowAddStudentModal(true);
                          }}
                          className="py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-[#21398A] hover:border-blue-200 border border-blue-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Thêm học sinh</span>
                        </button>
                      )}

                      {/* Kết thúc lớp (chỉ hiển thị khi có quyền) */}
                      {(isAdmin || userPerms['perm_class_edit']) && (
                        <button
                          type="button"
                          onClick={() => {
                            handleEndClass(selectedClass);
                          }}
                          className="py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer"
                        >
                          <CheckCircle size={14} />
                          <span>Kết thúc lớp</span>
                        </button>
                      )}

                      {/* Tải điểm danh (Ẩn tạm thời theo yêu cầu) */}
                      {/* 
                      <button
                        type="button"
                        onClick={handleDownloadAttendanceToday}
                        className="py-2.5 tht-text-action-btn-excel border font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <FileSpreadsheet size={14} />
                        <span>Tải điểm danh</span>
                      </button>
                      */}

                      {/* Hàng nút Điểm danh & Xóa điểm danh */}
                      {(() => {
                        const showAttendance = isAdmin || userPerms['perm_attendance_today'];
                        const showDeleteAttendance = isAdmin || userPerms['perm_class_delete_attendance'];

                        if (showAttendance && showDeleteAttendance) {
                          return (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedClassForAttendance(selectedClass);
                                  setShowAttendancePanel(true);
                                  fetchStudentsForClass(selectedClass);
                                }}
                                className="py-2.5 bg-green-50 hover:bg-green-100 text-green-600 hover:text-emerald-700 hover:border-green-200 border border-green-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <ClipboardCheck size={14} />
                                <span>Điểm danh</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!checkPermission('perm_class_delete_attendance')) return;
                                  setDeleteAttendanceDate(new Date().toISOString().split('T')[0]);
                                  setShowDeleteAttendanceModal(true);
                                }}
                                className="py-2.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-rose-600 hover:border-red-200 border border-red-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Trash2 size={14} />
                                <span>Xóa điểm danh</span>
                              </button>
                            </>
                          );
                        } else if (showAttendance) {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedClassForAttendance(selectedClass);
                                setShowAttendancePanel(true);
                                fetchStudentsForClass(selectedClass);
                              }}
                              className="col-span-2 py-2.5 bg-green-50 hover:bg-green-100 text-green-600 hover:text-emerald-700 hover:border-green-200 border border-green-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <ClipboardCheck size={14} />
                              <span>Điểm danh</span>
                            </button>
                          );
                        } else if (showDeleteAttendance) {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!checkPermission('perm_class_delete_attendance')) return;
                                setDeleteAttendanceDate(new Date().toISOString().split('T')[0]);
                                setShowDeleteAttendanceModal(true);
                              }}
                              className="col-span-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-500 hover:text-rose-600 hover:border-red-200 border border-red-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <Trash2 size={14} />
                              <span>Xóa điểm danh</span>
                            </button>
                          );
                        }
                        return null;
                      })()}

                      {/* Nút Mở lại / Clone lớp học (chỉ hiển thị khi quá hạn và có quyền) */}
                      {selectedClass.status === 'Đang học' && isClassPastEndDate(selectedClass.endDate) && (isAdmin || userPerms['perm_class_clone']) && (
                        <button
                          type="button"
                          onClick={handleOpenReopenModal}
                          className="col-span-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 border border-slate-200/50 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <RefreshCw size={14} />
                          <span>Mở lại / Clone lớp học</span>
                        </button>
                      )}
                    </>
                  ) : (
                    /* Nếu lớp đã kết thúc thì chỉ hiện Clone nếu có quyền */
                    (isAdmin || userPerms['perm_class_clone']) && (
                      <button
                        type="button"
                        onClick={handleOpenReopenModal}
                        className="col-span-2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 border border-slate-200/50 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <RefreshCw size={14} />
                        <span>Mở lại / Clone lớp học</span>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Lịch học cố định hàng tuần */}
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Calendar size={14} className="text-slate-400" />
                  <span>Lịch học cố định hàng tuần</span>
                </h4>
                {(() => {
                  let scheduleMap: Record<number, any[]> = {};
                  try {
                    if (selectedClass.roomCaMapStr) {
                      scheduleMap = JSON.parse(selectedClass.roomCaMapStr);
                    }
                  } catch (e) { }

                  const days = [
                    { key: 1, label: 'Thứ 2' },
                    { key: 2, label: 'Thứ 3' },
                    { key: 3, label: 'Thứ 4' },
                    { key: 4, label: 'Thứ 5' },
                    { key: 5, label: 'Thứ 6' },
                    { key: 6, label: 'Thứ 7' },
                    { key: 0, label: 'Chủ Nhật' },
                  ];

                  const activeDays = days.filter((d) => {
                    const val = scheduleMap[d.key];
                    if (!val) return false;
                    if (Array.isArray(val)) return val.length > 0;
                    return !!(val as any).ca;
                  });

                  if (activeDays.length === 0) {
                    return (
                      <div className="p-4 text-center bg-slate-50 text-slate-400 text-xs font-medium rounded-xl border border-dashed border-slate-200">
                        Chưa có cấu hình lịch học cố định.
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 gap-2.5">
                      {activeDays.map((d) => {
                        const sessionsVal = scheduleMap[d.key];
                        const sessions = Array.isArray(sessionsVal) ? sessionsVal : [sessionsVal];
                        return (
                          <div
                            key={d.key}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100/80 gap-3"
                          >
                            <span className="font-extrabold text-[#21398A] text-sm shrink-0 sm:w-16">
                              {d.label}
                            </span>
                            <div className="flex-1 space-y-2">
                              {sessions.map((s, idx) => {
                                const rObj = roomsList.find(rm => rm.id === s.room);
                                const roomNameResolved = rObj ? rObj.name : (s.room || '—');

                                const sObj = shiftsList.find(sf => sf.id === s.ca || sf.name === s.ca);
                                const caNameResolved = sObj ? sObj.name : (s.ca || '—');

                                const tObj1 = teachersList.find(t => t.id === s.oa1 || t.name === s.oa1);
                                const tName1 = tObj1 ? tObj1.name : (s.oa1 || '');

                                const tObj2 = teachersList.find(t => t.id === s.oa2 || t.name === s.oa2);
                                const tName2 = tObj2 ? tObj2.name : (s.oa2 || '');

                                const oaDisplay: string[] = [];
                                if (tName1) {
                                  oaDisplay.push(`${tName1}${s.oa1Start || s.oa1End ? ` (${s.oa1Start || '—'} - ${s.oa1End || '—'})` : ''}`);
                                }
                                if (tName2) {
                                  oaDisplay.push(`${tName2}${s.oa2Start || s.oa2End ? ` (${s.oa2Start || '—'} - ${s.oa2End || '—'})` : ''}`);
                                }

                                return (
                                  <div key={idx} className="flex flex-col gap-1 border-b border-slate-200/40 pb-1.5 last:border-0 last:pb-0 text-xs">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="font-bold text-[#21398A] bg-blue-50 px-2 py-0.5 rounded-md text-[10px]">
                                        {caNameResolved}
                                        {s.time ? ` (${s.time})` : ''}
                                      </span>
                                      <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md text-[10px]">
                                        Phòng: {roomNameResolved}
                                      </span>
                                    </div>
                                    {oaDisplay.length > 0 && (
                                      <div className="text-slate-500 font-semibold mt-0.5 text-[10px]">
                                        On-Air: {oaDisplay.join(', ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Row 2: Dynamic Tab content (Students & Evaluation) - Full Width */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
              {/* Tab Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-4 min-h-[56px] sm:h-[56px]">
                <div className="flex gap-6">
                  <button
                    type="button"
                    onClick={() => setDetailTab('roster')}
                    className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${detailTab === 'roster'
                      ? 'border-[#21398A] text-[#21398A]'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                  >
                    Danh sách học sinh ({rosterStudents.length})
                  </button>
                  {!selectedClassEnded && (
                    <button
                      type="button"
                      onClick={() => setDetailTab('evals')}
                      className={`pb-2 text-sm font-bold border-b-2 transition-all cursor-pointer ${detailTab === 'evals'
                        ? 'border-[#21398A] text-[#21398A]'
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                    >
                      Nhận xét & Đánh giá của GV
                    </button>
                  )}
                </div>

                {/* Hàng nút thao tác email, gửi báo cáo... khi có học sinh được chọn */}
                {(detailTab === 'roster' || selectedClassEnded) && validSelectedRosterStudents.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 p-1.5 rounded-2xl animate-fade-in text-xs self-start sm:self-auto">
                    <span className="font-extrabold text-slate-500 mr-2 ml-1 text-xs">Chọn ({validSelectedRosterStudents.length}):</span>

                    <button
                      type="button"
                      onClick={() => {
                        if (!checkPermission('perm_class_send_email')) return;
                        setEmailType('bulk');
                        setEmailSubject(`[THT Center] Thông báo gửi phụ huynh học sinh lớp ${selectedClass.name}`);
                        setEmailBody('');
                        setShowEmailModal(true);
                      }}
                      className="px-3.5 py-2 bg-[#21398A] text-white rounded-xl font-extrabold hover:bg-[#1a2d6e] transition-colors cursor-pointer text-xs"
                    >
                      Email chung
                    </button>


                    <button
                      type="button"
                      onClick={() => {
                        if (!checkPermission('perm_class_send_report')) return;
                        const defaultSubject = `[THT Center] Báo cáo học tập định kỳ lớp ${selectedClass.name}`;
                        const defaultBody = `Kính gửi Quý Phụ huynh,\n\nTrung tâm THT xin gửi đến Quý Phụ huynh Báo cáo Học kỳ II của bạn {{studentName}} - lớp {{className}} - Giáo viên chủ nhiệm : {{teacherName}}.\n\nQuý Phụ huynh vui lòng xem báo cáo chi tiết trong file đính kèm. Nội dung báo cáo có thể được trao đổi thêm khi cần thiết để hỗ trợ tốt hơn cho quá trình học tập của học sinh.\n\nTrung tâm khuyến khích Quý Phụ huynh nên tải về và lưu báo cáo lại trong thư mục cá nhân để có thể tiếp tục truy cập sau này. Nếu Quý Phụ huynh cần nhận bản in của báo cáo, vui lòng liên hệ bộ phận tư vấn để được hỗ trợ.\n\nNếu Quý Phụ huynh bất kỳ thắc mắc hoặc câu hỏi nào về báo cáo kết quả học tập này, vui lòng liên hệ bộ phận tư vấn qua số điện thoại 0931 277 200 - Ms Nhiên hoặc 0931 201 516 - Ms. Thuỳ\n\nTrân trọng,\nTrung Tâm Phát Triển Giáo Dục Quốc Tế THT.\n\nChú ý: Đây là email tự động từ hệ thống, vui lòng không phản hồi (reply) lại email này.\n\n--------------------------------------------------------------------\n\nDear Parents,\n\nWe are pleased to share with you the Semester II Report of {{studentName}} – {{className}} (Homeroom Teacher: {{teacherName}}).\n\nPlease kindly find the detailed report in the attached file. The report content can be further discussed if necessary to better support the student’s learning progress.\n\nWe encourage you to download and save the attachment in your personal records for future reference. Should you need a hard copy for official documentation, please contact the student affairs office for assistance.\n\nIf you have any questions or concerns regarding this report, please contact our support team at 0931 277 200 - Ms Nhien or 0931 201 516 - Ms. Thuy\n\nWarm regards,\nTHT International Education Development Center.\n\nNote: This is an automated email from our system, please do not reply to this email.`;

                        setBulkReportSubject(defaultSubject);
                        setBulkReportBody(defaultBody);

                        const initialFiles: Record<string, File | null> = {};
                        const initialStatuses: Record<string, 'pending' | 'sending' | 'sent' | 'error'> = {};
                        const initialSubjects: Record<string, string> = {};
                        const initialBodies: Record<string, string> = {};

                        const teacherObj = teachersList.find(t => t.id === selectedClass.teacher || t.name === selectedClass.teacher);
                        const teacherName = teacherObj ? teacherObj.name : (selectedClass.teacher || 'Chưa phân công');

                        validSelectedRosterStudents.forEach(name => {
                          const std = rosterStudents.find(s => s.name === name);
                          if (std) {
                            initialFiles[std.id] = null;
                            initialStatuses[std.id] = 'pending';
                            initialSubjects[std.id] = defaultSubject
                              .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, std.name)
                              .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
                              .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName);

                            const plainBody = defaultBody
                              .replace(/\{\s*\{\s*studentName\s*\}\s*\}/g, std.name)
                              .replace(/\{\s*\{\s*className\s*\}\s*\}/g, selectedClass.name)
                              .replace(/\{\s*\{\s*teacherName\s*\}\s*\}/g, teacherName);
                            initialBodies[std.id] = formatWarningText(plainBody.replace(/\n/g, '<br/>'));
                          }
                        });
                        setBulkReportFiles(initialFiles);
                        setBulkReportStatuses(initialStatuses);
                        setBulkReportSubjects(initialSubjects);
                        setBulkReportBodies(initialBodies);
                        setActiveView('bulk-report');
                      }}
                      className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-extrabold hover:bg-indigo-700 transition-colors cursor-pointer text-xs"
                    >
                      Gửi báo cáo học kỳ
                    </button>

                    {validSelectedRosterStudents.length === 1 && (() => {
                      const selectedStdName = validSelectedRosterStudents[0];
                      const stdObj = rosterStudents.find(s => s.name === selectedStdName);
                      if (!stdObj) return null;
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (!checkPermission('perm_student_transfer')) return;
                              if (stdObj) {
                                setTransferStudent(stdObj);
                                setTransferNewClassName('');
                                setTransferNewStatus(stdObj.status || 'Đang học');
                                setTransferNote('');
                                setTransferSendEmail(true);
                                setShowTransferModal(true);
                              }
                            }}
                            className="px-3.5 py-2 bg-indigo-600 text-white rounded-xl font-extrabold hover:bg-indigo-700 transition-colors cursor-pointer text-xs"
                          >
                            Chuyển lớp
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!checkPermission('perm_student_stop')) return;
                              if (stdObj) {
                                setStopStudent(stdObj);
                                setStopStatus(stdObj.status === 'Học thử' ? 'Nghỉ học' : 'Tạm ngưng');
                                setStopDate(new Date().toISOString().split('T')[0]);
                                setStopReason('');
                                setShowStopModal(true);
                              }
                            }}
                            className="px-3.5 py-2 bg-red-600 text-white rounded-xl font-extrabold hover:bg-red-700 transition-colors cursor-pointer text-xs"
                          >
                            Dừng học
                          </button>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {detailTab === 'roster' || selectedClassEnded ? (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      <span>Học viên của lớp ({rosterStudents.length})</span>
                    </h4>
                  </div>

                  {selectedClassEnded ? (
                    <div className="p-8 text-center bg-slate-50 text-slate-400 text-xs font-medium rounded-xl border border-dashed border-slate-200">
                      Không có học viên vì lớp này đã kết thúc
                    </div>
                  ) : loadingRoster ? (
                    <div className="py-8 text-center text-slate-400 text-xs animate-pulse flex flex-col items-center justify-center gap-1.5">
                      <RefreshCw size={16} className="animate-spin text-[#21398A]" />
                      <span>Đang tải danh sách học viên...</span>
                    </div>
                  ) : rosterStudents.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 text-slate-400 text-xs font-medium rounded-xl border border-dashed border-slate-200">
                      Chưa có học sinh nào đăng ký học lớp này.
                    </div>
                  ) : (() => {
                    const getAttendanceCellBadge = (status: string) => {
                      const s = String(status || '').trim().toUpperCase();
                      if (s === 'A' || s === '✓' || s === 'X' || s.includes('MẶT') || s.includes('ĐI HỌC') || s.includes('PRESENT')) {
                        return (
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold border border-emerald-100 text-[10px]" title="Có mặt / Đi học">
                            A
                          </span>
                        );
                      }
                      if (s === 'C' || s === 'P' || s.includes('PHÉP') || s.includes('EXCUSED')) {
                        return (
                          <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-bold border border-amber-100 text-[10px]" title="Nghỉ có phép">
                            C
                          </span>
                        );
                      }
                      if (s === 'K' || s === 'V' || s === '✗' || s.includes('VẮNG') || s.includes('ABSENT') || s.includes('NGHỈ KHÔNG PHÉP')) {
                        return (
                          <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 rounded font-bold border border-rose-100 text-[10px]" title="Nghỉ không phép">
                            K
                          </span>
                        );
                      }
                      if (!s || s === '—' || s === '-') {
                        return <span className="text-slate-300 font-bold">—</span>;
                      }
                      return (
                        <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded font-bold border border-slate-200 text-[10px]" title={status}>
                          {status}
                        </span>
                      );
                    };

                    const sortedHeaders = [...rosterAttendanceHeaders].sort((a, b) => {
                      const dateA = parseToDate(a);
                      const dateB = parseToDate(b);
                      const distA = Math.abs(dateA.getTime() - new Date().getTime());
                      const distB = Math.abs(dateB.getTime() - new Date().getTime());
                      return distA - distB;
                    });

                    const getAttendanceCellSelect = (studentId: string, dateStr: string, currentStatus: string) => {
                      const s = String(currentStatus || '').trim().toUpperCase();
                      let normalizedStatus = '—';
                      if (s === 'A' || s === '✓' || s === 'X' || s.includes('MẶT') || s.includes('ĐI HỌC') || s.includes('PRESENT')) {
                        normalizedStatus = 'A';
                      } else if (s === 'C' || s === 'P' || s.includes('PHÉP') || s.includes('EXCUSED')) {
                        normalizedStatus = 'C';
                      } else if (s === 'K' || s === 'V' || s === '✗' || s.includes('VẮNG') || s.includes('ABSENT') || s.includes('NGHỈ KHÔNG PHÉP')) {
                        normalizedStatus = 'K';
                      } else {
                        normalizedStatus = '—';
                      }

                      let selectColorClass = 'bg-slate-100 text-slate-400 border-slate-200';
                      if (normalizedStatus === 'A') selectColorClass = 'bg-[#10B981] text-white border-transparent font-black shadow-xs hover:brightness-105';
                      else if (normalizedStatus === 'C') selectColorClass = 'bg-[#F59E0B] text-white border-transparent font-black shadow-xs hover:brightness-105';
                      else if (normalizedStatus === 'K') selectColorClass = 'bg-[#EF4444] text-white border-transparent font-black shadow-xs hover:brightness-105';

                      return (
                        <div className="flex items-center justify-center">
                          <select
                            value={normalizedStatus}
                            onChange={(e) => handleSingleCellAttendance(studentId, dateStr, e.target.value)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-center font-bold text-xs cursor-pointer transition-all outline-none focus:ring-2 focus:ring-[#21398A]/30 focus:ring-offset-1 ${selectColorClass}`}
                            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', padding: 0, textAlignLast: 'center', textAlign: 'center' }}
                          >
                            <option value="—" className="bg-white text-slate-400 font-bold text-center">—</option>
                            <option value="A" className="bg-white text-[#10B981] font-bold text-center">✓</option>
                            <option value="C" className="bg-white text-[#F59E0B] font-bold text-center">P</option>
                            <option value="K" className="bg-white text-[#EF4444] font-bold text-center">✗</option>
                          </select>
                        </div>
                      );
                    };

                    return (
                      <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-xs">
                        <table className="min-w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold sticky top-0 z-10 shadow-xs">
                              <th className="p-2.5 text-center w-8 bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={validSelectedRosterStudents.length === rosterStudents.filter(s => s.name).length && rosterStudents.length > 0}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRosterStudents(rosterStudents.filter(s => s.name).map(s => s.name));
                                    } else {
                                      setSelectedRosterStudents([]);
                                    }
                                  }}
                                  className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                                />
                              </th>
                              <th className="p-2.5 text-center w-10 bg-slate-50">STT</th>
                              <th className="p-2.5 text-left bg-slate-50 min-w-[150px] whitespace-nowrap">Học sinh</th>
                              <th className="p-2.5 text-center bg-slate-50 min-w-[110px] whitespace-nowrap">Trạng thái</th>
                              <th className="p-2.5 text-center bg-slate-50">Nhập học</th>
                              {sortedHeaders.map((date) => {
                                const parts = date.split('|');
                                const rawHeader = parts[0].trim();
                                const teacherName = parts[1] ? parts[1].trim() : '';
                                const { dateDisplay, caName } = formatHeaderDate(rawHeader);
                                const displayName = getCaName(caName);
                                return (
                                  <th key={date} className="p-2.5 text-center whitespace-nowrap min-w-[90px] bg-slate-50">
                                    <div className="font-bold text-slate-700">{dateDisplay}</div>
                                    {displayName && <div className="text-[9px] text-slate-400 mt-0.5 font-bold tracking-tight">{displayName}</div>}
                                    {teacherName && <div className="text-[9px] text-[#21398A] mt-0.5 font-bold tracking-tight bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/50 inline-block">{teacherName}</div>}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rosterStudents.map((std, sidx) => {
                              const isChecked = validSelectedRosterStudents.includes(std.name);
                              const statusRaw = String(std.status || 'Đang học').trim();

                              const getStatusBadge = (status: string) => {
                                if (status === 'Đang học') return <span className="px-1.5 py-0.5 bg-green-50 text-green-600 rounded-md font-bold border border-green-100 text-[9px]">Đang học</span>;
                                if (status === 'Học thử') return <span className="px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md font-bold border border-amber-100 text-[9px]">Học thử</span>;
                                if (status === 'Dừng học' || status === 'Kết thúc' || status === 'Nghỉ học' || status === 'Tạm ngưng') {
                                  return <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded-md font-bold border border-red-100 text-[9px]">{status}</span>;
                                }
                                return <span className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded-md font-bold border border-slate-200/60 text-[9px]">{status || 'Khác'}</span>;
                              };

                              return (
                                <tr key={std.id || sidx} className={`hover:bg-slate-50/50 transition-colors ${isChecked ? 'bg-blue-50/20' : ''}`}>
                                  <td className="p-2.5 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedRosterStudents(prev => {
                                          if (prev.includes(std.name)) {
                                            return prev.filter(n => n !== std.name);
                                          } else {
                                            return [...prev, std.name];
                                          }
                                        });
                                      }}
                                      className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-2.5 text-center text-slate-400 font-bold">{sidx + 1}</td>
                                  <td className="p-2.5 text-left whitespace-nowrap">
                                    <div className="font-bold text-slate-800">{std.name}</div>
                                  </td>
                                  <td className="p-2.5 text-center whitespace-nowrap">{getStatusBadge(statusRaw)}</td>
                                  <td className="p-2.5 text-center text-slate-500 font-medium">{formatAnyDate(std.start) || '—'}</td>
                                  {sortedHeaders.map((date) => {
                                    const parts = date.split('|');
                                    const rawHeader = parts[0].trim();
                                    const status = std.attendance ? std.attendance[rawHeader] : '';
                                    return (
                                      <td key={date} className="p-2.5 text-center">
                                        {getAttendanceCellSelect(std.id, rawHeader, status)}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="space-y-4">
                  {rosterStudents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-sm">Lớp chưa có học sinh để đánh giá.</div>
                  ) : (
                    <div className="divide-y divide-slate-100 pr-1">
                      {rosterStudents.map((std, idx) => (
                        <div key={std.id || idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100/50">
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800 text-sm">{std.name}</span>
                              <span className="text-[10px] text-slate-400 font-extrabold uppercase">{std.id}</span>
                            </div>
                            <div className="text-xs text-slate-500 font-medium whitespace-pre-line leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[50px]">
                              {std.eval ? std.eval : <span className="italic text-slate-400">Chưa có nhận xét nào từ giáo viên.</span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEvalStudentInfo({
                                id: std.id,
                                name: std.name,
                                enrollId: std.enrollId,
                                className: selectedClass.name,
                                currentNote: std.eval || ''
                              });
                              setNewEvalNote('');
                              setShowEvalModal(true);
                            }}
                            className="px-3.5 py-2 bg-slate-50 text-slate-600 hover:text-white hover:bg-[#21398A] border border-slate-200 hover:border-[#21398A] rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit size={12} />
                            <span>Đánh giá</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Danh sách Lớp học</h1>
                <p className="text-slate-500 mt-1 text-xs sm:text-sm">
                  Quản lý thời khóa biểu, giáo viên phụ trách, sỹ số học viên và phòng học của trung tâm.
                </p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 self-start md:self-auto">
                <button
                  onClick={fetchClasses}
                  disabled={loading}
                  className="tht-btn-outline"
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  <span>Tải lại danh sách</span>
                </button>
                <button
                  onClick={() => {
                    if (!checkPermission('perm_class_add')) return;
                    resetForm();
                    setShowAddPanel(true);
                  }}
                  className="tht-btn-primary"
                >
                  <Plus size={18} />
                  <span>Thêm lớp học mới</span>
                </button>
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              <div className="tht-kpi-card tht-kpi-card-left group">
                <div className="tht-kpi-icon-wrapper tht-kpi-icon-primary">
                  <BookOpen size={24} />
                </div>
                <div>
                  <span className="tht-kpi-label">Tổng số lớp học</span>
                  <span className="tht-kpi-value tht-kpi-value-primary">{loading ? '...' : <AnimatedNumber value={totalClasses} />}</span>
                </div>
              </div>

              <div className="tht-kpi-card tht-kpi-card-left group">
                <div className="tht-kpi-icon-wrapper tht-kpi-icon-emerald">
                  <CheckCircle size={24} />
                </div>
                <div>
                  <span className="tht-kpi-label">Lớp đang hoạt động</span>
                  <span className="tht-kpi-value tht-kpi-value-emerald">{loading ? '...' : <AnimatedNumber value={activeCount} />}</span>
                </div>
              </div>

              <div className="tht-kpi-card tht-kpi-card-left group">
                <div className="tht-kpi-icon-wrapper tht-kpi-icon-amber">
                  <Clock size={24} />
                </div>
                <div>
                  <span className="tht-kpi-label">Lớp đã kết thúc</span>
                  <span className="tht-kpi-value tht-kpi-value-amber">{loading ? '...' : <AnimatedNumber value={endedCount} />}</span>
                </div>
              </div>
            </div>

            {/* Search & Actions Bar */}
            <div className="tht-toolbar">
              {/* Tabs Filters */}
              <div className="tht-mobile-tabs-container tht-toolbar-tabs">
                {[
                  { id: 'all', name: `Tất cả lớp`, color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
                  { id: 'active', name: `Đang học`, color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                  { id: 'ended', name: `Đã kết thúc`, color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' }
                ].map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`tht-tab-btn flex-shrink-0 ${isActive ? 'tht-tab-btn-active' : tab.color}`}
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
                      placeholder="Tìm kiếm theo Tên lớp, Giáo viên..."
                      className="tht-search-input"
                    />
                  </div>
                </div>

                <div className="tht-found-count">
                  <BookOpen size={16} className="text-[#21398A]" />
                  <span>Tìm thấy: <strong className="text-slate-800">{filteredClasses.length}</strong> lớp học</span>
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[300px]">
              {loading ? (
                <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
                  <RefreshCw size={24} className="animate-spin text-[#21398A]" />
                  <span>Đang tải dữ liệu...</span>
                </div>
              ) : filteredClasses.length === 0 ? (
                <div className="py-24 text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
                  <BookOpen size={48} className="text-slate-200" />
                  <span>Không tìm thấy lớp học nào khớp với từ khóa tìm kiếm.</span>
                </div>
              ) : (
                <>
                  {/* Desktop View: Table */}
                  <div className="hidden md:block tht-table-wrapper">
                    <table className="tht-table">
                      <thead className="tht-table-thead">
                        <tr>
                          <th className="tht-table-th text-left">Tên lớp học</th>
                          <th className="tht-table-th text-left">Giáo viên chủ nhiệm</th>
                          <th className="tht-table-th text-center">Thời gian khóa học</th>
                          <th className="tht-table-th text-center">Sĩ số</th>
                          <th className="tht-table-th text-center">Học thử</th>
                          <th className="tht-table-th text-center">Trạng thái</th>
                          <th className="tht-table-th text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="tht-table-tbody">
                        {paginatedClasses.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => {
                              setSelectedClass(item);
                              setDetailTab('roster');
                              fetchRoster(item.name, item.status);
                              setActiveView('detail');
                            }}
                            className="tht-table-tr cursor-pointer group hover:bg-slate-50/50"
                          >
                            <td className="tht-table-td text-left">
                              <div className="font-semibold text-[#21398A] group-hover:underline text-sm">{item.name}</div>
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{item.id}</span>
                            </td>
                            <td className="tht-table-td text-left">
                              <div className="flex items-center gap-1.5 font-medium text-slate-600 text-sm">
                                <User size={14} className="text-slate-400" />
                                <span>{item.teacher || 'Chưa phân công'}</span>
                              </div>
                            </td>
                            <td className="tht-table-td text-center">
                              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-semibold">
                                <Calendar size={12} className="text-slate-400" />
                                <span>{formatAnyDate(item.startDate) || '—'}</span>
                                <span className="text-slate-400 font-normal">đến</span>
                                <span>{formatAnyDate(item.endDate) || '—'}</span>
                              </div>
                            </td>
                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              <span className="font-extrabold text-slate-700 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-md text-xs">{item.totalStudents ?? 0}</span>
                            </td>
                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              <span className="font-extrabold text-amber-700 bg-amber-50 border border-amber-150 px-2 py-0.5 rounded-md text-xs">{item.trialStudents ?? 0}</span>
                            </td>

                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              {getStatusBadge(item.status)}
                            </td>
                            <td className="tht-table-td text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedClass(item);
                                    setDetailTab('roster');
                                    fetchRoster(item.name, item.status);
                                    setActiveView('detail');
                                  }}
                                  className="tht-text-action-btn tht-text-action-btn-gray"
                                >
                                  <Eye size={14} />
                                  <span>Chi tiết</span>
                                </button>
                                {!isClassEnded(item.status) && (isAdmin || userPerms['perm_attendance_today']) && (
                                  <button
                                    onClick={() => {
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
                                {!isClassEnded(item.status) && (isAdmin || userPerms['perm_class_edit']) && (
                                  <button
                                    onClick={() => {
                                      setSelectedClass(item);
                                      loadClassIntoForm(item);
                                      setShowEditPanel(true);
                                    }}
                                    className="tht-text-action-btn tht-text-action-btn-blue"
                                  >
                                    <Edit size={14} />
                                    <span>Sửa</span>
                                  </button>
                                )}
                                {(isAdmin || userPerms['perm_class_delete']) && (
                                  <button
                                    onClick={() => {
                                      handleDeleteClass(item);
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

                  {/* Mobile View: Class Card List */}
                  <div className="md:hidden space-y-3 p-4 bg-slate-50/50">
                    {paginatedClasses.map((item) => (
                      <div
                        key={item.id}
                        className="tht-mobile-card cursor-pointer"
                        onClick={() => {
                          setSelectedClass(item);
                          setDetailTab('roster');
                          fetchRoster(item.name, item.status);
                          setActiveView('detail');
                        }}
                      >
                        {/* Card Header */}
                        <div className="tht-mobile-card-header">
                          <div>
                            <div className="font-bold text-[#21398A] text-sm hover:underline">{item.name}</div>
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">{item.id}</span>
                          </div>
                          {getStatusBadge(item.status)}
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
                              <Calendar size={12} className="text-slate-400" />
                              <span>Thời gian:</span>
                            </span>
                            <span className="tht-mobile-card-value text-slate-600 text-[11px]">
                              {formatAnyDate(item.startDate) || '—'} → {formatAnyDate(item.endDate) || '—'}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
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
                        </div>

                        {/* Actions Row */}
                        <div className="tht-mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedClass(item);
                              setDetailTab('roster');
                              fetchRoster(item.name, item.status);
                              setActiveView('detail');
                            }}
                            className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg border border-slate-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>
                          {!isClassEnded(item.status) && (isAdmin || userPerms['perm_attendance_today']) && (
                            <button
                              onClick={() => {
                                setSelectedClassForAttendance(item);
                                setShowAttendancePanel(true);
                                fetchStudentsForClass(item);
                              }}
                              className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg border border-emerald-200/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <ClipboardCheck size={12} />
                              <span>Điểm danh</span>
                            </button>
                          )}
                          {!isClassEnded(item.status) && (isAdmin || userPerms['perm_class_edit']) && (
                            <button
                              onClick={() => {
                                setSelectedClass(item);
                                loadClassIntoForm(item);
                                setShowEditPanel(true);
                              }}
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200/50 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Edit size={12} />
                              <span>Sửa</span>
                            </button>
                          )}
                          {(isAdmin || userPerms['perm_class_delete']) && (
                            <button
                              onClick={() => {
                                handleDeleteClass(item);
                              }}
                              className="px-2 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg border border-red-200 text-[10px] font-bold flex items-center gap-1 transition-all"
                            >
                              <Trash2 size={12} />
                              <span>Xóa</span>
                            </button>
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
                        <span>{Math.min(startIndex + itemsPerPage, filteredClasses.length)}</span> trong tổng số <span>{filteredClasses.length}</span> lớp học
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
          </div>
        )) : null}

      {/* Side Panel: Thêm Lớp học */}
      {showAddPanel && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 animate-fade-in w-full max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Thêm Lớp học mới</h1>
              <p className="text-xs text-slate-500 mt-1">Cấu hình thông tin cơ bản, ca học, phòng học và giáo viên On-Air.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddPanel(false);
                  resetForm();
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-sm transition-all"
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                form="form-add-class"
                className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Tạo lớp học</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {showAddPanel && (
            <div className="space-y-6">
              <form id="form-add-class" onSubmit={handleAddClass} className="space-y-6">
                {/* Thông tin cơ bản */}
                <div className="space-y-4">
                  {/* Hàng 1: tên lớp học, khối kinh doanh, khối lớp, nhóm lớp */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Tên lớp học *</label>
                      <input
                        type="text"
                        required
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="Ví dụ: THT-Kid-01"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Khối kinh doanh</label>
                      <select
                        value={businessBlock}
                        onChange={(e) => setBusinessBlock(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Lê Hồng Phong">Lê Hồng Phong</option>
                        <option value="Huỳnh Thúc Kháng">Huỳnh Thúc Kháng</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Khối lớp (KhoiLop)</label>
                      <select
                        value={selectedKhoiId}
                        onChange={(e) => {
                          setSelectedKhoiId(e.target.value);
                          setSelectedNhomId('');
                        }}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn khối lớp --</option>
                        {levels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Nhóm lớp (NhomLop)</label>
                      <select
                        value={selectedNhomId}
                        onChange={(e) => setSelectedNhomId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn nhóm lớp --</option>
                        {groups
                          .filter((g) => !selectedKhoiId || g.khoiId === selectedKhoiId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Hàng 2: hình thức học, tổng số buổi, học phí, trạng thái lớp học */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Hình thức học phí</label>
                      <select
                        value={studyType}
                        onChange={(e) => setStudyType(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Theo tháng">Theo tháng</option>
                        <option value="Theo khóa">Theo khóa</option>
                        <option value="Theo giờ">Theo giờ</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className={`text-xs font-bold flex items-center gap-1 ${isCourseOrHourly ? 'text-[#21398A]' : 'text-slate-600'}`}>
                        <span>Tổng số buổi *</span>
                        <span className="text-[10px] text-slate-400 font-semibold">(Số buổi học thực tế)</span>
                      </label>
                      <input
                        type="number"
                        required={isCourseOrHourly}
                        disabled={!isCourseOrHourly}
                        min={1}
                        value={totalSessions || ''}
                        onChange={(e) => setTotalSessions(parseInt(e.target.value, 10) || 0)}
                        placeholder="Ví dụ: 12"
                        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:border-[#21398A] transition-all ${!isCourseOrHourly
                          ? 'bg-slate-200 border-slate-300 text-slate-800 font-extrabold cursor-not-allowed shadow-inner'
                          : 'bg-slate-50 border-slate-200 text-slate-700 font-black'
                          }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Học phí (VND)</label>
                      <input
                        type="text"
                        value={fee ? formatVietnameseNumber(fee) : ''}
                        onChange={(e) => setFee(parseVietnameseNumber(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-extrabold text-[#21398A]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Trạng thái lớp học</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Đang học">Đang học</option>
                        <option value="Kết thúc">Kết thúc</option>
                      </select>
                    </div>
                  </div>

                  {/* Hàng 3: ngày bắt đầu, ngày kết thúc, giáo viên chủ nhiệm */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Ngày bắt đầu</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Ngày kết thúc</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        readOnly={isCourseOrHourly}
                        title={isCourseOrHourly ? 'Ngày kết thúc được tự động tính toán dựa trên Ngày bắt đầu, Lịch học cố định và Tổng số buổi (đã tự động bỏ qua các ngày nghỉ lễ).' : undefined}
                        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:border-[#21398A] transition-all font-semibold ${isCourseOrHourly
                          ? 'bg-slate-200 border-slate-300 text-slate-800 font-extrabold cursor-not-allowed shadow-inner'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Giáo viên chủ nhiệm (GVCN)</label>
                      <select
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn giáo viên --</option>
                        {teachersList
                          .filter((t) => isEnglishTeacher(t.dept))
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Schedule Configurator */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar size={16} className="text-[#21398A]" />
                      <span>Cấu hình lịch học cố định trong tuần</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nhấp chọn Thứ để cấu hình Giáo viên On-Air và chọn nhanh phòng/ca học tương ứng từ lưới.
                    </p>
                  </div>

                  {/* Horizontal Day Tabs */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
                    {([
                      { key: 1, label: 'Thứ 2' },
                      { key: 2, label: 'Thứ 3' },
                      { key: 3, label: 'Thứ 4' },
                      { key: 4, label: 'Thứ 5' },
                      { key: 5, label: 'Thứ 6' },
                      { key: 6, label: 'Thứ 7' },
                      { key: 0, label: 'Chủ Nhật' },
                    ] as const).map((d) => {
                      const daySessions = scheduleConfig[d.key] || [];
                      const count = daySessions.length;
                      const isCurrent = activeConfigDay === d.key;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setActiveConfigDay(d.key)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isCurrent
                            ? 'bg-[#21398A] text-white shadow-sm shadow-[#21398a]/10'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                            }`}
                        >
                          <span>{d.label}</span>
                          {count > 0 && (
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${isCurrent ? 'bg-white text-[#21398A]' : 'bg-[#21398A] text-white'
                              }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Day Specific Config Section */}
                  {(() => {
                    const currentDayObj = [
                      { key: 1, label: 'Thứ 2' },
                      { key: 2, label: 'Thứ 3' },
                      { key: 3, label: 'Thứ 4' },
                      { key: 4, label: 'Thứ 5' },
                      { key: 5, label: 'Thứ 6' },
                      { key: 6, label: 'Thứ 7' },
                      { key: 0, label: 'Chủ Nhật' },
                    ].find(d => d.key === activeConfigDay)!;

                    const currentSessions = scheduleConfig[activeConfigDay] || [];

                    return (
                      <div className="space-y-4 animate-fade-in">
                        {/* Lưới chọn Phòng & Ca học */}
                        {(() => {
                          return (
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Lưới chọn phòng & ca học ({currentDayObj.label})
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-medium">Nhấp ô Trống để chọn / Hủy chọn. Cuộn ngang/dọc để xem đầy đủ.</span>
                                </div>

                                <div className="relative flex items-center w-full sm:w-72">
                                  <div className="absolute left-3 text-slate-400">
                                    <Search size={14} />
                                  </div>
                                  <input
                                    type="text"
                                    value={gridSearchQuery}
                                    onChange={(e) => setGridSearchQuery(e.target.value)}
                                    placeholder="Tìm phòng, ca, tên lớp học..."
                                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700 shadow-xs"
                                  />
                                  {gridSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setGridSearchQuery('')}
                                      className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                      title="Xóa tìm kiếm"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Grid Table Container */}
                              <div className="w-full max-w-full overflow-auto rounded-2xl border border-slate-200/60 bg-white max-h-[300px] grid-scroll-container">
                                <ScheduleGrid
                                  filteredGridShifts={filteredGridShifts}
                                  filteredGridRooms={filteredGridRooms}
                                  occupancyMap={occupancyMap}
                                  selectedSet={selectedSet}
                                  conflictMap={conflictMap}
                                  activeConfigDay={activeConfigDay}
                                  toggleCellSelection={toggleCellSelection}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Cấu hình chi tiết Giáo viên On-Air cho từng ca đã chọn */}
                        <div className="space-y-3 pt-3 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Cấu hình Giáo viên On-Air cho từng Ca học ({currentDayObj.label})
                          </h4>

                          {currentSessions.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              Chưa chọn ca học nào cho ngày này. Vui lòng nhấp chọn trên lưới ở trên.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {currentSessions.map((session, sIdx) => {
                                const roomObj = roomsList.find(r => r.id === session.room);
                                const shiftObj = shiftsList.find(s => s.id === session.ca || s.name === session.ca);
                                const displayName = `${shiftObj ? shiftObj.name : session.ca} (${shiftObj ? `${shiftObj.startTime} - ${shiftObj.endTime}` : session.time}) tại ${roomObj ? roomObj.name : session.room}`;

                                const updateSessionOnAir = (field: string, val: string) => {
                                  setScheduleConfig(prev => {
                                    const daySessions = prev[activeConfigDay] ? [...prev[activeConfigDay]] : [];
                                    if (daySessions[sIdx]) {
                                      daySessions[sIdx] = {
                                        ...daySessions[sIdx],
                                        [field]: val
                                      };
                                    }
                                    return {
                                      ...prev,
                                      [activeConfigDay]: daySessions
                                    };
                                  });
                                };

                                return (
                                  <div key={`${session.ca}-${session.room}-${sIdx}`} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-extrabold text-[#21398A] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50">
                                        {displayName}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleCellSelection(activeConfigDay, session.room, session.ca)}
                                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline"
                                      >
                                        Hủy chọn ca này
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {/* On Air 1 */}
                                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200/40">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Giáo viên On-Air 1</span>
                                        <div className="grid grid-cols-1 gap-2">
                                          <select
                                            value={session.oa1}
                                            onChange={(e) => updateSessionOnAir('oa1', e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                                          >
                                            <option value="">-- Chọn On-Air 1 --</option>
                                            {teachersList
                                              .filter((t) => isEnglishTeacher(t.dept) || t.id === session.oa1)
                                              .map((t) => (
                                                <option key={t.id} value={t.id}>
                                                  {t.name}
                                                </option>
                                              ))}
                                          </select>
                                          <div className="grid grid-cols-2 gap-2">
                                            <input
                                              type="text"
                                              placeholder="Bắt đầu"
                                              value={session.oa1Start}
                                              onChange={(e) => updateSessionOnAir('oa1Start', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                            <input
                                              type="text"
                                              placeholder="Kết thúc"
                                              value={session.oa1End}
                                              onChange={(e) => updateSessionOnAir('oa1End', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* On Air 2 */}
                                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200/40">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Giáo viên On-Air 2</span>
                                        <div className="grid grid-cols-1 gap-2">
                                          <select
                                            value={session.oa2}
                                            onChange={(e) => updateSessionOnAir('oa2', e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                                          >
                                            <option value="">-- Chọn On-Air 2 --</option>
                                            {teachersList
                                              .filter((t) => isEnglishTeacher(t.dept) || t.id === session.oa2)
                                              .map((t) => (
                                                <option key={t.id} value={t.id}>
                                                  {t.name}
                                                </option>
                                              ))}
                                          </select>
                                          <div className="grid grid-cols-2 gap-2">
                                            <input
                                              type="text"
                                              placeholder="Bắt đầu"
                                              value={session.oa2Start}
                                              onChange={(e) => updateSessionOnAir('oa2Start', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                            <input
                                              type="text"
                                              placeholder="Kết thúc"
                                              value={session.oa2End}
                                              onChange={(e) => updateSessionOnAir('oa2End', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Side Panel: Sửa Lớp học */}
      {showEditPanel && selectedClass && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6 animate-fade-in w-full max-w-full overflow-x-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Chỉnh sửa lớp học: {selectedClass.name}</h1>
              <p className="text-xs text-slate-500 mt-1">Cập nhật thông tin chi tiết và điều chỉnh thời khóa biểu của lớp học.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditPanel(false);
                  resetForm();
                }}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold rounded-xl text-sm transition-all"
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                form="form-edit-class"
                className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5 disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>Lưu thay đổi</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {selectedClass && (
            <div className="space-y-6">
              <form id="form-edit-class" onSubmit={handleEditClass} className="space-y-6">
                {/* Thông tin cơ bản */}
                <div className="space-y-4">
                  {/* Hàng 1: tên lớp học, khối kinh doanh, khối lớp, nhóm lớp */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Tên lớp học *</label>
                      <input
                        type="text"
                        required
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder="Ví dụ: THT-Kid-01"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Khối kinh doanh</label>
                      <select
                        value={businessBlock}
                        onChange={(e) => setBusinessBlock(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Lê Hồng Phong">Lê Hồng Phong</option>
                        <option value="Huỳnh Thúc Kháng">Huỳnh Thúc Kháng</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Khối lớp (KhoiLop)</label>
                      <select
                        value={selectedKhoiId}
                        onChange={(e) => {
                          setSelectedKhoiId(e.target.value);
                          setSelectedNhomId('');
                        }}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn khối lớp --</option>
                        {levels.map((lvl) => (
                          <option key={lvl.id} value={lvl.id}>
                            {lvl.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Nhóm lớp (NhomLop)</label>
                      <select
                        value={selectedNhomId}
                        onChange={(e) => setSelectedNhomId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn nhóm lớp --</option>
                        {groups
                          .filter((g) => !selectedKhoiId || g.khoiId === selectedKhoiId)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Hàng 2: hình thức học, tổng số buổi, học phí, trạng thái lớp học */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Hình thức học phí</label>
                      <select
                        value={studyType}
                        onChange={(e) => setStudyType(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Theo tháng">Theo tháng</option>
                        <option value="Theo khóa">Theo khóa</option>
                        <option value="Theo giờ">Theo giờ</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className={`text-xs font-bold flex items-center gap-1 ${isCourseOrHourly ? 'text-[#21398A]' : 'text-slate-600'}`}>
                        <span>Tổng số buổi *</span>
                        <span className="text-[10px] text-slate-400 font-semibold">(Số buổi học thực tế)</span>
                      </label>
                      <input
                        type="number"
                        required={isCourseOrHourly}
                        disabled={!isCourseOrHourly}
                        min={1}
                        value={totalSessions || ''}
                        onChange={(e) => setTotalSessions(parseInt(e.target.value, 10) || 0)}
                        placeholder="Ví dụ: 12"
                        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:border-[#21398A] transition-all ${!isCourseOrHourly
                          ? 'bg-slate-200 border-slate-300 text-slate-800 font-extrabold cursor-not-allowed shadow-inner'
                          : 'bg-slate-50 border-slate-200 text-slate-700 font-black'
                          }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Học phí (VND)</label>
                      <input
                        type="text"
                        value={fee ? formatVietnameseNumber(fee) : ''}
                        onChange={(e) => setFee(parseVietnameseNumber(e.target.value))}
                        placeholder="0"
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-extrabold text-[#21398A]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Trạng thái lớp học</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="Đang học">Đang học</option>
                        <option value="Kết thúc">Kết thúc</option>
                      </select>
                    </div>
                  </div>

                  {/* Hàng 3: ngày bắt đầu, ngày kết thúc, giáo viên chủ nhiệm */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Ngày bắt đầu</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Ngày kết thúc</label>
                      <input
                        type="date"
                        max="9999-12-31"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        readOnly={isCourseOrHourly}
                        title={isCourseOrHourly ? 'Ngày kết thúc được tự động tính toán dựa trên Ngày bắt đầu, Lịch học cố định và Tổng số buổi (đã tự động bỏ qua các ngày nghỉ lễ).' : undefined}
                        className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:border-[#21398A] transition-all font-semibold ${isCourseOrHourly
                          ? 'bg-slate-200 border-slate-300 text-slate-800 font-extrabold cursor-not-allowed shadow-inner'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-600">Giáo viên chủ nhiệm (GVCN)</label>
                      <select
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700"
                      >
                        <option value="">-- Chọn giáo viên --</option>
                        {teachersList
                          .filter((t) => isEnglishTeacher(t.dept) || t.id === teacherId)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Schedule Configurator */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Calendar size={16} className="text-[#21398A]" />
                      <span>Cấu hình lịch học cố định trong tuần</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nhấp chọn Thứ để cấu hình Giáo viên On-Air và chọn nhanh phòng/ca học tương ứng từ lưới.
                    </p>
                  </div>

                  {/* Horizontal Day Tabs */}
                  <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
                    {([
                      { key: 1, label: 'Thứ 2' },
                      { key: 2, label: 'Thứ 3' },
                      { key: 3, label: 'Thứ 4' },
                      { key: 4, label: 'Thứ 5' },
                      { key: 5, label: 'Thứ 6' },
                      { key: 6, label: 'Thứ 7' },
                      { key: 0, label: 'Chủ Nhật' },
                    ] as const).map((d) => {
                      const daySessions = scheduleConfig[d.key] || [];
                      const count = daySessions.length;
                      const isCurrent = activeConfigDay === d.key;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setActiveConfigDay(d.key)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isCurrent
                            ? 'bg-[#21398A] text-white shadow-sm shadow-[#21398a]/10'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                          <span>{d.label}</span>
                          {count > 0 && (
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-extrabold ${isCurrent ? 'bg-white text-[#21398A]' : 'bg-[#21398A] text-white'
                              }`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Day Specific Config Section */}
                  {(() => {
                    const currentDayObj = [
                      { key: 1, label: 'Thứ 2' },
                      { key: 2, label: 'Thứ 3' },
                      { key: 3, label: 'Thứ 4' },
                      { key: 4, label: 'Thứ 5' },
                      { key: 5, label: 'Thứ 6' },
                      { key: 6, label: 'Thứ 7' },
                      { key: 0, label: 'Chủ Nhật' },
                    ].find(d => d.key === activeConfigDay)!;

                    const currentSessions = scheduleConfig[activeConfigDay] || [];

                    return (
                      <div className="space-y-4 animate-fade-in">
                        {/* Lưới chọn Phòng & Ca học */}
                        {(() => {
                          return (
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Lưới chọn phòng & ca học ({currentDayObj.label})
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-medium">Nhấp ô Trống để chọn / Hủy chọn. Cuộn ngang/dọc để xem đầy đủ.</span>
                                </div>

                                <div className="relative flex items-center w-full sm:w-72">
                                  <div className="absolute left-3 text-slate-400">
                                    <Search size={14} />
                                  </div>
                                  <input
                                    type="text"
                                    value={gridSearchQuery}
                                    onChange={(e) => setGridSearchQuery(e.target.value)}
                                    placeholder="Tìm phòng, ca, tên lớp học..."
                                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-bold text-slate-700 shadow-xs"
                                  />
                                  {gridSearchQuery && (
                                    <button
                                      type="button"
                                      onClick={() => setGridSearchQuery('')}
                                      className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                      title="Xóa tìm kiếm"
                                    >
                                      <X size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Grid Table Container */}
                              <div className="w-full max-w-full overflow-auto rounded-2xl border border-slate-200/60 bg-white max-h-[300px] grid-scroll-container">
                                <ScheduleGrid
                                  filteredGridShifts={filteredGridShifts}
                                  filteredGridRooms={filteredGridRooms}
                                  occupancyMap={occupancyMap}
                                  selectedSet={selectedSet}
                                  conflictMap={conflictMap}
                                  activeConfigDay={activeConfigDay}
                                  toggleCellSelection={toggleCellSelection}
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* Cấu hình chi tiết Giáo viên On-Air cho từng ca đã chọn */}
                        <div className="space-y-3 pt-3 border-t border-slate-200/60">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Cấu hình Giáo viên On-Air cho từng Ca học ({currentDayObj.label})
                          </h4>

                          {currentSessions.length === 0 ? (
                            <div className="py-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                              Chưa chọn ca học nào cho ngày này. Vui lòng nhấp chọn trên lưới ở trên.
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {currentSessions.map((session, sIdx) => {
                                const roomObj = roomsList.find(r => r.id === session.room);
                                const shiftObj = shiftsList.find(s => s.id === session.ca || s.name === session.ca);
                                const displayName = `${shiftObj ? shiftObj.name : session.ca} (${shiftObj ? `${shiftObj.startTime} - ${shiftObj.endTime}` : session.time}) tại ${roomObj ? roomObj.name : session.room}`;

                                const updateSessionOnAir = (field: string, val: string) => {
                                  setScheduleConfig(prev => {
                                    const daySessions = prev[activeConfigDay] ? [...prev[activeConfigDay]] : [];
                                    if (daySessions[sIdx]) {
                                      daySessions[sIdx] = {
                                        ...daySessions[sIdx],
                                        [field]: val
                                      };
                                    }
                                    return {
                                      ...prev,
                                      [activeConfigDay]: daySessions
                                    };
                                  });
                                };

                                return (
                                  <div key={`${session.ca}-${session.room}-${sIdx}`} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3 animate-fade-in">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-extrabold text-[#21398A] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/50">
                                        {displayName}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleCellSelection(activeConfigDay, session.room, session.ca)}
                                        className="text-[10px] text-rose-600 hover:text-rose-700 font-bold hover:underline"
                                      >
                                        Hủy chọn ca này
                                      </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                      {/* On Air 1 */}
                                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200/40">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Giáo viên On-Air 1</span>
                                        <div className="grid grid-cols-1 gap-2">
                                          <select
                                            value={session.oa1 || ''}
                                            onChange={(e) => updateSessionOnAir('oa1', e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                                          >
                                            <option value="">-- Chọn On-Air 1 --</option>
                                            {teachersList
                                              .filter((t) => isEnglishTeacher(t.dept) || t.id === session.oa1)
                                              .map((t) => (
                                                <option key={t.id} value={t.id}>
                                                  {t.name}
                                                </option>
                                              ))}
                                          </select>
                                          <div className="grid grid-cols-2 gap-2">
                                            <input
                                              type="text"
                                              placeholder="Bắt đầu"
                                              value={session.oa1Start || ''}
                                              onChange={(e) => updateSessionOnAir('oa1Start', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                            <input
                                              type="text"
                                              placeholder="Kết thúc"
                                              value={session.oa1End || ''}
                                              onChange={(e) => updateSessionOnAir('oa1End', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                          </div>
                                        </div>
                                      </div>

                                      {/* On Air 2 */}
                                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200/40">
                                        <span className="text-[10px] font-extrabold text-slate-400 uppercase block">Giáo viên On-Air 2</span>
                                        <div className="grid grid-cols-1 gap-2">
                                          <select
                                            value={session.oa2 || ''}
                                            onChange={(e) => updateSessionOnAir('oa2', e.target.value)}
                                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700"
                                          >
                                            <option value="">-- Chọn On-Air 2 --</option>
                                            {teachersList
                                              .filter((t) => isEnglishTeacher(t.dept) || t.id === session.oa2)
                                              .map((t) => (
                                                <option key={t.id} value={t.id}>
                                                  {t.name}
                                                </option>
                                              ))}
                                          </select>
                                          <div className="grid grid-cols-2 gap-2">
                                            <input
                                              type="text"
                                              placeholder="Bắt đầu"
                                              value={session.oa2Start || ''}
                                              onChange={(e) => updateSessionOnAir('oa2Start', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                            <input
                                              type="text"
                                              placeholder="Kết thúc"
                                              value={session.oa2End || ''}
                                              onChange={(e) => updateSessionOnAir('oa2End', e.target.value)}
                                              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#21398A] transition-all font-medium text-slate-700"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Side Panel Điểm danh */}
      {/* Modal Điểm danh */}
      {showAttendancePanel && selectedClassForAttendance && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={handleCloseAttendancePanel}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><ClipboardCheck size={20} /></span>
                  <span>Điểm danh: {selectedClassForAttendance.name}</span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAttendancePanel}
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
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
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
                  <div className="grid grid-cols-4 gap-2 text-center">
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
                    <div className="space-y-4">
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

      {/* Modal: Xóa điểm danh */}
      {showDeleteAttendanceModal && selectedClass && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowDeleteAttendanceModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Trash2 size={18} className="text-red-600" />
                  Xóa điểm danh lớp {selectedClass.name}
                </h3>
                <button onClick={() => setShowDeleteAttendanceModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="tht-input-label">Chọn ngày cần xóa điểm danh *</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={deleteAttendanceDate}
                    onChange={(e) => setDeleteAttendanceDate(e.target.value)}
                    className="tht-input"
                    required
                  />
                </div>
                <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100/50 leading-relaxed">
                  Cảnh báo: Hành động này sẽ xóa vĩnh viễn toàn bộ dữ liệu điểm danh của ngày này trong sheet Data_DiemDanh và sheet lớp riêng!
                </p>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowDeleteAttendanceModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleDeleteAttendance}
                  disabled={savingDeleteAttendance}
                  className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingDeleteAttendance ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang xóa...</span>
                    </>
                  ) : (
                    <span>Xác nhận xóa</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Đánh giá học sinh */}
      {showEvalModal && evalStudentInfo && (
        <Portal>
          <div className="fixed inset-0 z-[1100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowEvalModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-2.5 text-slate-800 font-bold text-lg">
                  <span className="text-[#21398A]"><Edit size={20} /></span>
                  <span>Đánh giá của giáo viên</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex flex-col text-center py-4 bg-slate-50/50 rounded-2xl border border-slate-100/80">
                    <h4 className="text-lg font-extrabold text-slate-800 leading-tight">
                      {evalStudentInfo.name}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">Lớp học: <span className="font-bold text-slate-600">{evalStudentInfo.className}</span></p>
                  </div>

                  <div className="info-section-card space-y-3">
                    <span className="section-card-title section-title-green">
                      <Plus size={16} />
                      Nội dung đánh giá mới *
                    </span>
                    <textarea
                      value={newEvalNote}
                      onChange={(e) => setNewEvalNote(e.target.value)}
                      rows={6}
                      placeholder="Nhập nội dung đánh giá mới tại đây..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-colors text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-y font-medium min-h-[120px]"
                      required
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={handleSaveEvalNote}
                  disabled={savingEval}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2e70] disabled:bg-slate-300 font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 flex items-center gap-1.5 cursor-pointer"
                >
                  {savingEval ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <FileText size={14} />
                      <span>Lưu đánh giá</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}


      {/* Modal: Gửi Email chung / Gửi báo cáo */}
      {showEmailModal && selectedClass && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowEmailModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#21398A]"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  {emailType === 'bulk' ? 'Gửi Email chung đến lớp học' : 'Gửi báo cáo học tập cho từng học sinh'}
                </h3>
                <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600 leading-normal">
                    Người nhận ({validSelectedRosterStudents.length} học viên): <span className="font-bold text-slate-800">{validSelectedRosterStudents.join(', ')}</span>
                  </p>
                </div>

                <div>
                  <label className="tht-input-label">Tiêu đề Email *</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="tht-input font-bold"
                    placeholder="Nhập tiêu đề..."
                    required
                  />
                </div>

                <div>
                  <label className="tht-input-label">Nội dung Email (HTML hỗ trợ) *</label>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Nhập nội dung email..."
                    rows={8}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 font-medium leading-relaxed"
                    required
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowEmailModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={savingEmail}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingEmail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <span>Gửi email</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Chuyển lớp học sinh */}
      {showTransferModal && selectedClass && transferStudent && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowTransferModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw size={18} className="text-indigo-600 animate-spin-slow" />
                  Chuyển lớp cho học sinh
                </h3>
                <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Học sinh: <strong className="text-slate-800">{transferStudent.name}</strong>
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Lớp hiện tại: <span className="font-bold text-slate-600">{selectedClass.name}</span> ({transferStudent.status})</p>
                </div>

                <div>
                  <label className="tht-input-label">Chọn lớp học mới *</label>
                  <select
                    value={transferNewClassName}
                    onChange={(e) => setTransferNewClassName(e.target.value)}
                    className="tht-select font-semibold"
                    required
                  >
                    <option value="">-- Chọn lớp mới --</option>
                    {classes
                      .filter(c => {
                        const trimmedName = String(c.name || '').trim().toLowerCase();
                        const isCurrentClass = trimmedName === String(selectedClass.name || '').trim().toLowerCase();
                        const isAlreadyEnrolled = transferStudentActiveClasses.includes(trimmedName);
                        const isActive = c.status === 'Đang học' || c.status === 'dang hoc';
                        return !isCurrentClass && !isAlreadyEnrolled && isActive;
                      })
                      .map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Chọn trạng thái lớp học mới</label>
                  <select
                    value={transferNewStatus}
                    onChange={(e) => setTransferNewStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Đang học">Đang học</option>
                    <option value="Học thử">Học thử</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Ghi chú lý do chuyển lớp</label>
                  <textarea
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    placeholder="Nhập lý do chuyển lớp..."
                    rows={2}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="classes-transfer-send-email"
                    checked={transferSendEmail}
                    onChange={(e) => setTransferSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="classes-transfer-send-email" className="text-xs font-bold text-slate-500 cursor-pointer">
                    Gửi Email thông báo nhập học cho giáo viên
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowTransferModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={triggerTransferClass}
                  disabled={savingTransfer}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-indigo-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingTransfer ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang chuyển...</span>
                    </>
                  ) : (
                    <span>Xác nhận chuyển</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Dừng học lớp */}
      {showStopModal && selectedClass && stopStudent && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => setShowStopModal(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Pause size={18} className="text-red-500" />
                  Dừng học lớp {selectedClass.name}
                </h3>
                <button onClick={() => setShowStopModal(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    Học sinh: <strong className="text-slate-800">{stopStudent.name}</strong>
                  </p>
                </div>

                <div>
                  <label className="tht-input-label">Chọn trạng thái dừng học</label>
                  <select
                    value={stopStatus}
                    onChange={(e) => setStopStatus(e.target.value)}
                    className="tht-select"
                  >
                    <option value="Tạm ngưng">Tạm ngưng</option>
                    <option value="Bảo lưu">Bảo lưu</option>
                    <option value="Nghỉ học">Nghỉ học</option>
                    <option value="Đang chờ lớp">Đang chờ lớp</option>
                  </select>
                </div>

                <div>
                  <label className="tht-input-label">Ngày kết thúc thực tế *</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    value={stopDate}
                    onChange={(e) => setStopDate(e.target.value)}
                    className="tht-input"
                    required
                  />
                </div>

                <div>
                  <label className="tht-input-label">Lý do dừng học / Ghi chú</label>
                  <textarea
                    value={stopReason}
                    onChange={(e) => setStopReason(e.target.value)}
                    placeholder="Nhập lý do..."
                    rows={3}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:border-[#21398A] outline-none text-sm transition-all text-slate-800 focus:ring-4 focus:ring-[#21398A]/5 resize-none font-medium"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="classes-stop-send-email-cb"
                    checked={stopSendEmail}
                    onChange={(e) => setStopSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="classes-stop-send-email-cb" className="text-xs font-bold text-slate-500 cursor-pointer">
                    Gửi Email thông báo dừng học cho giáo viên
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setShowStopModal(false)} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer">
                  Hủy bỏ
                </button>
                <button
                  onClick={triggerStopClass}
                  disabled={savingStop}
                  className="px-5 py-2.5 bg-red-600 text-white hover:bg-red-700 font-bold rounded-xl text-sm transition-all shadow-md shadow-red-600/10 cursor-pointer flex items-center gap-1.5"
                >
                  {savingStop ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang dừng...</span>
                    </>
                  ) : (
                    <span>Dừng lớp học</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* 6. Modal Email Preview (Super Modal) */}
      <EmailPreviewModal
        show={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        loading={emailPreviewLoading}
        initialRecipients={emailRecipients}
        initialSubject={emailSubjectInput}
        initialHtml={emailHtmlInput}
        selectedClass={selectedClass}
        teachersList={teachersList}
        onConfirm={async (recipients, subject, html) => {
          setShowEmailPreview(false);

          let loadingTitle = 'Đang gửi email...';
          let successTitle = 'Gửi email thành công!';

          if (transferStudent) {
            loadingTitle = 'Đang thực hiện chuyển lớp và gửi email...';
            successTitle = 'Chuyển lớp và gửi email thành công!';
          } else if (stopStudent) {
            loadingTitle = 'Đang thực hiện dừng học và gửi email...';
            successTitle = 'Dừng học và gửi email thành công!';
          } else {
            loadingTitle = 'Đang thêm học sinh và gửi email...';
            successTitle = 'Thêm học sinh và gửi email thành công!';
          }

          await runProgressSimulation(
            async () => {
              await pendingEmailAction(recipients, subject, html);
            },
            loadingTitle,
            successTitle
          );
        }}
      />

      {/* Modal: Thêm học sinh vào lớp */}
      {showAddStudentModal && selectedClass && (
        <Portal>
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" style={{ zIndex: 1100 }} onClick={() => { if (!savingEnroll) { setShowAddStudentModal(false); setSelectedStudentsData([]); } }}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Plus size={18} className="text-[#21398A]" />
                  Thêm học sinh vào lớp {selectedClass.name}
                </h3>
                <button onClick={() => { setShowAddStudentModal(false); setSelectedStudentsData([]); }} disabled={savingEnroll} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Chọn học sinh */}
                <div className="space-y-1.5">
                  <label className="tht-input-label">Tìm kiếm & Tích chọn học sinh *</label>
                  <input
                    type="text"
                    value={modalStudentSearch}
                    onChange={(e) => setModalStudentSearch(e.target.value)}
                    placeholder="Nhập tên học sinh hoặc ID để tìm nhanh..."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#21398A] transition-all font-semibold text-slate-700 placeholder-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={savingEnroll}
                  />

                  {loadingAllStudents ? (
                    <div className="py-8 text-center text-slate-400 text-xs animate-pulse">
                      Đang tải danh sách học sinh...
                    </div>
                  ) : (
                    <div className="border border-slate-150 rounded-xl p-3 max-h-[220px] overflow-y-auto space-y-2 bg-slate-50/50">
                      {allStudentsList
                        .filter(std => {
                          // Lọc theo từ khóa tìm kiếm
                          const searchMatch = std.name.toLowerCase().includes(modalStudentSearch.toLowerCase()) ||
                            std.id.toLowerCase().includes(modalStudentSearch.toLowerCase());
                          if (!searchMatch) return false;

                          // Chỉ hiện học sinh chưa có trong lớp (không hiển thị lại lần nữa)
                          const isEnrolled = rosterStudents.some(s =>
                            String(s.id).trim() === String(std.id).trim() ||
                            String(s.name).trim() === String(std.name).trim()
                          );
                          return !isEnrolled;
                        })
                        .map(std => {
                          const isSelected = selectedStudentsData.some(s => s.id === std.id);
                          return (
                            <label key={std.id} className={`flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-[#21398A] transition-colors py-0.5 select-none text-left w-full block ${savingEnroll ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={savingEnroll}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentsData(prev => [
                                      ...prev,
                                      { id: std.id, name: std.name, status: 'Đang học', date: new Date().toISOString().split('T')[0] }
                                    ]);
                                  } else {
                                    setSelectedStudentsData(prev => prev.filter(s => s.id !== std.id));
                                  }
                                }}
                                className="w-3.5 h-3.5 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <span>{std.name}</span>
                            </label>
                          );
                        })
                      }
                      {allStudentsList.filter(std => {
                        const searchMatch = std.name.toLowerCase().includes(modalStudentSearch.toLowerCase()) || std.id.toLowerCase().includes(modalStudentSearch.toLowerCase());
                        if (!searchMatch) return false;
                        const isEnrolled = rosterStudents.some(s =>
                          String(s.id).trim() === String(std.id).trim() ||
                          String(s.name).trim() === String(std.name).trim()
                        );
                        return !isEnrolled;
                      }).length === 0 && (
                          <div className="text-center text-slate-400 text-xs py-2 italic">Không tìm thấy học sinh phù hợp.</div>
                        )}
                    </div>
                  )}
                </div>

                {/* Danh sách học sinh đã chọn */}
                {selectedStudentsData.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-500 block text-left">Học sinh đã tích chọn ({selectedStudentsData.length}):</span>
                    <div className="overflow-hidden border border-slate-150 rounded-xl bg-white shadow-xs max-h-[240px] overflow-y-auto">
                      <table className="min-w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 border-b border-slate-155 text-slate-500 font-bold">
                          <tr>
                            <th className="p-2">Học sinh</th>
                            <th className="p-2 w-[110px]">Trạng thái</th>
                            <th className="p-2 w-[130px]">Ngày nhập học</th>
                            <th className="p-2 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedStudentsData.map((std, idx) => (
                            <tr key={std.id} className="hover:bg-slate-50/50">
                              <td className="p-2">
                                <div className="font-bold text-slate-800 text-left">{std.name}</div>
                                <div className="text-[10px] text-slate-400 font-extrabold text-left">{std.id}</div>
                              </td>
                              <td className="p-1">
                                <select
                                  value={std.status}
                                  disabled={savingEnroll}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedStudentsData(prev => prev.map((s, i) => i === idx ? { ...s, status: val } : s));
                                  }}
                                  className="w-full px-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 outline-none focus:border-[#21398A] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <option value="Đang học">Đang học</option>
                                  <option value="Học thử">Học thử</option>
                                </select>
                              </td>
                              <td className="p-1">
                                <input
                                  type="date"
                                  max="9999-12-31"
                                  value={std.date}
                                  disabled={savingEnroll}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedStudentsData(prev => prev.map((s, i) => i === idx ? { ...s, date: val } : s));
                                  }}
                                  className="w-full px-1.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700 outline-none focus:border-[#21398A] disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="p-1 text-center">
                                <button
                                  type="button"
                                  disabled={savingEnroll}
                                  onClick={() => setSelectedStudentsData(prev => prev.filter(s => s.id !== std.id))}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Xóa"
                                >
                                  <X size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="classes-enroll-send-email-teacher"
                    checked={enrollSendEmail}
                    disabled={savingEnroll}
                    onChange={(e) => setEnrollSendEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-[#21398A] focus:ring-[#21398A]/25 border-slate-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="classes-enroll-send-email-teacher" className={`text-xs font-bold text-slate-500 select-none ${savingEnroll ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                    Gửi Email thông báo cho giáo viên
                  </label>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => { setShowAddStudentModal(false); setSelectedStudentsData([]); }} disabled={savingEnroll} className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                  Hủy bỏ
                </button>
                <button
                  onClick={handleEnrollStudent}
                  disabled={savingEnroll || selectedStudentsData.length === 0}
                  className="px-5 py-2.5 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md shadow-[#21398a]/10 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {savingEnroll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang thêm...</span>
                    </>
                  ) : (
                    <span>Xác nhận thêm ({selectedStudentsData.length})</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

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

      {showBulkSinglePreview && (
        <Portal>
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" style={{ zIndex: 1200 }} onClick={() => setShowBulkSinglePreview(false)}>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#21398A]"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                  Xem trước Email: {bulkSinglePreviewStudentName}
                </h3>
                <button onClick={() => setShowBulkSinglePreview(false)} className="text-slate-400 hover:text-slate-600 rounded-lg p-1 hover:bg-slate-100 transition-all cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {loadingSinglePreview ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-4 border-[#21398A] border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-slate-400 font-bold">Đang tải nội dung email...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Tiêu đề Email (Subject)</label>
                      <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-850">
                        {bulkSinglePreviewSubject}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Nội dung thư (Email Content)</label>
                      <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                        <div className="p-4 overflow-y-auto max-h-[400px] bg-white text-slate-800" style={{ fontFamily: 'Inter, sans-serif' }}>
                          <div dangerouslySetInnerHTML={{ __html: bulkSinglePreviewHtml }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button onClick={() => setShowBulkSinglePreview(false)} className="px-5 py-2 bg-[#21398A] text-white hover:bg-[#1a2d6e] font-bold rounded-xl text-sm transition-all shadow-md cursor-pointer">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
      {showProgressModal && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none pointer-events-auto" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-3xl border border-slate-100 p-8 w-full max-w-md shadow-2xl flex flex-col items-center space-y-6 text-center animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Circular animated percentage display */}
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-slate-100 flex items-center justify-center bg-slate-50 shadow-inner">
                  <span className="text-xl font-black text-slate-800">
                    {progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0}%
                  </span>
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-[#21398A] border-r-[#21398A]/35 animate-spin" />
              </div>

              {/* Status Header */}
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800 leading-tight">
                  Đang gửi báo cáo hàng loạt...
                </h3>
                <p className="text-[10px] font-bold text-rose-500 animate-pulse uppercase tracking-wider">
                  ⚠️ Vui lòng không đóng tab hoặc tải lại trang
                </p>
              </div>

              {/* Progress counter and progress bar */}
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-0.5">
                  <span>Tiến trình:</span>
                  <span className="font-extrabold text-[#21398A] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                    {progressCurrent} / {progressTotal} email
                  </span>
                </div>

                {/* Progress bar background */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#21398A] via-indigo-600 to-violet-600 rounded-full transition-all duration-300 shadow-xs"
                    style={{ width: `${progressTotal > 0 ? (progressCurrent / progressTotal) * 100 : 0}%` }}
                  />
                </div>

                {/* Current student name container */}
                {progressStudentName && (
                  <div className="pt-2 text-center text-xs font-extrabold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-2.5 shadow-2xs">
                    Đang gửi cho: <span className="text-[#21398A] font-black">{progressStudentName}</span>
                  </div>
                )}
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
                <Shield size={28} className="animate-shake" aria-hidden="true" />
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

      {/* Progress Modal cho Chuyển lớp & Dừng học */}
      {sendingEmailProgress !== null && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none pointer-events-auto" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-3xl border border-slate-100 p-8 w-full max-w-md shadow-2xl flex flex-col items-center space-y-6 text-center animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Circular animated percentage display */}
              <div className="relative flex items-center justify-center">
                <div className="w-24 h-24 rounded-full border-4 border-slate-100 flex items-center justify-center bg-slate-50 shadow-inner">
                  <span className="text-xl font-black text-slate-800">
                    {sendingEmailProgress}%
                  </span>
                </div>
                <div className="absolute inset-0 w-24 h-24 rounded-full border-4 border-transparent border-t-[#21398A] border-r-[#21398A]/35 animate-spin" />
              </div>

              {/* Status Header */}
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800 leading-tight">
                  {progressStatusTitle}
                </h3>
                <p className="text-[10px] font-bold text-rose-500 animate-pulse uppercase tracking-wider">
                  ⚠️ Vui lòng không đóng tab hoặc thao tác trang
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full space-y-3">
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/50 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-[#21398A] via-indigo-600 to-violet-600 rounded-full transition-all duration-300 shadow-xs"
                    style={{ width: `${sendingEmailProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Success Modal cho Chuyển lớp & Dừng học (tự động đóng sau 2 giây) */}
      {emailSendSuccess && (
        <Portal>
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[9999] p-4 select-none pointer-events-auto" style={{ zIndex: 9999 }}>
            <div className="bg-white rounded-3xl border border-slate-100 p-8 w-full max-w-md shadow-2xl flex flex-col items-center space-y-4 text-center animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border border-green-100 shadow-xs">
                <CheckCircle className="w-10 h-10 text-green-600 animate-bounce" />
              </div>
              <h3 className="text-lg font-black text-slate-800 leading-tight">
                {progressSuccessTitle}
              </h3>
              <p className="text-xs text-slate-400 font-semibold">Hệ thống đã cập nhật thông tin thành công!</p>
            </div>
          </div>
        </Portal>
      )}

      {/* Modal: Mở lại / Clone lớp học */}
      {showReopenModal && selectedClass && (
        <Portal>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[1100] animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-100 p-6 w-full max-w-lg shadow-2xl flex flex-col space-y-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 text-[#21398A]">
                  <RefreshCw size={20} className="animate-spin-slow" />
                  <h3 className="text-base font-black text-slate-800 leading-tight">Mở lại / Clone lớp học</h3>
                </div>
                <button
                  onClick={() => setShowReopenModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Warning about ending old class */}
              {!isClassEnded(selectedClass.status) && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-250 text-xs font-medium text-amber-800 flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-extrabold block">Cảnh báo: Lớp cũ sẽ kết thúc để mở lớp mới!</span>
                    <span className="leading-relaxed block">Lớp học hiện tại chưa kết thúc. Khi xác nhận mở lớp mới, hệ thống sẽ tự động chuyển lớp cũ sang trạng thái "Hoàn thành" và đóng lại.</span>
                  </div>
                </div>
              )}

              {/* Form Content */}
              <form onSubmit={handleReopenClass} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Tên lớp học mới *</label>
                  <input
                    type="text"
                    value={reopenClassName}
                    onChange={(e) => setReopenClassName(e.target.value)}
                    placeholder="Nhập tên lớp học mới..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Hình thức học</label>
                    <div className="w-full px-4 py-2.5 bg-slate-100/50 border border-slate-250 text-slate-500 rounded-xl text-xs font-semibold select-none">
                      {selectedClass.studyType}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Ngày bắt đầu mới *</label>
                    <input
                      type="date"
                      value={reopenStartDate}
                      onChange={(e) => setReopenStartDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                      required
                    />
                  </div>
                </div>

                {selectedClass.studyType === 'Theo tháng' ? (
                  <div className="space-y-1">
                    <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Ngày kết thúc mới *</label>
                    <input
                      type="date"
                      value={reopenEndDate}
                      onChange={(e) => setReopenEndDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                      required
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Tổng số buổi mới *</label>
                      <input
                        type="number"
                        min="1"
                        value={reopenTotalSessions || ''}
                        onChange={(e) => setReopenTotalSessions(parseInt(e.target.value, 10) || 0)}
                        placeholder="Nhập tổng số buổi..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-500 font-extrabold uppercase tracking-wider text-[10px] block">Ngày kết thúc (Tự động tính)</label>
                      <input
                        type="text"
                        value={reopenEndDate || 'Nhập ngày bắt đầu & số buổi'}
                        disabled
                        className="w-full px-4 py-2.5 bg-slate-100/50 border border-slate-250 text-slate-500 rounded-xl text-xs font-bold select-none"
                      />
                    </div>
                  </div>
                )}

                {/* Form Footer */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowReopenModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Đang xử lý...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Xác nhận mở lớp mới</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

export default function Classes() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#21398A]" />
        <span>Đang tải dữ liệu lớp học...</span>
      </div>
    }>
      <ClassesContent />
    </Suspense>
  );
}
