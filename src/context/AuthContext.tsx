'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  phoneuser?: string;
  permissions: { [key: string]: boolean };
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe: boolean) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updatePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const DEFAULT_AUTH_ROUTE = '/dashboard';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Helper to restore session from sessionStorage when GAS is temporarily unreachable
  const tryRestoreFromSession = (): boolean => {
    const email = sessionStorage.getItem('loginEmail');
    const role = sessionStorage.getItem('userRole');
    const dept = sessionStorage.getItem('userDept');
    const permsStr = sessionStorage.getItem('userPermissions');
    const name = sessionStorage.getItem('userName');
    const id = sessionStorage.getItem('userId');
    const avatarUrl = sessionStorage.getItem('userAvatarUrl');

    if (email && role && dept && permsStr) {
      try {
        const permissions = JSON.parse(permsStr);
        setUser({
          id: id || email,
          name: name || email.split('@')[0],
          email,
          role,
          department: dept,
          permissions,
          avatarUrl: avatarUrl || '',
        });
        return true;
      } catch (e) {
        console.error('Error parsing cached user permissions:', e);
      }
    }
    return false;
  };

  // Run once on mount to perform initial auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const remember = localStorage.getItem('rememberMe') === 'true';
        const token = remember ? localStorage.getItem('loginToken') : sessionStorage.getItem('loginToken');
        
        if (!token) {
          setLoading(false);
          return;
        }

        // Validate token with proxy API
        const response = await fetch('/api/proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'validateToken', token }),
        });

        if (response.ok) {
          const res = await response.json();
          if (res.success && res.user) {
            setUser(res.user);
            
            // Re-store info
            sessionStorage.setItem('loginToken', token);
            sessionStorage.setItem('loginEmail', res.user.email);
            sessionStorage.setItem('userName', res.user.name || '');
            sessionStorage.setItem('userId', res.user.id || '');
            sessionStorage.setItem('userRole', res.user.role);
            sessionStorage.setItem('userDept', res.user.department);
            sessionStorage.setItem('userPermissions', JSON.stringify(res.user.permissions || {}));
            sessionStorage.setItem('userAvatarUrl', res.user.avatarUrl || '');
          } else {
            // Invalid token
            logout();
          }
        } else {
          // Server returned error status (e.g. 500, rate limit), try to restore from cache
          if (!tryRestoreFromSession()) {
            logout();
          }
        }
      } catch (err) {
        console.error('Auth verification error:', err);
        if (!tryRestoreFromSession()) {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Handle client-side routing protection and redirection
  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/login') {
        router.push('/login');
      } else if (user && pathname === '/login') {
        router.push(DEFAULT_AUTH_ROUTE);
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (username: string, password: string, rememberMe: boolean) => {
    try {
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'executeLogin',
          username,
          password,
          rememberMe,
        }),
      });

      if (!response.ok) {
        return { success: false, message: 'Không thể kết nối đến máy chủ API.' };
      }

      const res = await response.json();
      if (res.success && res.user) {
        setUser(res.user);

        // Store tokens
        if (rememberMe) {
          localStorage.setItem('savedUsername', username);
          localStorage.setItem('savedPassword', password);
          localStorage.setItem('rememberMe', 'true');
          localStorage.setItem('loginToken', res.token);
          localStorage.setItem('loginEmail', res.user.email);
        } else {
          localStorage.removeItem('savedUsername');
          localStorage.removeItem('savedPassword');
          localStorage.removeItem('rememberMe');
          localStorage.removeItem('loginToken');
          localStorage.removeItem('loginEmail');
        }

        sessionStorage.setItem('loginToken', res.token);
        sessionStorage.setItem('loginEmail', res.user.email);
        sessionStorage.setItem('userName', res.user.name || '');
        sessionStorage.setItem('userId', res.user.id || '');
        sessionStorage.setItem('userRole', res.user.role);
        sessionStorage.setItem('userDept', res.user.department);
        sessionStorage.setItem('userPermissions', JSON.stringify(res.user.permissions || {}));
        sessionStorage.setItem('userAvatarUrl', res.user.avatarUrl || '');

        router.push(DEFAULT_AUTH_ROUTE);
        return { success: true };
      } else {
        return { success: false, message: res.message || 'Tài khoản hoặc mật khẩu không chính xác.' };
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, message: 'Đã xảy ra lỗi hệ thống, vui lòng thử lại sau.' };
    }
  };

  const logout = () => {
    setUser(null);
    
    // Keep savedUsername/rememberMe logic intact but delete tokens
    localStorage.removeItem('loginToken');
    localStorage.removeItem('loginEmail');
    
    sessionStorage.removeItem('loginToken');
    sessionStorage.removeItem('loginEmail');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userId');
    sessionStorage.removeItem('userRole');
    sessionStorage.removeItem('userDept');
    sessionStorage.removeItem('userPermissions');
    sessionStorage.removeItem('userAvatarUrl');
    
    router.push('/login');
  };

  const updatePassword = async (oldPass: string, newPass: string) => {
    try {
      if (!user?.email) return { success: false, message: 'Không xác định được email người dùng!' };

      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'changePassword',
          email: user.email,
          oldPassword: oldPass,
          newPassword: newPass,
        }),
      });

      if (!response.ok) {
        return { success: false, message: 'Không thể kết nối đến máy chủ.' };
      }

      const res = await response.json();
      return { success: res.success, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Lỗi đổi mật khẩu.' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
