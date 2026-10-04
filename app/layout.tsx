import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';
import LayoutShell from '@/components/LayoutShell';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Algothon',
  description: 'Collaborative project workspace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <LayoutShell>{children}</LayoutShell>
        <Toaster richColors />
      </body>
    </html>
  );
}
