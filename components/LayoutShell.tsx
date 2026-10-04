'use client';

import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/useSession';
import Header from '@/components/Header';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session } = useSession();
  const showHeader = session && pathname !== '/login';

  return (
    <>
      {showHeader && <Header />}
      <main style={{ flex: 1 }}>{children}</main>
    </>
  );
}
