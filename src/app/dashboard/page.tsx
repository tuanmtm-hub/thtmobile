'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import {
  Users,
  GraduationCap,
  Clock,
  Home,
  Layers,
  Calendar,
  Tag,
  UserCheck,
  ChevronRight,
  DollarSign,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

export default function Dashboard() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ' }
    ]);
  }, [setBreadcrumbs]);

  const cards = [
    {
      title: 'Lịch học hôm nay',
      description: 'Xem chi tiết các ca dạy và học trong ngày',
      href: '/schedule',
      icon: Clock,
      iconColor: 'text-indigo-600 bg-indigo-50',
    },
    {
      title: 'Học sinh',
      description: 'Quản lý thông tin học sinh, trạng thái chăm sóc',
      href: '/students',
      icon: Users,
      iconColor: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Lớp học',
      description: 'Xem chi tiết lớp học, sĩ số và lộ trình học',
      href: '/classes',
      icon: GraduationCap,
      iconColor: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Giáo viên',
      description: 'Quản lý hồ sơ giáo viên và phân quyền sử dụng',
      href: '/teachers',
      icon: UserCheck,
      iconColor: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Phòng học',
      description: 'Cấu hình danh sách phòng học và thiết bị',
      href: '/rooms',
      icon: Home,
      iconColor: 'text-sky-600 bg-sky-50',
    },
    {
      title: 'Ca học',
      description: 'Thiết lập khung giờ học và thời gian biểu',
      href: '/shifts',
      icon: Clock,
      iconColor: 'text-teal-600 bg-teal-50',
    },
    {
      title: 'Nhóm lớp',
      description: 'Phân nhóm lớp học theo cấp độ và chương trình',
      href: '/classgroups',
      icon: Layers,
      iconColor: 'text-purple-600 bg-purple-50',
    },
    {
      title: 'Ngày nghỉ lễ',
      description: 'Cập nhật lịch nghỉ lễ và các ngày nghỉ phép chung',
      href: '/holidays',
      icon: Calendar,
      iconColor: 'text-rose-600 bg-rose-50',
    },
    {
      title: 'Voucher',
      description: 'Quản lý mã giảm giá, khuyến mãi học phí',
      href: '/vouchers',
      icon: Tag,
      iconColor: 'text-pink-600 bg-pink-50',
    },
    {
      title: 'Thời khóa biểu',
      description: 'Xem thời khóa biểu tuần của các lớp học',
      href: '/calendar',
      icon: Calendar,
      iconColor: 'text-cyan-600 bg-cyan-50',
    },
    {
      title: 'Thời gian dạy',
      description: 'Quản lý giờ dạy và chấm công của giáo viên',
      href: '/teaching-time',
      icon: BookOpen,
      iconColor: 'text-emerald-700 bg-emerald-50/50',
    },
    {
      title: 'Quản lý thu chi',
      description: 'Đối soát các khoản thu học phí, chi phí vận hành',
      href: '/revenue',
      icon: DollarSign,
      iconColor: 'text-amber-700 bg-amber-50/70',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight font-sans">
            Tổng quan hệ thống
          </h1>
          <p className="text-slate-500 mt-1">
            Chào mừng quay trở lại, <span className="font-semibold text-[#21398A]">{user?.name}</span>! Chúc bạn một ngày làm việc hiệu quả.
          </p>
        </div>
      </div>

      {/* Grid KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              key={idx}
              href={card.href}
              className="tht-dashboard-kpi-card bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:border-[#21398A]/35 transition-all duration-300 cursor-pointer group hover:scale-[1.02]"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 ${card.iconColor}`}>
                  <Icon size={24} />
                </div>
                <div className="space-y-1">
                  <span className="text-slate-800 text-base font-bold tracking-tight block group-hover:text-[#21398A] transition-colors">
                    {card.title}
                  </span>
                  <span className="text-slate-400 text-xs font-medium block">
                    {card.description}
                  </span>
                </div>
              </div>
              <div className="text-slate-300 group-hover:text-[#21398A] group-hover:translate-x-1 transition-all duration-300">
                <ChevronRight size={20} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
