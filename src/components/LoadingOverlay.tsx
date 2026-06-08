'use client';

import React from 'react';

interface LoadingOverlayProps {
  show: boolean;
  message?: string;
}

export default function LoadingOverlay({ show, message = 'Đang tải dữ liệu, vui lòng đợi...' }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center transition-all duration-300 animate-fade-in">
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Animated outer spinning ring */}
        <div className="absolute inset-0 rounded-full border-[7px] border-white border-t-[#21398A] animate-spin"></div>
        
        {/* Centered THT Logo */}
        <img
          src="https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png"
          alt="THT Center"
          className="w-16 h-16 object-contain z-10 animate-pulse"
        />
      </div>
      
      {message && (
        <p className="mt-6 text-white text-lg font-medium tracking-wide drop-shadow-md animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
