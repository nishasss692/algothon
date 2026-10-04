'use client';

import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import Header from '@/components/Header';
import AuthGuard from '@/components/AuthGuard';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const isPublic = pathname === '/login' || pathname.startsWith('/dev');
  const showHeader = session && pathname !== '/login';

  return (
    <>
      {showHeader && <Header />}
      <main style={{ flex: 1 }}>
        {isPublic ? children : <AuthGuard>{children}</AuthGuard>}
      </main>
    </>
  );
}
