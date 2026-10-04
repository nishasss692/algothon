'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMe } from '@/lib/useMe';
import Avatar from '@/components/ui/Avatar';

export default function Header() {
  const router = useRouter();
  const { me } = useMe();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', height: 56, background: '#fff', borderBottom: '1px solid #e5e7eb', gap: 24 }}>
      <Link href="/projects" style={{ fontWeight: 700, fontSize: 18, color: '#6366f1', textDecoration: 'none' }}>
        Algothon
      </Link>
      <nav style={{ display: 'flex', gap: 16, flex: 1 }}>
        <Link href="/projects" style={navLink}>Projects</Link>
        <Link href="/dashboard" style={navLink}>Dashboard</Link>
      </nav>
      {me && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar name={me.name} color={me.color} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{me.name}</span>
        </div>
      )}
      <button
        onClick={handleSignOut}
        style={{ padding: '6px 14px', background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}
      >
        Sign out
      </button>
    </header>
  );
}

const navLink: React.CSSProperties = { fontSize: 14, color: '#374151', textDecoration: 'none' };
