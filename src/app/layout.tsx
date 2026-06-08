import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import LayoutClientWrapper from './layout-client-wrapper';
import Script from 'next/script';
import AppAlertProvider from '@/components/AppAlertProvider';

const montserrat = Montserrat({
  subsets: ['latin', 'vietnamese'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'THT Center - Hệ thống quản lý trung tâm',
  description: 'Hệ thống quản lý học viên, lớp học, công nợ và doanh thu THT Center',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'THT Center',
  },
  icons: {
    icon: 'https://tht.edu.vn/wp-content/uploads/2023/05/THT-Logo.png',
    apple: '/logo-tht-2.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${montserrat.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#fafbfe] font-sans text-slate-800 antialiased">
        <AppAlertProvider>
          <AuthProvider>
            <LayoutClientWrapper>{children}</LayoutClientWrapper>
          </AuthProvider>
        </AppAlertProvider>
        <div id="google_translate_element" style={{ display: 'none' }} />
        <Script
          src="//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
          strategy="afterInteractive"
        />
        <Script id="google-translate-init" strategy="afterInteractive">
          {`
            function googleTranslateElementInit() {
              new google.translate.TranslateElement({
                pageLanguage: 'vi',
                includedLanguages: 'vi,en',
                autoDisplay: false
              }, 'google_translate_element');
            }
          `}
        </Script>
      </body>
    </html>
  );
}
