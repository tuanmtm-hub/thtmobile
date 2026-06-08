'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { useBreadcrumb } from '@/context/BreadcrumbContext';
import { gasRequest } from '@/lib/gasApi';
import {
  Building,
  Phone,
  Mail,
  Globe,
  MapPin,
  CreditCard,
  CheckCircle,
  Edit,
  Save,
  RefreshCw,
  FileText,
  Calendar,
  ShieldAlert,
  Info,
  X,
  Image,
} from 'lucide-react';

interface CompanyInfo {
  name: string;
  shortName: string;
  taxCode: string;
  foundedDate: string;
  hotline: string;
  mobile1: string;
  mobile2: string;
  email: string;
  website: string;
  logoUrl: string;
  address: string;
  slogan: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'Công ty Cổ phần Giáo dục & Công nghệ THT',
  shortName: 'THT Center',
  taxCode: '0109874562',
  foundedDate: '2021-08-15',
  hotline: '0263 3833 333',
  mobile1: '0931 277 200',
  mobile2: '0931 20 15 16',
  email: 'support@tht.edu.vn',
  website: 'https://tht.edu.vn',
  logoUrl: 'https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png',
  address: 'Số 12, Ngõ 45, Phố Trần Thái Tông, Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
  slogan: 'Chắp cánh tài năng công nghệ Việt',
  bankName: 'Ngân hàng TMCP Quân đội (MB Bank)',
  accountName: 'CONG TY CP GD VA CN THT',
  accountNumber: '1900 8686 9999',
};

const Portal = ({ children }: { children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted || typeof window === 'undefined') return null;
  return createPortal(children, document.body);
};

