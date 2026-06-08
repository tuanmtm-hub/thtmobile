'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import LoadingOverlay from '@/components/LoadingOverlay';
import { BreadcrumbProvider } from '@/context/BreadcrumbContext';
import { gasRequest } from '@/lib/gasApi';

export default function LayoutClientWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Set mounted to true on client-side mount to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize dynamic company brand configuration on user login
  useEffect(() => {
    if (user) {
      const syncCompanyBrand = async () => {
        try {
          const res = await gasRequest({
            sheet: 'Company',
            action: 'FETCH_ALL',
            loginEmail: user.email,
          });
          if (res.success && res.data) {
            localStorage.setItem('THT_CompanyLogo', res.data.logoUrl || 'https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png');
            localStorage.setItem('THT_CompanyShortName', res.data.shortName || 'THT Center');
            localStorage.setItem('THT_CompanyInfo', JSON.stringify(res.data));
            // Trigger local event to notify other UI components to refresh logo and brand name
            window.dispatchEvent(new Event('company-brand-updated'));
          }
        } catch (e) {
          console.error('Failed to sync company brand settings from Google Sheets:', e);
        }
      };
      syncCompanyBrand();
    }
  }, [user]);

  if (!mounted) {
    return null;
  }

  // If loading session state, display premium loading overlay
  if (loading) {
    return <LoadingOverlay show={true} message="THT Center đang kết nối hệ thống..." />;
  }

  const isLoginPage = pathname === '/login';

  // If not logged in and not on login page, wait for router redirect
  if (!user && !isLoginPage) {
    return <LoadingOverlay show={true} message="Đang chuyển hướng xác thực..." />;
  }

  // Render plain children for login page
  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <BreadcrumbProvider>
      <div className="flex min-h-screen">
        {/* Dynamic folding sidebar */}
        <Sidebar isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed} />

        {/* Main viewport with responsive dynamic margins depending on folding state */}
        <main className={`flex-1 flex flex-col transition-all duration-300 min-h-screen min-w-0 overflow-x-hidden ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
          <Navbar />
          <div className="flex-1 p-4 md:p-8 w-full min-w-0">
            <div className="animate-fade-in min-w-0">{children}</div>
          </div>
        </main>
      </div>
    </BreadcrumbProvider>
  );
}
