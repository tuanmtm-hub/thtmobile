'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CreditCard,
  BarChart3,
  Home,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  CalendarRange,
  Clock,
  Layers,
  Tag,
  AlertTriangle,
  FileSpreadsheet,
  Coffee,
  DollarSign,
  Mail,
  ChevronDown,
  Settings,
  Presentation,
  UserCheck,
  User,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [logoUrl, setLogoUrl] = useState('https://lh3.googleusercontent.com/d/1r-qC4mx37_9M2wihp3bRsMuI09hMHPOt');
  const [companyName, setCompanyName] = useState('THT Center');

  useEffect(() => {
    const loadBrand = () => {
      if (typeof window !== 'undefined') {
        const storedName = localStorage.getItem('THT_CompanyShortName');
        if (storedName) setCompanyName(storedName);
      }
    };
    loadBrand();
    window.addEventListener('company-brand-updated', loadBrand);
    return () => window.removeEventListener('company-brand-updated', loadBrand);
  }, []);
  const searchParams = useSearchParams();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isReportsExpanded, setIsReportsExpanded] = useState(() => {
    return pathname.startsWith('/reports');
  });
 
  const activeReportType = searchParams.get('type') || 'missing_attendance';
 
  const subReportItems = [
    { id: 'missing_attendance', name: 'Kiểm tra điểm danh', icon: AlertTriangle },
    { id: 'master_attendance', name: 'Lịch sử điểm danh', icon: FileSpreadsheet },
    { id: 'meal_report', name: 'Báo cáo tiền ăn', icon: Coffee },
    { id: 'revenue_report', name: 'Báo cáo doanh thu', icon: DollarSign },
    { id: 'email_history', name: 'Lịch sử gửi email', icon: Mail }
  ];

  const [isSettingsExpanded, setIsSettingsExpanded] = useState(() => {
    return pathname.startsWith('/rooms') ||
           pathname.startsWith('/shifts') ||
           pathname.startsWith('/classgroups') ||
           pathname.startsWith('/holidays') ||
           pathname.startsWith('/company') ||
           pathname.startsWith('/vouchers');
  });

  if (!user) return null;

  const userPerms = user.permissions || {};
  const isAdmin = user.role === 'Admin' || userPerms['perm_admin'] === true;

  const subSettingsItems = [
    { id: 'rooms', name: 'Phòng học', href: '/rooms', icon: Home, show: isAdmin || userPerms['perm_settings_view'] !== false },
    { id: 'shifts', name: 'Ca học', href: '/shifts', icon: Clock, show: isAdmin || userPerms['perm_settings_view'] !== false },
    { id: 'classgroups', name: 'Nhóm lớp', href: '/classgroups', icon: Layers, show: true },
    { id: 'holidays', name: 'Ngày nghỉ lễ', href: '/holidays', icon: Calendar, show: true },
    { id: 'vouchers', name: 'Voucher & giảm giá', href: '/vouchers', icon: Tag, show: true },
    { id: 'company', name: 'Thông tin công ty', href: '/company', icon: Settings, show: true },
  ];

  const menuItems = [
    {
      name: 'Trang chủ',
      href: '/dashboard',
      icon: LayoutDashboard,
      show: true,
    },
    {
      name: 'Học sinh',
      href: '/students',
      icon: Users,
      show: isAdmin || userPerms['perm_student_view'] !== false,
    },
    {
      name: 'Lớp học',
      href: '/classes',
      icon: GraduationCap,
      show: isAdmin || userPerms['perm_class_view'] !== false,
    },
    {
      name: 'Lịch học hôm nay',
      href: '/schedule',
      icon: Clock,
      show: isAdmin || userPerms['perm_class_view'] !== false,
    },
    {
      name: 'Giáo viên',
      href: '/teachers',
      icon: UserCheck,
      show: isAdmin || userPerms['perm_teacher_view'] !== false,
    },
    {
      name: 'Thời khóa biểu',
      href: '/calendar',
      icon: CalendarRange,
      show: isAdmin || userPerms['perm_schedule_view'] !== false,
    },
    {
      name: 'Thời gian dạy',
      href: '/teaching-time',
      icon: Clock,
      show: isAdmin || userPerms['perm_schedule_view'] !== false,
    },
    {
      name: 'Quản lý thu chi',
      href: '/revenue',
      icon: CreditCard,
      show: isAdmin || userPerms['perm_revenue_view'] !== false,
    },
    {
      name: 'Báo cáo',
      href: '/reports',
      icon: BarChart3,
      show: isAdmin || userPerms['perm_report_view'] !== false,
    },
    {
      name: 'Hướng dẫn sử dụng',
      href: '/guides',
      icon: HelpCircle,
      show: true,
    },
    {
      name: 'Cài đặt hệ thống',
      href: '/settings',
      icon: Settings,
      show: true,
    },
  ];

  const handleLogout = () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
      logout();
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 bg-white rounded-lg shadow-lg text-[#21398A] border border-gray-100 hover:bg-slate-50 transition-all focus:outline-none"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40"
        />
      )}

      {/* Sidebar main body */}
      <aside
        className={`fixed top-0 left-0 h-screen bg-white shadow-2xl z-40 flex flex-col justify-between transition-all duration-300 border-r border-slate-100
          ${isCollapsed ? 'w-20' : 'w-64'} 
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Sidebar Logo */}
        <div>
          <div className={`py-6 px-4 flex items-center ${isCollapsed ? 'justify-between' : 'justify-center relative'}`}>
            {!isCollapsed && (
              <a
                href="https://tht.edu.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center hover:opacity-85 transition-opacity"
              >
                <img
                  src={logoUrl}
                  alt="THT Logo"
                  className="h-16 w-auto max-w-[170px] object-contain"
                />
              </a>
            )}
            {isCollapsed && (
              <a
                href="https://tht.edu.vn/"
                target="_blank"
                rel="noopener noreferrer"
                className="block mx-auto hover:opacity-85 transition-opacity"
              >
                <img
                  src={logoUrl}
                  alt="THT Logo"
                  className="h-10 w-auto max-w-[50px] object-contain mx-auto"
                />
              </a>
            )}

            {/* Collapse button for desktop */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden md:flex p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ${
                isCollapsed ? '' : 'absolute right-4 top-1/2 -translate-y-1/2'
              }`}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 px-3 space-y-1.5 flex-grow overflow-y-auto max-h-[calc(100vh-180px)]">
            {menuItems
              .filter((item) => item.show)
              .map((item) => {
                const Icon = item.icon;
                const isMainActive = pathname === item.href;
                const isReportsRouteActive = item.href === '/reports' && pathname.startsWith('/reports');

                if (item.href === '/reports') {
                  return (
                    <div key={item.href} className="space-y-1">
                      <button
                        onClick={() => {
                          if (isCollapsed) {
                            setIsCollapsed(false);
                            setIsReportsExpanded(true);
                          } else {
                            setIsReportsExpanded(!isReportsExpanded);
                          }
                        }}
                        className={`w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-medium transition-all duration-150 group cursor-pointer
                          text-slate-600 hover:bg-[#21398A] hover:text-white hover:shadow-lg hover:shadow-[#21398a]/20
                          ${isCollapsed ? 'justify-center' : ''}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <Icon size={20} className="text-slate-400 group-hover:text-white" />
                          {!isCollapsed && <span>{item.name}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 text-slate-400 group-hover:text-white ${isReportsExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </button>
                      
                      {!isCollapsed && (
                        <div
                          className={`mt-1 ml-4 pl-3 border-l border-slate-100 space-y-1.5 overflow-hidden transition-all duration-1000 ease-in-out
                            ${isReportsExpanded
                              ? 'max-h-96 opacity-100 visible py-1'
                              : 'max-h-0 opacity-0 invisible py-0 pointer-events-none'
                            }
                          `}
                        >
                          {subReportItems.map((sub) => {
                            const isSubActive = pathname === '/reports' && activeReportType === sub.id;
                            const SubIcon = sub.icon;
                            return (
                              <Link
                                key={sub.id}
                                href={`/reports?type=${sub.id}`}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center gap-4 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-150 group
                                  ${isSubActive
                                    ? 'bg-[#21398A] text-white shadow-lg shadow-[#21398a]/20 font-semibold'
                                    : 'text-slate-600 hover:bg-[#21398A] hover:text-white hover:shadow-lg hover:shadow-[#21398a]/20'
                                  }
                                `}
                              >
                                <SubIcon size={20} className={isSubActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                                <span>{sub.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                if (item.href === '/settings') {
                  const filteredSubSettings = subSettingsItems.filter(sub => sub.show);
                  if (filteredSubSettings.length === 0) return null;

                  return (
                    <div key={item.href} className="space-y-1">
                      <button
                        onClick={() => {
                          if (isCollapsed) {
                            setIsCollapsed(false);
                            setIsSettingsExpanded(true);
                          } else {
                            setIsSettingsExpanded(!isSettingsExpanded);
                          }
                        }}
                        className={`w-full flex items-center justify-between py-3 px-4 rounded-xl text-sm font-medium transition-all duration-150 group cursor-pointer
                          text-slate-600 hover:bg-[#21398A] hover:text-white hover:shadow-lg hover:shadow-[#21398a]/20
                          ${isCollapsed ? 'justify-center' : ''}
                        `}
                      >
                        <div className="flex items-center gap-4">
                          <Icon size={20} className="text-slate-400 group-hover:text-white" />
                          {!isCollapsed && <span>{item.name}</span>}
                        </div>
                        {!isCollapsed && (
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 text-slate-400 group-hover:text-white ${isSettingsExpanded ? 'rotate-180' : ''}`}
                          />
                        )}
                      </button>
                      
                      {!isCollapsed && (
                        <div
                          className={`mt-1 ml-4 pl-3 border-l border-slate-100 space-y-1.5 overflow-hidden transition-all duration-1000 ease-in-out
                            ${isSettingsExpanded
                              ? 'max-h-96 opacity-100 visible py-1'
                              : 'max-h-0 opacity-0 invisible py-0 pointer-events-none'
                            }
                          `}
                        >
                          {filteredSubSettings.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            const SubIcon = sub.icon;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                onClick={() => setIsMobileOpen(false)}
                                className={`flex items-center gap-4 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-150 group
                                  ${isSubActive
                                    ? 'bg-[#21398A] text-white shadow-lg shadow-[#21398a]/20 font-semibold'
                                    : 'text-slate-600 hover:bg-[#21398A] hover:text-white hover:shadow-lg hover:shadow-[#21398a]/20'
                                  }
                                `}
                              >
                                <SubIcon size={20} className={isSubActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                                <span>{sub.name}</span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileOpen(false)}
                    className={`flex items-center gap-4 py-3 px-4 rounded-xl text-sm font-medium transition-all duration-150 group
                      ${isMainActive
                        ? 'bg-[#21398A] text-white shadow-lg shadow-[#21398a]/20 font-semibold'
                        : 'text-slate-600 hover:bg-[#21398A] hover:text-white hover:shadow-lg hover:shadow-[#21398a]/20'
                      }
                      ${isCollapsed ? 'justify-center' : ''}
                    `}
                  >
                    <Icon size={20} className={`${isMainActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
          </nav>
        </div>

        {/* User profile section & Logout button */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-4 py-3 px-4 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors
              ${isCollapsed ? 'justify-center' : ''}
            `}
          >
            <LogOut size={20} />
            {!isCollapsed && <span>Đăng xuất</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