export default function CompanyPage() {
  const { user } = useAuth();
  const { setBreadcrumbs } = useBreadcrumb();

  const userPerms = user?.permissions || {};
  const isAdmin = user?.role === 'Admin' || userPerms['perm_admin'] === true;
  const canEdit = isAdmin || userPerms['perm_settings_edit'] === true;

  // Breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: 'Trang chủ', href: '/' },
      { label: 'Cài đặt hệ thống', href: '/rooms' },
      { label: 'Thông tin công ty' },
    ]);
  }, [setBreadcrumbs]);

  // States
  const [info, setInfo] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<CompanyInfo>(DEFAULT_COMPANY_INFO);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Fetch dynamic company info from Google Sheets on mount
  const fetchCompanyInfo = async () => {
    try {
      setLoading(true);
      const res = await gasRequest<CompanyInfo>({
        sheet: 'Company',
        action: 'FETCH_ALL',
        loginEmail: user?.email || '',
      });
      if (res.success && res.data) {
        const cleanData = {
          ...res.data,
          hotline: res.data.hotline ? String(res.data.hotline).replace(/^'/, '') : '',
          mobile1: res.data.mobile1 ? String(res.data.mobile1).replace(/^'/, '') : '',
          mobile2: res.data.mobile2 ? String(res.data.mobile2).replace(/^'/, '') : '',
        };
        setInfo(cleanData);
        setFormData(cleanData);
        // Sync logo & name locally to refresh sidebar immediately
        if (typeof window !== 'undefined') {
          localStorage.setItem('THT_CompanyLogo', cleanData.logoUrl || DEFAULT_COMPANY_INFO.logoUrl);
          localStorage.setItem('THT_CompanyShortName', cleanData.shortName || DEFAULT_COMPANY_INFO.shortName);
          localStorage.setItem('THT_CompanyInfo', JSON.stringify(cleanData));
        }
      }
    } catch (e) {
      console.error('Error fetching company details from GAS:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCompanyInfo();
    }
  }, [user]);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessToast(true);
    setTimeout(() => {
      setShowSuccessToast(false);
    }, 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.shortName.trim()) {
      alert('Vui lòng nhập Tên công ty và Tên viết tắt!');
      return;
    }

    setSubmitting(true);
    try {
      const formatPhoneForSheet = (val: string) => {
        if (!val) return '';
        const trimmed = val.trim();
        if (!trimmed) return '';
        if (/^\d/.test(trimmed)) {
          return trimmed.startsWith("'") ? trimmed : `'${trimmed}`;
        }
        return trimmed;
      };

      const payload = {
        ...formData,
        hotline: formatPhoneForSheet(formData.hotline),
        mobile1: formatPhoneForSheet(formData.mobile1),
        mobile2: formatPhoneForSheet(formData.mobile2),
      };

      const res = await gasRequest({
        sheet: 'Company',
        action: 'UPDATE',
        data: payload,
        loginEmail: user?.email || '',
      });

      if (res.success) {
        setInfo(formData);
        if (typeof window !== 'undefined') {
          localStorage.setItem('THT_CompanyLogo', formData.logoUrl || DEFAULT_COMPANY_INFO.logoUrl);
          localStorage.setItem('THT_CompanyShortName', formData.shortName || DEFAULT_COMPANY_INFO.shortName);
          localStorage.setItem('THT_CompanyInfo', JSON.stringify(formData));
        }
        setIsEditing(false);
        triggerSuccess(res.message || 'Đã cập nhật thông tin công ty thành công!');
      } else {
        alert(res.message || 'Cập nhật thất bại.');
      }
    } catch (err: any) {
      alert('Lỗi kết nối: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData(info);
    setIsEditing(false);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Thông tin Công ty</h1>
          <p className="text-slate-500 mt-1">
            Quản lý và hiển thị thông tin pháp lý, liên hệ và tài khoản thanh toán của doanh nghiệp.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canEdit && (
            !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="tht-btn-primary"
              >
                <Edit size={16} />
                <span>Chỉnh sửa thông tin</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="tht-btn-outline"
                  disabled={submitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  form="company-settings-form"
                  className="tht-btn-primary"
                  disabled={submitting}
                >
                  <Save size={16} />
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Main Container Layout */}
      <form id="company-settings-form" onSubmit={handleSave}>
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 items-start">

          {/* LEFT COLUMN: Profile & Payment (col-span-3) */}
          <div className="lg:col-span-3 space-y-6">

            {/* Slogan Banner Card */}
            <div className="bg-gradient-to-br from-[#21398A] to-[#12235e] text-white p-6 rounded-2xl border border-blue-900 shadow-xl relative overflow-hidden flex flex-col items-center justify-center text-center py-8">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl translate-x-4 -translate-y-4" />
              <img
                src={info.logoUrl || 'https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png'}
                alt="THT Logo"
                className="w-20 h-20 object-contain drop-shadow-md mb-4 bg-white p-2 rounded-2xl"
              />
              <h2 className="text-xl font-bold font-sans tracking-wide">{info.shortName}</h2>
              <span className="text-[10px] text-white/50 tracking-widest uppercase font-bold mt-1">HỆ THỐNG PHÁT TRIỂN GIÁO DỤC QUỐC TẾ THT</span>
              <p className="text-xs italic text-blue-100 mt-4 leading-relaxed font-medium">
                "{info.slogan}"
              </p>
            </div>

            {/* Premium Interactive Mock QR Payment Gateway */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard size={14} className="text-[#21398A]" />
                Tài khoản học phí THT
              </h3>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3.5">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Ngân hàng thụ hưởng</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.bankName || ''}
                      onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs font-semibold text-slate-800 focus:border-[#21398A]"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{info.bankName}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Số tài khoản</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.accountNumber || ''}
                      onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold text-slate-800 focus:border-[#21398A]"
                    />
                  ) : (
                    <span className="text-sm font-extrabold text-[#21398A] block mt-0.5 tracking-wider">{info.accountNumber}</span>
                  )}
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tên chủ tài khoản</span>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.accountName || ''}
                      onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-none text-xs font-bold text-slate-800 focus:border-[#21398A]"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-700 block mt-0.5">{info.accountName}</span>
                  )}
                </div>
              </div>

              {/* Dynamic QR Mocking Component */}
              <div className="flex flex-col items-center justify-center pt-3 border-t border-slate-100">
                <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm relative group flex items-center justify-center">
                  {/* Styled Mock QR SVG */}
                  <svg className="w-36 h-36 text-slate-800" viewBox="0 0 100 100">
                    <rect width="10" height="10" x="5" y="5" fill="currentColor" />
                    <rect width="6" height="6" x="7" y="7" fill="white" />
                    <rect width="2" height="2" x="9" y="9" fill="currentColor" />

                    <rect width="10" height="10" x="85" y="5" fill="currentColor" />
                    <rect width="6" height="6" x="87" y="7" fill="white" />
                    <rect width="2" height="2" x="89" y="9" fill="currentColor" />

                    <rect width="10" height="10" x="5" y="85" fill="currentColor" />
                    <rect width="6" height="6" x="7" y="87" fill="white" />
                    <rect width="2" height="2" x="9" y="89" fill="currentColor" />

                    {/* QR Code Matrix Mocks */}
                    <rect x="25" y="5" width="4" height="2" fill="currentColor" />
                    <rect x="35" y="9" width="8" height="2" fill="currentColor" />
                    <rect x="50" y="5" width="2" height="6" fill="currentColor" />
                    <rect x="65" y="7" width="10" height="2" fill="currentColor" />

                    <rect x="5" y="25" width="2" height="4" fill="currentColor" />
                    <rect x="9" y="35" width="2" height="8" fill="currentColor" />
                    <rect x="20" y="20" width="12" height="12" fill="currentColor" />
                    <rect x="24" y="24" width="4" height="4" fill="white" />

                    <rect x="40" y="25" width="8" height="4" fill="currentColor" />
                    <rect x="55" y="20" width="4" height="8" fill="currentColor" />
                    <rect x="65" y="25" width="15" height="2" fill="currentColor" />
                    <rect x="85" y="25" width="2" height="8" fill="currentColor" />

                    <rect x="25" y="45" width="4" height="4" fill="currentColor" />
                    <rect x="35" y="40" width="8" height="10" fill="currentColor" />
                    <rect x="50" y="45" width="10" height="2" fill="currentColor" />
                    <rect x="70" y="40" width="6" height="6" fill="currentColor" />
                    <rect x="85" y="45" width="10" height="2" fill="currentColor" />

                    <rect x="20" y="60" width="15" height="2" fill="currentColor" />
                    <rect x="45" y="55" width="2" height="10" fill="currentColor" />
                    <rect x="55" y="60" width="10" height="4" fill="currentColor" />
                    <rect x="75" y="55" width="12" height="12" fill="currentColor" />
                    <rect x="79" y="59" width="4" height="4" fill="white" />

                    <rect x="25" y="75" width="4" height="2" fill="currentColor" />
                    <rect x="35" y="80" width="12" height="4" fill="currentColor" />
                    <rect x="55" y="75" width="2" height="15" fill="currentColor" />
                    <rect x="65" y="85" width="12" height="2" fill="currentColor" />

                    {/* Small center logo logo block */}
                    <rect x="44" y="44" width="12" height="12" rx="2" fill="#21398A" />
                    <circle cx="50" cy="50" r="3" fill="white" />
                  </svg>
                  {/* Subtle Scan Overlay */}
                  <div className="absolute inset-0 bg-[#21398A]/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-[#21398A] font-extrabold select-none pointer-events-none rounded-xl">
                    MB BANK QR MOCK
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-2 font-bold uppercase flex items-center gap-1">
                  <Info size={10} className="text-[#21398A]" /> Quét mã để đóng học phí
                </span>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: Info Cards & Forms (col-span-7) */}
          <div className="lg:col-span-7 space-y-6">

            {/* Legal Information Section Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <Building size={16} className="text-[#21398A]" />
                Thông tin Pháp lý & Pháp nhân
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div>
                  <label className="tht-input-label">Tên doanh nghiệp chính thức</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="tht-input mt-1.5"
                      required
                    />
                  ) : (
                    <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5">
                      {info.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="tht-input-label">Tên viết tắt / Thương hiệu</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.shortName || ''}
                      onChange={(e) => setFormData({ ...formData, shortName: e.target.value })}
                      className="tht-input mt-1.5"
                      required
                    />
                  ) : (
                    <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5">
                      {info.shortName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="tht-input-label">Mã số thuế doanh nghiệp</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.taxCode || ''}
                      onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                      className="tht-input mt-1.5"
                    />
                  ) : (
                    <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                      <FileText size={14} className="text-slate-400" />
                      {info.taxCode}
                    </p>
                  )}
                </div>


                <div>
                  <label className="tht-input-label">Ngày thành lập chính thức</label>
                  {isEditing ? (
                    <input
                      type="date"
                      value={formData.foundedDate || ''}
                      onChange={(e) => setFormData({ ...formData, foundedDate: e.target.value })}
                      className="tht-input mt-1.5"
                    />
                  ) : (
                    <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                      <Calendar size={14} className="text-slate-400" />
                      {info.foundedDate ? new Date(info.foundedDate).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="tht-input-label">Câu khẩu hiệu / Slogan</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.slogan || ''}
                      onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                      className="tht-input mt-1.5"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-600 italic bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5">
                      "{info.slogan}"
                    </p>
                  )}
                </div>

                <div>
                  <label className="tht-input-label">URL Logo thương hiệu</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.logoUrl || ''}
                      onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                      className="tht-input mt-1.5"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-600 truncate bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-1.5">
                      <Image size={14} className="text-slate-400 shrink-0" />
                      <span className="truncate">{info.logoUrl}</span>
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* Contact Details & Info Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
                <MapPin size={16} className="text-[#21398A]" />
                Thông tin Liên hệ & Địa chỉ
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="tht-input-label">Trụ sở chính / Địa chỉ đăng ký kinh doanh</label>
                  {isEditing ? (
                    <textarea
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="tht-input mt-1.5 h-20 resize-none py-2"
                      required
                    />
                  ) : (
                    <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-start gap-2.5">
                      <MapPin size={16} className="text-slate-400 mt-0.5 shrink-0" />
                      <span>{info.address}</span>
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                  <div>
                    <label className="tht-input-label">Số điện thoại bàn</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.hotline || ''}
                        onChange={(e) => setFormData({ ...formData, hotline: e.target.value })}
                        className="tht-input mt-1.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        {info.hotline}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="tht-input-label">Email công ty</label>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="tht-input mt-1.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" />
                        {info.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="tht-input-label">Website</label>
                    {isEditing ? (
                      <input
                        type="url"
                        value={formData.website || ''}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="tht-input mt-1.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                        <Globe size={14} className="text-slate-400" />
                        <a
                          href={info.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#21398A] hover:underline"
                        >
                          {info.website}
                        </a>
                      </p>
                    )}
                  </div>

                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">

                  <div>
                    <label className="tht-input-label">Số di động 1</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.mobile1 || ''}
                        onChange={(e) => setFormData({ ...formData, mobile1: e.target.value })}
                        className="tht-input mt-1.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        {info.mobile1}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="tht-input-label">Số di động 2</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.mobile2 || ''}
                        onChange={(e) => setFormData({ ...formData, mobile2: e.target.value })}
                        className="tht-input mt-1.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-700 bg-slate-50/50 px-3.5 py-2.5 rounded-xl border border-slate-100 mt-1.5 flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" />
                        {info.mobile2}
                      </p>
                    )}
                  </div>

                </div>
              </div>
            </div>

          </div>

        </div>
      </form>

      {/* ===================== PORTALS ===================== */}

      {/* Page Blocker Overlay during Update */}
      {submitting && (
        <Portal>
          <div className="fixed inset-0 z-[1900] bg-black/20 backdrop-blur-[2px] flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-6 flex items-center gap-4 border border-slate-100">
              <RefreshCw size={22} className="animate-spin text-[#21398A]" />
              <span className="text-slate-700 font-bold text-sm">Đang cập nhật thông tin công ty...</span>
            </div>
          </div>
        </Portal>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <Portal>
          <div className="fixed bottom-6 right-6 z-[2000] animate-fade-in">
            <div className="bg-white border border-emerald-100 rounded-2xl shadow-2xl shadow-emerald-500/10 px-5 py-4 flex items-center gap-3 min-w-[280px] max-w-sm">
              <div className="p-2 bg-emerald-50 text-emerald-500 rounded-xl shrink-0">
                <CheckCircle size={20} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-800">Thành công!</p>
                <p className="text-xs text-slate-500 mt-0.5">{successMessage}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSuccessToast(false)}
                className="text-slate-300 hover:text-slate-500 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
            {/* 2-second timing progress bar */}
            <div className="h-1 bg-emerald-500 rounded-full mt-2 animate-[shrinkBar_2s_linear_forwards]" />
          </div>
        </Portal>
      )}
    </div>
  );
}
