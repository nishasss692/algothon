'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/hooks/useSession';
import type { Profile } from '@/lib/types';

export default function DashboardPage() {
  const router = useRouter();
  const session = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    // If the URL has an error in the hash or search params (e.g. from an old confirmation email)
    if (typeof window !== 'undefined') {
      const hasHashError = window.location.hash.includes('error=');
      const hasSearchError = window.location.search.includes('error=');
      if (hasHashError || hasSearchError) {
        router.replace(`/auth/callback${window.location.search}${window.location.hash}`);
        return;
      }
    }

    if (session === null) {
      router.replace('/login');
    }
  }, [session, router]);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setProfile(data as Profile);
          }
        });
    }
  }, [session]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace('/login');
  }

  if (session === undefined || session === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-600">Loading your workspace...</p>
        </div>
      </main>
    );
  }

  const displayName =
    profile?.name ||
    session.user.user_metadata?.name ||
    session.user.email?.split('@')[0] ||
    'Collaborator';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-4">
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Workspace
            </span>
            <nav className="flex space-x-2">
              <Link
                href="/dashboard"
                className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/projects"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Projects
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: profile?.color || '#16a34a' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">{session.user.email}</p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            You are successfully authenticated in your Collaborative Project Workspace.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Authentication Status
              </p>
              <p className="mt-2 text-lg font-bold text-green-700">Verified & Active</p>
              <p className="mt-1 text-xs text-gray-500">{session.user.email}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                User ID
              </p>
              <p className="mt-2 font-mono text-xs text-gray-700 truncate">
                {session.user.id}
              </p>
              <p className="mt-1 text-xs text-gray-500">Linked to Supabase Auth</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Next Steps
              </p>
              <Link
                href="/projects"
                className="mt-2 inline-block font-semibold text-green-700 hover:text-green-800"
              >
                Go to Projects →
              </Link>
              <p className="mt-1 text-xs text-gray-500">View boards and collaborative tasks</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
