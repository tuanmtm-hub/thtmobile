/**
 * ============================================================
 * GAS API Utility - Lớp tích hợp API tập trung
 * ============================================================
 * Mọi trang frontend gọi Google Apps Script thông qua file này.
 * Token bảo mật được inject tự động bởi proxy route (server-side).
 * ============================================================
 */

// --- Kiểu dữ liệu ---

/** Kết quả trả về chuẩn từ GAS */
export interface GasResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: any;
  token?: string;
}

/** 4 hành động CRUD chính */
export type GasAction = 'FETCH_ALL' | 'INSERT' | 'UPDATE' | 'DELETE';

/** Tham số cho hàm gasRequest */
export interface GasRequestParams {
  /** Tên sheet trong Google Sheets (Room, Ca, KH, LH, ...) */
  sheet: string;
  /** Hành động CRUD */
  action: GasAction;
  /** Dữ liệu gửi lên (dùng cho INSERT, UPDATE, DELETE) */
  data?: Record<string, any>;
  /** Email người dùng đang đăng nhập */
  loginEmail?: string;
  /** Các tham số bổ sung (tuỳ chỉnh) */
  extra?: Record<string, any>;
  /** AbortSignal to cancel request */
  signal?: AbortSignal;
}

// --- Hàm tiện ích chính ---

/**
 * Gọi GAS API theo mô hình CRUD mới (action + sheet).
 * Token bảo mật được tự động inject bởi proxy route phía server.
 *
 * @example
 * // Lấy tất cả phòng học
 * const res = await gasRequest({ sheet: 'Room', action: 'FETCH_ALL', loginEmail: user.email });
 *
 * // Thêm phòng mới
 * const res = await gasRequest({
 *   sheet: 'Room',
 *   action: 'INSERT',
 *   data: { name: 'MIMOSA' },
 *   loginEmail: user.email,
 * });
 */
export async function gasRequest<T = any>(
  params: GasRequestParams
): Promise<GasResponse<T>> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet: params.sheet,
        action: params.action,
        data: params.data || {},
        loginEmail: params.loginEmail || '',
        ...params.extra,
      }),
      signal: params.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Lỗi kết nối server (HTTP ${response.status})`,
      };
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('[gasRequest] Error:', error);
    return {
      success: false,
      message: error.message || 'Không thể kết nối đến máy chủ API.',
    };
  }
}

/**
 * Gọi GAS API theo mô hình cũ (path + method) - dùng cho Auth và các case đặc biệt.
 * Backward-compatible với code frontend hiện tại.
 *
 * @example
 * // Đăng nhập
 * const res = await gasLegacyRequest({
 *   action: 'executeLogin',
 *   username: 'admin@gmail.com',
 *   password: '123456',
 * });
 */
export async function gasLegacyRequest<T = any>(
  payload: Record<string, any>,
  signal?: AbortSignal
): Promise<GasResponse<T>> {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      return {
        success: false,
        message: `Lỗi kết nối server (HTTP ${response.status})`,
      };
    }

    return await response.json();
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw error;
    }
    console.error('[gasLegacyRequest] Error:', error);
    return {
      success: false,
      message: error.message || 'Không thể kết nối đến máy chủ API.',
    };
  }
}
