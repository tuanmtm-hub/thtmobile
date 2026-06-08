import { useState, useEffect, useCallback, useMemo } from 'react';
import { gasRequest, gasLegacyRequest } from '@/lib/gasApi';

// Custom lightweight state-based fetch hook to replace SWR
function useStandardFetch<T = any>(
  key: any[] | null,
  fetchFn: (args: any) => Promise<T>,
  initialData: T
) {
  const [data, setData] = useState<T>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const keySerialized = JSON.stringify(key);

  const executeFetch = useCallback(async () => {
    if (!key) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFn(key);
      setData(result);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [keySerialized]);

  useEffect(() => {
    executeFetch();
  }, [executeFetch]);

  return { data, error, isLoading, mutate: executeFetch };
}

// Fetcher for CRUD API (e.g., FETCH_ALL)
const gasFetcher = async ([sheet, loginEmail]: [string, string]) => {
  const res = await gasRequest({ sheet, action: 'FETCH_ALL', loginEmail });
  if (!res.success) {
    throw new Error(res.message || `Lỗi tải dữ liệu ${sheet}`);
  }
  return res.data || [];
};

// Fetcher for Legacy API (e.g. users, vouchers via path/method)
const legacyFetcher = async ([path, method, loginEmail]: [string, string, string]) => {
  const res = await gasLegacyRequest({ path, method, loginEmail });
  if (!res.success) {
    throw new Error(res.message || `Lỗi tải dữ liệu ${path}`);
  }
  return res.data || [];
};

// Fetcher for Batch API
const gasBatchFetcher = async ([sheet, action, loginEmail]: [string, string, string]) => {
  const res = await gasRequest({ sheet, action: action as any, loginEmail });
  if (!res.success) {
    throw new Error(res.message || `Lỗi tải dữ liệu batch ${action}`);
  }
  return res.data || {};
};

// Fetcher for Holidays (Legacy API)
const holidaysFetcher = async ([path, method, loginEmail]: [string, string, string]) => {
  const res = await gasLegacyRequest({ path, method, loginEmail });
  if (!res.success) {
    throw new Error(res.message || `Lỗi tải dữ liệu ${path}`);
  }
  return res.data || [];
};

// Hook for Students Batch Data (BatchFetch)
export function useStudentsBatchData(email?: string) {
  const key = email ? ['BatchFetch', 'FETCH_STUDENTS_PAGE_DATA', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any>(
    key,
    gasBatchFetcher,
    {}
  );
  return { studentsBatchData: data, isLoading, isError: error, mutate };
}

// 1. Hook for Student Sheet (KH)
export function useRawStudents(email?: string) {
  const key = email ? ['KH', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    gasFetcher,
    []
  );
  return { studentsData: data, isLoading, isError: error, mutate };
}

// 2. Hook for Class Sheet (LH)
export function useRawClasses(email?: string) {
  const key = email ? ['LH', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    gasFetcher,
    []
  );
  return { classesData: data, isLoading, isError: error, mutate };
}

// 3. Hook for Enroll Sheet (ENROLL)
export function useRawEnrolls(email?: string) {
  const key = email ? ['ENROLL', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    gasFetcher,
    []
  );
  return { enrollsData: data, isLoading, isError: error, mutate };
}

// 4. Hook for Users (User)
export function useRawUsers(email?: string) {
  const key = email ? ['/api/v1/users', 'GET', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    legacyFetcher,
    []
  );
  return { usersData: data, isLoading, isError: error, mutate };
}

// 5. Hook for Vouchers (Voucher)
export function useRawVouchers(email?: string) {
  const key = email ? ['/api/v1/vouchers', 'GET', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    legacyFetcher,
    []
  );
  return { vouchersData: data, isLoading, isError: error, mutate };
}

// 6. Unified Hook for Student Page Data
export function useStudentsData(email?: string) {
  const { studentsBatchData, isLoading, isError, mutate } = useStudentsBatchData(email);

  const refresh = async () => {
    await mutate();
  };

  let students: any[] = [];
  let classesList: { id: string; name: string; teacher?: string }[] = [];

  const studentsData = studentsBatchData?.students || [];
  const classesData = studentsBatchData?.classes || [];
  const enrollsData = studentsBatchData?.enrolls || [];

  if (studentsData.length > 0 && classesData.length > 0 && enrollsData.length > 0) {
    const standardizeStatus = (statusStr: string): string => {
      const s = statusStr.trim().toLowerCase();
      if (s.includes('đang học') || s.includes('dang hoc') || s.includes('chính thức') || s.includes('chinh thuc')) return 'Đang học';
      if (s.includes('học thử (không đạt)') || s.includes('hoc thu (khong dat)')) return 'Học thử (không đạt)';
      if (s.includes('học thử') || s.includes('hoc thu')) return 'Học thử';
      if (s.includes('chờ lớp') || s.includes('cho lop') || s.includes('đang chờ lớp') || s.includes('dang cho lop')) return 'Đang chờ lớp';
      if (s.includes('tạm ngưng') || s.includes('tam ngung')) return 'Tạm ngưng';
      if (s.includes('bảo lưu') || s.includes('bao luu')) return 'Bảo lưu';
      if (s.includes('nghỉ học') || s.includes('nghi hoc')) return 'Nghỉ học';
      if (s.includes('chăm sóc') || s.includes('cham soc')) return 'Chăm sóc';
      return statusStr || 'Đang học';
    };

    const header = studentsData[0].map((h: any) => String(h || '').trim());
    const idx = (name: string) => header.indexOf(name);

    const iID = idx('ID');
    const iName = idx('Họ và tên học sinh') > -1 ? idx('Họ và tên học sinh') : idx('Họ và tên');
    const iNickName = idx('Nick Name') > -1 ? idx('Nick Name') : idx('Nickname');
    const iGender = idx('Giới tính');
    const iBirthday = idx('Ngày sinh');
    const iParentName = idx('Tên phụ huynh');
    const iParentPhone = idx('SĐT phụ huynh') > -1 ? idx('SĐT phụ huynh') : (idx('Số điện thoại') > -1 ? idx('Số điện thoại') : idx('SĐT'));
    const iParentEmail = idx('Email phụ huynh') > -1 ? idx('Email phụ huynh') : (idx('Email') > -1 ? idx('Email') : -1);
    const iStatus = idx('Trạng thái');
    const iNoteTV = idx('Ghi chú của Tư Vấn') > -1 ? idx('Ghi chú của Tư Vấn') : idx('Ghi chú');
    const iSource = idx('Nguồn');
    const iCounselor = idx('User ID') > -1 ? idx('User ID') : (idx('NV tư vấn') > -1 ? idx('NV tư vấn') : idx('Người tư vấn'));
    const iVoucher = idx('Voucher ID') > -1 ? idx('Voucher ID') : idx('Voucher');
    const iMealConfig = idx('Cấu hình Tiền ăn') > -1 ? idx('Cấu hình Tiền ăn') : idx('Tiền ăn');

    const valAt = (row: any[], index: number) => {
      if (index > -1 && index < row.length) {
        return String(row[index] || '').trim();
      }
      return '';
    };

    const classMap: Record<string, string> = {};
    const classIdToNameMap: Record<string, { name: string; teacher: string }> = {};

    const lhRows = classesData;
    const lhHeaders = lhRows[0].map((h: any) => String(h || '').trim());
    const iLhId = lhHeaders.indexOf('ID');
    const iLhName = lhHeaders.indexOf('Tên lớp');
    const iLhGvcn = lhHeaders.indexOf('User ID') > -1 ? lhHeaders.indexOf('User ID') : (lhHeaders.indexOf('Giáo viên') > -1 ? lhHeaders.indexOf('Giáo viên') : lhHeaders.indexOf('GVCN'));
    const iLhStatus = lhHeaders.indexOf('Trạng thái');

    for (let r = 1; r < lhRows.length; r++) {
      const row = lhRows[r];
      const cId = iLhId > -1 ? String(row[iLhId] || '').trim() : '';
      const cName = String(row[iLhName] || '').trim();
      const cGvcn = iLhGvcn > -1 ? String(row[iLhGvcn] || '').trim() : '';
      const cStatus = iLhStatus > -1 ? String(row[iLhStatus] || '').trim().toLowerCase() : '';
      const isActive = cStatus === 'đang học' || cStatus === 'dang hoc';

      if (cName && isActive) {
        classMap[cName] = cGvcn;
        classesList.push({ id: cId, name: cName, teacher: cGvcn });
        if (cId) {
          classIdToNameMap[cId] = { name: cName, teacher: cGvcn };
        }
      }
    }
    classesList.sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    const studentClassesMap: Record<string, { classNames: string[]; teachers: string[] }> = {};
    const enrollRows = enrollsData;
    const enrollHeaders = enrollRows[0].map((h: any) => String(h || '').trim());
    const iEnKh = enrollHeaders.indexOf('KH ID');
    const iEnLh = enrollHeaders.indexOf('LH ID');
    const iEnStatus = enrollHeaders.indexOf('Trạng thái');

    if (iEnKh > -1 && iEnLh > -1) {
      for (let r = 1; r < enrollRows.length; r++) {
        const row = enrollRows[r];
        const studentId = String(row[iEnKh] || '').trim();
        const classId = String(row[iEnLh] || '').trim();
        const enrollStatus = iEnStatus > -1 ? String(row[iEnStatus] || '').trim().toLowerCase() : '';
        const isEnrolled = !enrollStatus || enrollStatus.includes('đang học') || enrollStatus.includes('dang hoc') || enrollStatus === '';

        if (studentId && classId && isEnrolled) {
          const classInfo = classIdToNameMap[classId];
          if (classInfo) {
            if (!studentClassesMap[studentId]) {
              studentClassesMap[studentId] = { classNames: [], teachers: [] };
            }
            studentClassesMap[studentId].classNames.push(classInfo.name);
            if (classInfo.teacher) {
              studentClassesMap[studentId].teachers.push(classInfo.teacher);
            }
          }
        }
      }
    }

    for (let r = 1; r < studentsData.length; r++) {
      const row = studentsData[r];
      const studentId = valAt(row, iID);
      if (!studentId) continue;

      const enrollInfo = studentClassesMap[studentId] || { classNames: [], teachers: [] };
      const rawClassName = enrollInfo.classNames.length > 0 ? enrollInfo.classNames.join(', ') : 'Chưa xếp lớp';
      const uniqueGvcn = Array.from(new Set(enrollInfo.teachers));
      const gvcnString = uniqueGvcn.length > 0 ? uniqueGvcn.join(', ') : '';

      students.push({
        id: studentId,
        name: valAt(row, iName),
        nickName: valAt(row, iNickName),
        gender: valAt(row, iGender),
        birthday: valAt(row, iBirthday),
        parentName: valAt(row, iParentName),
        phone: valAt(row, iParentPhone),
        email: valAt(row, iParentEmail),
        status: standardizeStatus(valAt(row, iStatus)),
        className: rawClassName,
        homeroomTeacher: gvcnString,
        counselor: valAt(row, iCounselor) || 'Chưa có tư vấn',
        noteTV: valAt(row, iNoteTV),
        source: valAt(row, iSource),
        voucherId: valAt(row, iVoucher),
        mealConfig: valAt(row, iMealConfig),
      });
    }
  }

  return { students, classesList, isLoading, refresh };
}

// 7. Hook for Teacher Page Data
export function useTeachersData(email?: string) {
  const { usersData, isLoading, isError, mutate } = useRawUsers(email);

  let teachers: any[] = [];
  if (usersData.length > 0) {
    teachers = usersData
      .slice(1) // Skip header row
      .map((item: any) => {
        let parsedPerms: Record<string, boolean> = {};
        if (item[8]) {
          let raw = item[8];
          if (typeof raw === 'string') {
            try {
              raw = JSON.parse(raw);
            } catch (e) {
              raw = raw.split(',').map((s: string) => s.trim());
            }
          }

          if (Array.isArray(raw)) {
            raw.forEach((p: any) => {
              if (p && typeof p === 'string') {
                parsedPerms[p] = true;
              }
            });
          } else if (typeof raw === 'object' && raw !== null) {
            Object.keys(raw).forEach((k) => {
              parsedPerms[k] = !!raw[k];
            });
          }
        }
        return {
          id: String(item[0] || ''),
          name: String(item[1] || ''),
          email: String(item[2] || ''),
          password: String(item[3] || '123'),
          status: String(item[4] || 'Đang hoạt động'),
          role: String(item[5] || 'Giáo viên'),
          department: String(item[6] || 'Tiếng Anh'),
          phone: String(item[7] || ''),
          permissions: parsedPerms,
          avatarUrl: String(item[9] || ''),
        };
      })
      .filter(
        (u: any) =>
          u.role === 'Giáo viên' ||
          u.role === 'Teacher' ||
          ['Tiếng Anh', 'IT', 'Tư Vấn', 'Tư vấn'].includes(u.department)
      );
  }

  return { teachers, isLoading, refresh: mutate };
}

// 10. Hook for Classes Batch Data (BatchFetch)
export function useClassesBatchData(email?: string) {
  const key = email ? ['BatchFetch', 'FETCH_CLASSES_PAGE_DATA', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any>(
    key,
    gasBatchFetcher,
    {}
  );
  return { classesBatchData: data, isLoading, isError: error, mutate };
}

// 11. Hook for Schedule Batch Data (BatchFetch)
export function useScheduleBatchData(email?: string) {
  const key = email ? ['BatchFetch', 'FETCH_ALL_SCHEDULE_DATA', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any>(
    key,
    gasBatchFetcher,
    {}
  );
  return { scheduleBatchData: data, isLoading, isError: error, mutate };
}

// 12. Hook for Holidays
export function useHolidays(email?: string) {
  const key = email ? ['/api/v1/holidays', 'GET', email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any[]>(
    key,
    holidaysFetcher,
    []
  );
  return { holidaysData: data, isLoading, isError: error, mutate };
}

// 13. Hook for Class Roster Details
export function useClassRoster(className?: string, email?: string) {
  const key = className && email ? ['LH', 'getClassDetails', className, email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any>(
    key,
    async ([sheet, action, className, loginEmail]) => {
      const res = await gasRequest({
        sheet,
        action: action as any,
        loginEmail,
        extra: { data: { className } }
      });
      if (!res.success) {
        throw new Error(res.message || `Lỗi tải roster cho lớp ${className}`);
      }
      return res.data || { students: [], attendanceHeaders: [] };
    },
    { students: [], attendanceHeaders: [] }
  );
  return { rosterData: data, isLoading, isError: error, mutate };
}

// 14. Hook for Class Attendance Details (with Date)
export function useClassAttendanceDetails(className?: string, date?: string, email?: string) {
  const key = className && date && email ? ['LH', 'getClassDetails_withDate', className, date, email] : null;
  const { data, error, isLoading, mutate } = useStandardFetch<any>(
    key,
    async ([sheet, action, className, date, loginEmail]) => {
      const res = await gasRequest({
        sheet,
        action: 'getClassDetails' as any,
        loginEmail,
        extra: { data: { className, date } }
      });
      if (!res.success) {
        throw new Error(res.message || `Lỗi tải thông tin điểm danh lớp ${className}`);
      }
      return res.data || {};
    },
    {}
  );
  return { attendanceDetails: data, isLoading, isError: error, mutate };
}

// Helper functions for header index parsing
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

// Helper for date parsing
const parseToDateHelper = (dateStr: string): Date => {
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

// 15. Unified Hook for Classes Page Data
export function useClassesPageData(email?: string) {
  const { classesBatchData, isLoading: loadingBatch, mutate: mutateBatch } = useClassesBatchData(email);
  const { holidaysData, isLoading: loadingHolidays, mutate: mutateHolidays } = useHolidays(email);
  const { studentsData: rawStudents, isLoading: loadingStudents, mutate: mutateStudents } = useRawStudents(email);

  const isLoading = loadingBatch || loadingHolidays || loadingStudents;

  const refresh = async () => {
    await Promise.all([
      mutateBatch(),
      mutateHolidays(),
      mutateStudents(),
    ]);
  };

  return useMemo(() => {
    let levels: { id: string; name: string }[] = [];
    let groups: { id: string; name: string; khoiId: string }[] = [];
    let roomsList: { id: string; name: string }[] = [];
    let shiftsList: { id: string; name: string; startTime: string; endTime: string }[] = [];
    let teachersList: { id: string; name: string; email?: string; dept?: string }[] = [];
    let classes: any[] = [];
    let holidays: any[] = [];
    let allStudentsList: any[] = [];

    if (classesBatchData) {
      const { groups: dataGroups, rooms: dataRooms, shifts: dataShifts, users: dataUsers, classes: dataClasses } = classesBatchData;

      // Parse Groups & Levels
      if (dataGroups) {
        const { khoiLop, nhomLop } = dataGroups;
        if (Array.isArray(khoiLop)) {
          levels = khoiLop.map((item: any) => ({ id: String(item[0] || ''), name: String(item[1] || '') }));
        }
        if (Array.isArray(nhomLop)) {
          groups = nhomLop.map((item: any) => ({
            id: String(item[0] || ''),
            khoiId: String(item[1] || ''),
            name: String(item[3] || ''),
          }));
        }
      }

      // Parse Rooms
      if (Array.isArray(dataRooms)) {
        roomsList = dataRooms.map((r: any) => ({ id: String(r[0] || ''), name: String(r[1] || '') }));
        roomsList.sort((a: any, b: any) => a.name.localeCompare(b.name, 'vi'));
      }

      // Parse Shifts
      if (Array.isArray(dataShifts)) {
        const parseTimeToMinutes = (timeStr: string) => {
          if (!timeStr) return 9999;
          const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
          if (match) {
            const hours = parseInt(match[1], 10);
            const minutes = parseInt(match[2], 10);
            return hours * 60 + minutes;
          }
          return 9999;
        };

        shiftsList = dataShifts.map((item: any) => ({
          id: String(item[0] || ''),
          name: String(item[1] || ''),
          startTime: String(item[2] || ''),
          endTime: String(item[3] || ''),
        }));

        shiftsList.sort((a: any, b: any) => {
          const timeA = parseTimeToMinutes(a.startTime);
          const timeB = parseTimeToMinutes(b.startTime);
          if (timeA !== timeB) return timeA - timeB;
          return a.name.localeCompare(b.name, 'vi');
        });
      }

      // Parse Teachers
      if (Array.isArray(dataUsers)) {
        teachersList = dataUsers.map((u: any) => ({
          id: String(u[0] || ''),
          name: String(u[1] || ''),
          email: String(u[2] || ''),
          dept: String(u[6] || ''),
        }));
      }

      // Parse Classes
      if (Array.isArray(dataClasses) && dataClasses.length > 0) {
        const rows = dataClasses;
        const header = rows[0].map((h: any) => String(h || '').trim());
        const idx = (names: string[]) => findHeaderIndex(header, names);

        const iId = idx(['ID']);
        const iName = idx(['Tên lớp', 'Ten lop', 'Class name']);
        const iKhoiId = idx(['KhoiLop ID', 'KhoiLop_ID']);
        const iNhomId = idx(['NhomLop ID', 'NhomLop_ID']);
        const iStudyType = idx(['Hình thức', 'Hinh thuc']);
        const iStartDate = idx(['Ngày bắt đầu', 'Ngay bat dau']);
        const iEndDate = idx(['Ngày kết thúc', 'Ngay ket thuc']);
        const iTeacher = idx(['User ID', 'Giáo viên', 'Giao vien', 'GVCN']);
        const iStatus = idx(['Trạng thái', 'Trang thai', 'Status']);
        const iFee = idx(['Học phí', 'Hoc phi']);
        const iNote = idx(['Ghi chú', 'Ghi chu', 'Note']);
        const iBusinessBlock = idx(['Khối kinh doanh', 'Khoi kinh doanh']);
        const iCourse = idx(['Khóa học', 'Khoa hoc']);
        const iWdMap = idx(['Room/Ca theo thứ', 'Room/Ca theo thu', 'Room Ca theo thu']);
        const iCa = idx(['Ca']);
        const iRoom = idx(['Phòng', 'Phong', 'Room']);
        const iTotalStudents = idx(['Sĩ số', 'Si so']);
        const iTrialStudents = idx(['Học viên học thử', 'Hoc vien hoc thu']);

        const valAt = (row: any[], index: number) => {
          if (index > -1 && index < row.length) {
            const rawVal = row[index];
            if (rawVal instanceof Date) {
              const day = String(rawVal.getDate()).padStart(2, '0');
              const month = String(rawVal.getMonth() + 1).padStart(2, '0');
              const year = rawVal.getFullYear();
              return `${day}/${month}/${year}`;
            }
            if (typeof rawVal === 'string') {
              if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(rawVal)) {
                try {
                  const d = new Date(rawVal);
                  if (!isNaN(d.getTime())) {
                    const day = String(d.getDate()).padStart(2, '0');
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const year = d.getFullYear();
                    return `${day}/${month}/${year}`;
                  }
                } catch (e) { }
              }
            }
            return String(rawVal || '').trim();
          }
          return '';
        };

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const classNameVal = valAt(row, iName);
          if (!classNameVal) continue;

          const wdMapStr = valAt(row, iWdMap);
          let defaultRoom = valAt(row, iRoom) || '—';
          let defaultCa = valAt(row, iCa) || '—';
          try {
            if (wdMapStr) {
              const wdMap = JSON.parse(wdMapStr);
              const firstDayKey = Object.keys(wdMap)[0];
              if (firstDayKey) {
                const dayConf = wdMap[firstDayKey];
                const firstSession = Array.isArray(dayConf) ? dayConf[0] : dayConf;
                if (firstSession) {
                  const rObj = roomsList.find(rm => rm.id === firstSession.room);
                  if (rObj) defaultRoom = rObj.name;
                  else if (firstSession.room) defaultRoom = firstSession.room;

                  const sObj = shiftsList.find(sf => sf.id === firstSession.ca);
                  if (sObj) defaultCa = sObj.name;
                  else if (firstSession.ca) defaultCa = firstSession.ca;
                }
              }
            }
          } catch (e) { }

          classes.push({
            id: valAt(row, iId),
            name: classNameVal,
            khoiId: valAt(row, iKhoiId),
            nhomId: valAt(row, iNhomId),
            studyType: valAt(row, iStudyType),
            startDate: valAt(row, iStartDate),
            endDate: valAt(row, iEndDate),
            teacher: valAt(row, iTeacher),
            status: valAt(row, iStatus),
            room: defaultRoom,
            ca: defaultCa,
            fee: parseFloat(valAt(row, iFee).replace(/[^\d]/g, '')) || 0,
            note: valAt(row, iNote),
            businessBlock: valAt(row, iBusinessBlock) || 'Lê Hồng Phong',
            course: (() => {
              let cVal = valAt(row, iCourse);
              if (cVal && /^\d{2}\/\d{2}\/\d{4}$/.test(cVal)) {
                const parts = cVal.split('/');
                return `${parts[1]}/${parts[2]}`; // MM/YYYY
              }
              return cVal;
            })(),
            roomCaMapStr: wdMapStr,
            totalStudents: parseInt(valAt(row, iTotalStudents)) || 0,
            trialStudents: parseInt(valAt(row, iTrialStudents)) || 0,
          });
        }
        classes.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      }
    }

    // Parse Holidays
    if (Array.isArray(holidaysData)) {
      holidays = holidaysData.map((h: any) => ({
        name: String(h[0] || ''),
        start: String(h[1] || ''),
        end: String(h[2] || ''),
        scope: String(h[3] || 'ALL'),
        classes: String(h[4] || ''),
      }));
    }

    // Parse All Students List
    if (Array.isArray(rawStudents) && rawStudents.length > 0) {
      const rows = rawStudents;
      const header = rows[0].map((h: any) => String(h || '').trim());
      const iId = header.indexOf('ID');
      const iName = header.indexOf('Họ và tên học sinh') > -1 ? header.indexOf('Họ và tên học sinh') : header.indexOf('Họ và tên');
      const iStatus = header.indexOf('Trạng thái');
      const iParentEmail = header.indexOf('Email phụ huynh') > -1 ? header.indexOf('Email phụ huynh') : header.indexOf('Email Phụ huynh');
      const allowedStatuses = ['Đang chờ lớp', 'Đang học', 'Học thử', 'Tạm ngưng'];
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const id = String(row[iId] || '').trim();
        const name = String(row[iName] || '').trim();
        const status = iStatus > -1 ? String(row[iStatus] || '').trim() : '';
        const parentEmail = iParentEmail > -1 ? String(row[iParentEmail] || '').trim() : '';

        if (id && name) {
          if (iStatus > -1 && !allowedStatuses.includes(status)) {
            continue;
          }
          allStudentsList.push({ id, name, status, parentEmail });
        }
      }
      allStudentsList.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }

    return {
      classes,
      levels,
      groups,
      roomsList,
      shiftsList,
      teachersList,
      holidays,
      allStudentsList,
      isLoading,
      refresh,
    };
  }, [classesBatchData, holidaysData, rawStudents, isLoading]);
}

// 16. Unified Hook for Today's Schedule Page Data
export function useSchedulePageData(email?: string) {
  const { scheduleBatchData, isLoading: loadingBatch, mutate } = useScheduleBatchData(email);

  const isLoading = loadingBatch;

  const refresh = async () => {
    await mutate();
  };

  return useMemo(() => {
    let classesToday: any[] = [];
    let roomsList: { id: string; name: string }[] = [];
    let shiftsList: { id: string; name: string; startTime: string; endTime: string }[] = [];
    let teachersList: { id: string; name: string }[] = [];

    if (scheduleBatchData) {
      const { rooms: rRaw, shifts: sRaw, users: uRaw, classes: cRaw } = scheduleBatchData;

      roomsList = Array.isArray(rRaw)
        ? rRaw.map((r: any) => ({ id: String(r[0] || ''), name: String(r[1] || '') }))
        : [];

      const parseTimeToMinutes = (timeStr: string) => {
        if (!timeStr) return 9999;
        const match = timeStr.trim().match(/^(\d{1,2})[:h](\d{2})/);
        if (match) {
          const hours = parseInt(match[1], 10);
          const minutes = parseInt(match[2], 10);
          return hours * 60 + minutes;
        }
        return 9999;
      };

      shiftsList = Array.isArray(sRaw)
        ? sRaw.map((item: any) => ({
          id: String(item[0] || ''),
          name: String(item[1] || ''),
          startTime: String(item[2] || ''),
          endTime: String(item[3] || ''),
        }))
        : [];
      shiftsList.sort((a: any, b: any) => {
        const timeA = parseTimeToMinutes(a.startTime);
        const timeB = parseTimeToMinutes(b.startTime);
        if (timeA !== timeB) return timeA - timeB;
        return a.name.localeCompare(b.name, 'vi');
      });

      teachersList = Array.isArray(uRaw)
        ? uRaw.map((u: any) => ({ id: String(u[0] || ''), name: String(u[1] || '') }))
        : [];

      if (Array.isArray(cRaw) && cRaw.length > 0) {
        const rows = cRaw;
        const header = rows[0].map((h: any) => String(h || '').trim());
        const idx = (name: string) => header.indexOf(name);

        const iId = idx('ID');
        const iName = idx('Tên lớp');
        const iKhoiId = idx('KhoiLop_ID');
        const iNhomId = idx('NhomLop_ID');
        const iStudyType = idx('Hình thức');
        const iStartDate = idx('Ngày bắt đầu');
        const iEndDate = idx('Ngày kết thúc');
        const iTeacher = idx('User ID') > -1 ? idx('User ID') : (idx('Giáo viên') > -1 ? idx('Giáo viên') : idx('GVCN'));
        const iStatus = idx('Trạng thái');
        const iRoom = idx('Phòng');
        const iCa = idx('Ca');
        const iFee = idx('Học phí');
        const iNote = idx('Ghi chú');
        const iWdMap = idx('Room/Ca theo thứ');
        const iDays = idx('Ngày học trong tuần') > -1 ? idx('Ngày học trong tuần') : idx('Lịch học');
        const iTotalStudents = idx('Sĩ số');
        const iTrialStudents = idx('Học viên học thử');

        const valAt = (row: any[], index: number) => {
          if (index > -1 && index < row.length) {
            return String(row[index] || '').trim();
          }
          return '';
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const wd = today.getDay(); // 0 = CN, 1 = T2,...

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const className = valAt(row, iName);
          if (!className) continue;

          // Chỉ lọc lớp ở trạng thái "Đang học"
          const statusVal = valAt(row, iStatus);
          const s = String(statusVal || '').trim().toLowerCase();
          const isDangHoc = s.includes('đang học') || s.includes('dang hoc');
          if (!isDangHoc) continue;

          // Lọc theo ngày bắt đầu và ngày kết thúc
          const startStr = valAt(row, iStartDate);
          const endStr = valAt(row, iEndDate);
          if (startStr) {
            const startD = parseToDateHelper(startStr);
            if (startD.getTime() > 0 && today < startD) {
              continue;
            }
          }
          if (endStr) {
            const endD = parseToDateHelper(endStr);
            if (endD.getTime() > 0 && today > endD) {
              continue;
            }
          }

          const wdMapStr = valAt(row, iWdMap);
          let wdMap: Record<string, any> = {};
          try {
            if (wdMapStr) {
              wdMap = JSON.parse(wdMapStr);
            }
          } catch (e) {
            console.error('Error parsing JSON for class ' + className, e);
          }

          const todayConf = wdMap[String(wd)];
          if (!todayConf) continue;

          const sessions: any[] = [];

          const processSession = (sess: any) => {
            if (!sess) return null;
            const sObj = shiftsList.find(sf => sf.id === sess.ca || sf.name === sess.ca);
            const caName = sObj ? sObj.name : (sess.ca || '—');

            const rObj = roomsList.find(rm => rm.id === sess.room || rm.name === sess.room);
            const roomName = rObj ? rObj.name : (sess.room || '—');

            const tObj1 = teachersList.find(t => t.id === sess.oa1 || t.name === sess.oa1);
            const tName1 = tObj1 ? tObj1.name : (sess.oa1 || '');
            const tInterval1 = tName1 ? `${tName1}${sess.oa1Start || sess.oa1End ? ` (${sess.oa1Start || '—'} - ${sess.oa1End || '—'})` : ''}` : '';

            const tObj2 = teachersList.find(t => t.id === sess.oa2 || t.name === sess.oa2);
            const tName2 = tObj2 ? tObj2.name : (sess.oa2 || '');
            const tInterval2 = tName2 ? `${tName2}${sess.oa2Start || sess.oa2End ? ` (${sess.oa2Start || '—'} - ${sess.oa2End || '—'})` : ''}` : '';

            const oaDisplayList = [tInterval1, tInterval2].filter(Boolean);

            return {
              ca: caName,
              time: sess.time || '',
              room: roomName,
              oa1: oaDisplayList.join(', ') || 'Chưa phân công',
              oa2: ''
            };
          };

          if (Array.isArray(todayConf)) {
            todayConf.forEach((sess: any) => {
              const resSess = processSession(sess);
              if (resSess) sessions.push(resSess);
            });
          } else if (todayConf.ca) {
            const resSess = processSession(todayConf);
            if (resSess) sessions.push(resSess);
          }

          if (sessions.length === 0) {
            const rObj = roomsList.find(rm => rm.id === valAt(row, iRoom));
            const roomName = rObj ? rObj.name : valAt(row, iRoom);

            const sObj = shiftsList.find(sf => sf.id === valAt(row, iCa));
            const caName = sObj ? sObj.name : valAt(row, iCa);

            sessions.push({
              ca: caName || '—',
              time: '',
              room: roomName || '—',
              oa1: '',
              oa2: ''
            });
          }

          const firstSession = sessions[0];
          const defaultRoom = firstSession ? firstSession.room : (roomsList.find(rm => rm.id === valAt(row, iRoom))?.name || valAt(row, iRoom) || '—');
          const defaultCa = firstSession ? firstSession.ca : (shiftsList.find(sf => sf.id === valAt(row, iCa))?.name || valAt(row, iCa) || '—');

          classesToday.push({
            id: valAt(row, iId),
            name: className,
            khoiId: valAt(row, iKhoiId),
            nhomId: valAt(row, iNhomId),
            studyType: valAt(row, iStudyType),
            startDate: valAt(row, iStartDate),
            endDate: valAt(row, iEndDate),
            teacher: valAt(row, iTeacher),
            status: statusVal,
            room: defaultRoom,
            ca: defaultCa,
            fee: parseFloat(valAt(row, iFee).replace(/[^\d]/g, '')) || 0,
            note: valAt(row, iNote),
            daysInWeek: valAt(row, iDays),
            roomCaMap: wdMapStr,
            todaySessions: sessions,
            totalStudents: parseInt(valAt(row, iTotalStudents)) || 0,
            trialStudents: parseInt(valAt(row, iTrialStudents)) || 0
          });
        }
        classesToday.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      }
    }

    return {
      classesToday,
      roomsList,
      shiftsList,
      teachersList,
      isLoading,
      refresh,
    };
  }, [scheduleBatchData, isLoading]);
}

