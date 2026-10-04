'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/hooks/useSession';
import { useProjectRealtime } from '@/lib/hooks/useProjectRealtime';
import { useProjectStore } from '@/lib/store';
import type { Project, Profile } from '@/lib/types';
import { Board } from '@/components/board/Board';
import { ConnectionBadge } from '@/components/ui/ConnectionBadge';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { toast } from 'sonner';

export default function ProjectBoardPage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();

  const projectId = (params?.id as string) || '';

  const conn = useProjectStore((s) => s.conn);
  const online = useProjectStore((s) => s.online);

  const [project, setProject] = useState<Project | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // 1. Authenticate and verify membership
  useEffect(() => {
    if (session === null) {
      router.replace('/login');
      return;
    }

    if (!session || !projectId) return;

    const currentUserId = session.user.id;
    const userEmail = session.user.email;
    let isMounted = true;

    async function loadProjectAndMember() {
      setLoading(true);
      setAccessError(null);

      try {
        // Fetch project
        const { data: projData, error: projError } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .maybeSingle();

        if (projError || !projData) {
          if (isMounted) {
            setAccessError('Project not found or you do not have permission to view it.');
            setLoading(false);
          }
          return;
        }

        // Verify membership
        const { data: memberData } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!memberData && projData.created_by !== currentUserId) {
          if (isMounted) {
            setAccessError('You are not a member of this project.');
            setLoading(false);
          }
          return;
        }

        // Fetch user profile
        const { data: profData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUserId)
          .maybeSingle();

        if (isMounted) {
          setProject(projData as Project);
          if (profData) {
            setProfile(profData as Profile);
          } else {
            setProfile({
              id: currentUserId,
              name: userEmail?.split('@')[0] || 'User',
              color: '#16a34a',
            });
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Error loading project.';
          setAccessError(msg);
          setLoading(false);
        }
      }
    }

    loadProjectAndMember();

    return () => {
      isMounted = false;
    };
  }, [session, projectId, router]);

  // 2. Initialize real-time channel & presence tracking
  const currentUser = useMemo(() => {
    if (profile) {
      return { id: profile.id, name: profile.name, color: profile.color };
    }
    if (session?.user) {
      return {
        id: session.user.id,
        name: session.user.email?.split('@')[0] || 'User',
        color: '#16a34a',
      };
    }
    return null;
  }, [profile, session]);

  useProjectRealtime({
    projectId: project ? projectId : '',
    currentUser,
    currentTaskId: selectedTaskId,
  });

  function handleCopyJoinCode() {
    if (!project?.join_code) return;
    navigator.clipboard.writeText(project.join_code);
    setCopiedCode(true);
    toast.success('Join code copied to clipboard!');
    setTimeout(() => setCopiedCode(false), 2000);
  }

  // Loading state
  if (session === undefined || loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-600">Loading project board...</p>
        </div>
      </main>
    );
  }

  // Error / Access Denied state
  if (accessError || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Access Restricted</h1>
          <p className="mt-2 text-sm text-gray-600">{accessError || 'Unable to open project.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 transition"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Offline Banner when disconnected */}
      <OfflineBanner status={conn} />

      {/* Board Header Bar */}
      <header className="border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Left: Project title & join code */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/dashboard"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              title="Back to Dashboard"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>

            <h1 className="text-lg font-bold text-gray-900 truncate">
              {project.name}
            </h1>

            {/* Join Code button */}
            <button
              onClick={handleCopyJoinCode}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-mono font-medium text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition"
              title="Click to copy join code"
            >
              <span>Code: {project.join_code}</span>
              {copiedCode ? (
                <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* Right: Online Collaborators, Connection Status & Dashboard link */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Presence Avatars */}
            {online.length > 0 && (
              <div className="flex items-center -space-x-1.5" title={`${online.length} collaborator(s) online`}>
                {online.slice(0, 5).map((user) => (
                  <span
                    key={user.user_id}
                    className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white shadow-xs"
                    style={{ backgroundColor: user.color || '#6366f1' }}
                    title={user.name}
                  >
                    {user.name.charAt(0).toUpperCase()}
                    <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                  </span>
                ))}
                {online.length > 5 && (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-700 ring-2 ring-white">
                    +{online.length - 5}
                  </span>
                )}
              </div>
            )}

            {/* Live / Reconnecting Badge */}
            <ConnectionBadge status={conn} />

            <Link
              href="/dashboard"
              className="text-xs font-medium text-gray-600 hover:text-gray-900 transition ml-1"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Main Board View */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <Board
          projectId={projectId}
          currentUserId={session.user.id}
          onSelectTask={setSelectedTaskId}
        />
      </main>
    </div>
  );
}
