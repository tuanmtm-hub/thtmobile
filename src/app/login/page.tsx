'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import LoadingOverlay from '@/components/LoadingOverlay';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill credentials if saved
  useEffect(() => {
    const savedUser = localStorage.getItem('savedUsername') || '';
    const savedPass = localStorage.getItem('savedPassword') || '';
    const remember = localStorage.getItem('rememberMe') === 'true';

    if (savedUser) {
      setUsername(savedUser);
      setRememberMe(remember);
    }
    if (savedPass && remember) {
      setPassword(savedPass);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!');
      return;
    }

    setIsSubmitting(true);
    const result = await login(username, password, rememberMe);
    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.message || 'Tài khoản hoặc mật khẩu không đúng.');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#faf1f1] via-[#e5f0fa] to-[#eaf8f0] overflow-hidden px-4 py-8">
      {/* Premium background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[80%] sm:w-[50%] h-[50%] rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[80%] sm:w-[60%] h-[60%] rounded-full bg-teal-100/40 blur-3xl" />

      {/* Login Card */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-md rounded-xl sm:rounded-2xl shadow-xl border border-white/50 p-6 sm:p-8 z-10 transition-all hover:shadow-2xl">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <img
            src="https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png"
            alt="THT Logo"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-3 drop-shadow-sm"
          />
          <h1 className="text-xl sm:text-2xl font-bold text-[#21398A] tracking-wide text-center">
            ĐĂNG NHẬP HỆ THỐNG
          </h1>
          <p className="text-slate-500 text-[10px] sm:text-xs font-semibold tracking-wider mt-1 text-center">
            HỆ THỐNG PHÁT TRIỂN GIÁO DỤC QUỐC TẾ THT
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-red-50 border-l-4 border-red-500 text-red-700 text-xs sm:text-sm font-medium animate-shake">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Email đăng nhập
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="name@tht.edu.vn"
              className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200/80 bg-slate-50/50 outline-none text-slate-800 text-sm sm:text-base focus:border-[#21398A] focus:bg-white focus:ring-4 focus:ring-[#21398A]/10 transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 sm:py-3 rounded-xl border border-slate-200/80 bg-slate-50/50 outline-none text-slate-800 text-sm sm:text-base focus:border-[#21398A] focus:bg-white focus:ring-4 focus:ring-[#21398A]/10 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center text-xs sm:text-sm text-slate-600 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#21398A] focus:ring-[#21398A] mr-2 cursor-pointer"
              />
              Ghi nhớ tài khoản
            </label>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 sm:py-3.5 bg-gradient-to-r from-[#21398A] to-[#1d3075] text-white text-sm sm:text-base font-semibold rounded-xl hover:from-[#1d3075] hover:to-[#17265e] focus:outline-none focus:ring-4 focus:ring-[#21398A]/30 active:scale-[0.98] transition-all shadow-lg shadow-[#21398a]/20 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP'}
          </button>
        </form>
      </div>

      <LoadingOverlay show={isSubmitting} message="Đang xác thực thông tin..." />
    </div>
  );
}
