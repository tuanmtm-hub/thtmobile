'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import {
  guidesData,
  GuideCategory,
  GuideItem
} from '@/data/guidesData';
import {
  Search,
  Play,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  UserCheck,
  Users,
  GraduationCap,
  Settings,
  CreditCard,
  ChevronRight,
  Clock,
  ArrowRight,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import Link from 'next/link';

// Map icon names to Lucide icon components
const iconMap = {
  UserCheck: UserCheck,
  Users: Users,
  GraduationCap: GraduationCap,
  Settings: Settings,
  CreditCard: CreditCard
};

export default function GuidesPage() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();

  // Navigation / State Management
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    teachers: true,
    students: false,
    classes: false,
    settings: false,
    revenue: false
  });

  // Breadcrumbs setup
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/dashboard' },
      { label: 'Hướng dẫn sử dụng' }
    ]);
  }, [setBreadcrumbs]);

  // Find currently active guide object
  const activeGuide = useMemo<GuideItem | null>(() => {
    if (!activeGuideId) return null;
    for (const cat of guidesData) {
      const item = cat.items.find(i => i.id === activeGuideId);
      if (item) return item;
    }
    return null;
  }, [activeGuideId]);

  // Find currently active category object
  const activeCategory = useMemo<GuideCategory | null>(() => {
    if (!activeGuideId) return null;
    for (const cat of guidesData) {
      if (cat.items.some(i => i.id === activeGuideId)) {
        return cat;
      }
    }
    return null;
  }, [activeGuideId]);

  // Filter guides based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return guidesData;
    const term = searchTerm.toLowerCase();

    return guidesData.map(cat => {
      const matchedItems = cat.items.filter(
        item =>
          item.title.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.steps.some(step => step.toLowerCase().includes(term))
      );
      return {
        ...cat,
        items: matchedItems
      };
    }).filter(cat => cat.items.length > 0);
  }, [searchTerm]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const handleSelectGuide = (guideId: string) => {
    setActiveGuideId(guideId);
    // Find category of this guide to auto expand it
    const cat = guidesData.find(c => c.items.some(i => i.id === guideId));
    if (cat) {
      setExpandedCategories(prev => ({
        ...prev,
        [cat.id]: true
      }));
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner and Search */}
      <div className="bg-gradient-to-r from-[#21398A] to-[#122258] p-6 lg:p-8 rounded-2xl text-white shadow-lg space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-md">
            <HelpCircle size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight font-sans">
              Hướng dẫn sử dụng hệ thống
            </h1>
            <p className="text-white/80 text-sm font-medium mt-0.5">
              Hệ thống tài liệu và video hướng dẫn từng bước chi tiết để quản lý trung tâm tiếng Anh THT.
            </p>
          </div>
        </div>

        <div className="max-w-2xl relative pt-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/50" size={18} />
          <input
            type="text"
            placeholder="Tìm kiếm bài hướng dẫn (ví dụ: điểm danh, thêm giáo viên...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/15 transition-all text-sm font-medium"
          />
        </div>
      </div>

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Navigation Sidebar */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4 max-h-[calc(100vh-220px)] overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-slate-800 text-sm font-bold uppercase tracking-wider">
              Danh mục hướng dẫn
            </span>
            {activeGuideId && (
              <button
                onClick={() => setActiveGuideId(null)}
                className="text-xs font-semibold text-[#21398A] hover:underline"
              >
                Trang tổng quan
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {filteredData.length === 0 ? (
              <div className="text-slate-400 text-sm font-medium py-6 text-center">
                Không tìm thấy bài hướng dẫn nào phù hợp.
              </div>
            ) : (
              filteredData.map(cat => {
                const IconComponent = iconMap[cat.iconName] || BookOpen;
                const isExpanded = expandedCategories[cat.id];
                
                return (
                  <div key={cat.id} className="border border-slate-100 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleCategory(cat.id)}
                      className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-[#21398A] bg-blue-50 p-1.5 rounded-lg">
                          <IconComponent size={18} />
                        </div>
                        <span className="text-slate-700 text-sm font-bold">
                          {cat.name}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="p-1.5 bg-white space-y-1 border-t border-slate-50">
                        {cat.items.map(item => {
                          const isActive = activeGuideId === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelectGuide(item.id)}
                              className={`w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left text-xs font-medium transition-all group
                                ${isActive 
                                  ? 'bg-blue-50/80 text-[#21398A] font-semibold' 
                                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }
                              `}
                            >
                              <Play size={12} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-[#21398A]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                              <div className="flex-grow space-y-0.5">
                                <span className="block leading-relaxed">{item.title}</span>
                                <span className="flex items-center gap-1 text-[10px] text-slate-400">
                                  <Clock size={10} /> {item.duration}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Main Detail Area */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* A. Welcome Dashboard (If no guide is active) */}
          {!activeGuide ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm space-y-8 animate-fade-in">
              <div className="text-center max-w-lg mx-auto space-y-4">
                <div className="inline-flex p-4 bg-blue-50 rounded-full text-[#21398A] animate-pulse">
                  <BookOpen size={48} />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-slate-800 text-xl font-bold font-sans">
                    Chào mừng bạn đến với Góc Hướng Dẫn
                  </h2>
                  <p className="text-slate-400 text-sm font-medium leading-relaxed">
                    Hãy lựa chọn các chuyên mục hướng dẫn cụ thể ở menu bên trái hoặc chọn nhanh các nhóm nội dung phổ biến bên dưới.
                  </p>
                </div>
              </div>

              {/* Quick Start Cards Grid */}
              <div className="space-y-4">
                <h3 className="text-slate-800 text-xs font-bold uppercase tracking-wider">
                  Chuyên mục hướng dẫn nhanh
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {guidesData.map(cat => {
                    const IconComponent = iconMap[cat.iconName] || BookOpen;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (cat.items.length > 0) {
                            handleSelectGuide(cat.items[0].id);
                          }
                        }}
                        className="p-5 bg-white border border-slate-100 rounded-xl shadow-xs text-left hover:shadow-md hover:border-[#21398A]/35 transition-all duration-300 group hover:scale-[1.01]"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="bg-blue-50 text-[#21398A] p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-105">
                            <IconComponent size={22} />
                          </div>
                          <div>
                            <span className="block text-slate-800 text-sm font-bold group-hover:text-[#21398A] transition-colors">
                              {cat.name}
                            </span>
                            <span className="block text-slate-400 text-xs font-medium mt-0.5">
                              {cat.items.length} bài hướng dẫn chi tiết
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            
            // B. Guide Detailed View (If a guide is active)
            <div className="bg-white p-6 lg:p-8 rounded-2xl border border-slate-100 shadow-sm space-y-6 animate-fade-in">
              {/* Navigation and Badges */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <button
                  onClick={() => setActiveGuideId(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft size={16} /> Quay lại tổng quan
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                    {activeCategory?.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-md">
                    <Clock size={12} /> {activeGuide.duration}
                  </span>
                </div>
              </div>

              {/* Title & Desc */}
              <div className="space-y-2">
                <h2 className="text-slate-800 text-xl lg:text-2xl font-bold tracking-tight font-sans">
                  {activeGuide.title}
                </h2>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">
                  {activeGuide.description}
                </p>
              </div>

              {/* Video Player or Placeholder */}
              <div className="w-full aspect-video rounded-xl overflow-hidden shadow-md border border-slate-100 relative bg-slate-950">
                {activeGuide.youtubeId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${activeGuide.youtubeId}`}
                    title={activeGuide.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  /* YouTube Video Placeholder */
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#16275c] to-[#122258] flex flex-col items-center justify-center p-6 text-center text-white space-y-4">
                    <div className="w-16 h-16 rounded-full bg-red-600/90 text-white flex items-center justify-center shadow-lg shadow-red-600/30 animate-pulse cursor-not-allowed">
                      <Play size={28} className="ml-1 fill-white" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <span className="text-base font-extrabold flex items-center justify-center gap-2">
                        <Sparkles size={18} className="text-amber-400" />
                        Video đang được cập nhật
                      </span>
                      <p className="text-xs text-white/70 font-medium leading-relaxed">
                        Liên kết video hướng dẫn YouTube của bài học này đang được chuẩn bị. Bạn hãy xem hướng dẫn từng bước chi tiết bằng chữ ở phía bên dưới.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Steps Area */}
              <div className="space-y-4 pt-2">
                <h3 className="text-slate-800 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#21398A]" />
                  Các bước thực hiện chi tiết
                </h3>
                <div className="bg-slate-50/50 border border-slate-100 p-5 rounded-xl space-y-3">
                  {activeGuide.steps.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#21398A]/10 text-[#21398A] flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-slate-600 text-sm font-semibold leading-relaxed">
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes Area (if exists) */}
              {activeGuide.notes && activeGuide.notes.length > 0 && (
                <div className="border border-amber-100 bg-amber-50/30 p-4 rounded-xl space-y-2">
                  <span className="text-amber-700 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle size={14} /> Lưu ý quan trọng
                  </span>
                  <ul className="list-disc pl-5 space-y-1.5">
                    {activeGuide.notes.map((note, idx) => (
                      <li key={idx} className="text-slate-600 text-xs font-semibold leading-relaxed">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Practice Redirect Button */}
              {activeGuide.practiceUrl && (
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <Link
                    href={activeGuide.practiceUrl}
                    className="tht-btn-primary py-2 px-5 text-sm font-bold flex items-center gap-2 group cursor-pointer"
                  >
                    Đi tới chức năng thực hành
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
