'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/hooks/useSession';
import { useProjectRealtime } from '@/lib/hooks/useProjectRealtime';
import { useProjectStore } from '@/lib/store';
import type { Project, Profile, Task, Activity } from '@/lib/types';
import { Board, type BoardFilter } from '@/components/board/Board';
import { TaskDrawer } from '@/components/task/TaskDrawer';
import { ConnectionBadge } from '@/components/ui/ConnectionBadge';
import { OfflineBanner } from '@/components/ui/OfflineBanner';
import { createTask } from '@/lib/mutations';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

type NavView = 'board' | 'activity' | 'metrics' | 'repo' | 'team';

export default function ProjectBoardPage() {
  const params = useParams();
  const router = useRouter();
  const session = useSession();

  const projectId = (params?.id as string) || '';

  const conn = useProjectStore((s) => s.conn);
  const online = useProjectStore((s) => s.online);
  const tasks = useProjectStore((s) => s.tasks);
  const activityList = useProjectStore((s) => s.activity);
  const profiles = useProjectStore((s) => s.profiles);
  const conflicts = useProjectStore((s) => s.conflicts);

  const [project, setProject] = useState<Project | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [boardFilter, setBoardFilter] = useState<BoardFilter>('all');
  const [navView, setNavView] = useState<NavView>('board');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<'todo' | 'in_progress' | 'review' | 'done'>('todo');
  const [creatingTask, setCreatingTask] = useState(false);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
            setAccessError('Project record not found or access privilege denied.');
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
            setAccessError('Access forbidden: User is not an active member of this project.');
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
          try {
            localStorage.setItem('last_active_project_id', projData.id);
          } catch {
            // Ignore storage restrictions
          }
          if (profData) {
            setProfile(profData as Profile);
          } else {
            setProfile({
              id: currentUserId,
              name: userEmail?.split('@')[0] || 'Operator',
              color: '#3b82f6',
            });
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'System fault during project handshake.';
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
        name: session.user.email?.split('@')[0] || 'Operator',
        color: '#3b82f6',
      };
    }
    return null;
  }, [profile, session]);

  useProjectRealtime({
    projectId: project ? projectId : '',
    currentUser,
    currentTaskId: selectedTaskId,
  });

  // Calculate real-time status metrics
  const metrics = useMemo(() => {
    const taskList = Object.values(tasks).filter((t) => !t.archived);
    const total = taskList.length;
    const todo = taskList.filter((t) => t.status === 'todo').length;
    const inProgress = taskList.filter((t) => t.status === 'in_progress').length;
    const review = taskList.filter((t) => t.status === 'review').length;
    const done = taskList.filter((t) => t.status === 'done').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, todo, inProgress, review, done, percent };
  }, [tasks]);

  const conflictCount = Object.keys(conflicts).length;

  function handleCopyJoinCode() {
    if (!project?.join_code) return;
    navigator.clipboard.writeText(project.join_code);
    setCopiedCode(true);
    toast.success('Project Join Code copied to clipboard');
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleShareWorkspace() {
    if (!project) return;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
    const shareText = `Collaborate with me on ${project.name}! Join Code: ${project.join_code}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      toast.success('Workspace invite link and code copied!');
    }
  }

  async function handleSyncBranch() {
    if (conn !== 'live') {
      toast.error('Cannot sync branch while offline or reconnecting.');
      return;
    }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .eq('archived', false)
        .order('position', { ascending: true });

      if (!error && data) {
        useProjectStore.getState().setTasks(data as Task[]);
      }

      const { data: acts } = await supabase
        .from('activity')
        .select('*')
        .eq('project_id', projectId)
        .order('id', { ascending: true });

      if (acts) {
        useProjectStore.getState().appendActivity(acts as Activity[]);
      }

      toast.success("Branch 'main' synchronized with remote origin.");
    } catch {
      toast.error('Branch sync failed.');
    } finally {
      setTimeout(() => setIsSyncing(false), 600);
    }
  }

  async function handleCreateNewTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskTitle.trim() || creatingTask) return;

    setCreatingTask(true);
    const result = await createTask({
      projectId,
      title: newTaskTitle.trim(),
      status: newTaskStatus,
    });
    setCreatingTask(false);

    if (result.success && result.task) {
      toast.success('Task created successfully.');
      setNewTaskTitle('');
      setShowNewTaskModal(false);
      setSelectedTaskId(result.task.id);
    }
  }

  // Loading state
  if (session === undefined || loading || !session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center gap-3 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="h-7 w-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Initializing workspace runtime...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (accessError || !project) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-6 shadow-xl">
          <div className="flex items-center gap-2 text-rose-600 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>[!] ACCESS_RESTRICTION_ERROR</span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-6 font-sans">
            {accessError || 'Unable to open workspace. Permission verification failed.'}
          </p>
          <div className="flex justify-end">
            <Link
              href="/dashboard"
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition"
            >
              ← Return to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans">
      {/* 1. Left Sidebar (Properly sized and adjusted, no squishing) */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white z-20 shadow-xs">
        {/* Project Name & Workspace Switcher */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2.5 text-slate-900 hover:text-blue-600 transition group min-w-0"
              title="Return to Projects Dashboard"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm shadow-2xs group-hover:scale-105 transition">
                {project.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-sm tracking-tight truncate">
                {project.name}
              </span>
            </Link>

            <Link
              href="/dashboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title="Switch Workspace"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
              </svg>
            </Link>
          </div>

          {/* Current Branch & Environment Label */}
          <div className="mt-3 flex items-center justify-between gap-1.5 pt-2.5 border-t border-slate-200/80 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 truncate">
              <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
              </svg>
              <span className="font-semibold text-slate-800">main</span>
              <span className="text-slate-400 font-normal">[prod]</span>
            </div>

            <span className="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Clean
            </span>
          </div>

          {/* Sync Branch Button (Curved Rectangle) */}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={handleSyncBranch}
              disabled={isSyncing || conn !== 'live'}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs disabled:opacity-50"
              title="Sync current branch with remote origin"
            >
              <svg
                className={`w-3.5 h-3.5 text-slate-500 ${isSyncing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isSyncing ? 'Syncing...' : 'Sync Branch'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-3 space-y-1 text-sm overflow-y-auto">
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Workspace
          </div>

          {/* Board Tab */}
          <button
            type="button"
            onClick={() => setNavView('board')}
            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 font-medium transition ${
              navView === 'board'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              <span>Board</span>
            </div>
            <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 font-semibold">
              {metrics.total}
            </span>
          </button>

          {/* Activity / Diff Stream Tab */}
          <button
            type="button"
            onClick={() => setNavView('activity')}
            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 font-medium transition ${
              navView === 'activity'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Activity Stream</span>
            </div>
            {activityList.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                {activityList.length}
              </span>
            )}
          </button>

          {/* Metrics Tab */}
          <button
            type="button"
            onClick={() => setNavView('metrics')}
            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 font-medium transition ${
              navView === 'metrics'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Metrics</span>
            </div>
            <span className="text-xs text-emerald-700 font-semibold">
              {metrics.percent}%
            </span>
          </button>

          {/* Repository Tab */}
          <button
            type="button"
            onClick={() => setNavView('repo')}
            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 font-medium transition ${
              navView === 'repo'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Repository</span>
            </div>
            <span className="text-xs text-slate-400">git</span>
          </button>

          {/* Team Settings Tab */}
          <button
            type="button"
            onClick={() => setNavView('team')}
            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 font-medium transition ${
              navView === 'team'
                ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span>Team & Members</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {Object.keys(profiles).length || 1}
            </span>
          </button>
        </nav>

        {/* Sidebar Collaboration & System Status Card (Curved Rectangle, fully visible) */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2.5 shrink-0">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Status</span>
              <ConnectionBadge status={conn} />
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-500">Active Peers</span>
              <span className="font-semibold text-slate-800">
                {online.length} online
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <span className="font-medium text-slate-500">Join Code</span>
              <button
                type="button"
                onClick={handleCopyJoinCode}
                className="font-bold text-blue-600 hover:text-blue-800 transition"
                title="Copy Join Code"
              >
                {copiedCode ? 'COPIED!' : project.join_code}
              </button>
            </div>
          </div>

          {/* Documentation and logs links */}
          <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
            <button
              type="button"
              onClick={() => setShowDocsModal(true)}
              className="flex items-center gap-1.5 hover:text-blue-600 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Docs</span>
            </button>

            <button
              type="button"
              onClick={() => setNavView('activity')}
              className="flex items-center gap-1.5 hover:text-blue-600 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
              <span>Audit Logs</span>
            </button>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Offline Banner when disconnected */}
        <OfflineBanner status={conn} />

        {/* Top Command Toolbar (Curved and spacious) */}
        <header className="border-b border-slate-200 bg-white px-5 py-2.5 z-10 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Left: Sprint / Workspace Progress (v1.2.0-dev REMOVED as requested) */}
            <div className="flex items-center gap-3.5 min-w-0">
              <Link
                href="/dashboard"
                className="lg:hidden rounded-xl border border-slate-200 p-1.5 text-slate-500 hover:text-slate-900"
                title="Back to Dashboard"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>

              {/* Sprint Progress Pill */}
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-slate-800">
                  Sprint 1
                </span>
                <div className="w-20 h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${metrics.percent}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-emerald-700">
                  {metrics.percent}%
                </span>
              </div>
            </div>

            {/* Center: Search tasks with Ctrl+K shortcut hint */}
            <div className="flex-1 max-w-md min-w-[200px]">
              <div className="relative flex items-center">
                <svg
                  className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, IDs, tags..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-14 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition"
                />
                <kbd className="pointer-events-none absolute right-2.5 text-xs font-medium text-slate-400 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 shadow-2xs">
                  Ctrl+K
                </kbd>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-12 text-sm text-slate-400 hover:text-slate-700"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>

            {/* Right: Peers, Resolve Conflicts, Share, New Task, Avatar */}
            <div className="flex items-center gap-2.5 shrink-0">
              {/* Connected peer count & avatars */}
              <div
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1"
                title={`${online.length} collaborator(s) online: ${online.map((u) => u.name).join(', ')}`}
              >
                <div className="flex items-center -space-x-1.5">
                  {online.slice(0, 4).map((user) => (
                    <span
                      key={user.user_id}
                      className="relative inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-2xs"
                      style={{ backgroundColor: user.color || '#3b82f6' }}
                      title={user.name}
                    >
                      {user.name.charAt(0).toUpperCase()}
                      <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-white" />
                    </span>
                  ))}
                </div>
                <span className="text-xs text-slate-700 font-semibold">
                  {online.length} peer{online.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Notifications / Activity bell */}
              <button
                type="button"
                onClick={() => setNavView(navView === 'activity' ? 'board' : 'activity')}
                className="relative rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 transition shadow-2xs"
                title="Activity stream & notifications"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {activityList.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-600 text-[9px] font-bold text-white flex items-center justify-center">
                    {activityList.length > 99 ? '99+' : activityList.length}
                  </span>
                )}
              </button>

              {/* Resolve Conflicts button */}
              <button
                type="button"
                onClick={() => {
                  const conflictKeys = Object.keys(conflicts);
                  if (conflictKeys.length > 0) {
                    setSelectedTaskId(conflictKeys[0]);
                  } else {
                    toast.info('No unresolved conflicts present.');
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold transition shadow-2xs border ${
                  conflictCount > 0
                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 animate-pulse'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
                title={
                  conflictCount > 0
                    ? `${conflictCount} concurrent version conflict(s) need resolution`
                    : 'No conflicts detected'
                }
              >
                {conflictCount > 0 ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    <span>Resolve Conflicts ({conflictCount})</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>0 Conflicts</span>
                  </>
                )}
              </button>

              {/* Share button */}
              <button
                type="button"
                onClick={handleShareWorkspace}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
                title="Share workspace link"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span>Share</span>
              </button>

              {/* New Task Button (Primary blue action button with curved rectangle) */}
              <button
                type="button"
                onClick={() => setShowNewTaskModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs active:bg-blue-800"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Task</span>
              </button>

              {/* Current User Avatar */}
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs ring-2 ring-slate-100"
                style={{ backgroundColor: profile?.color || '#3b82f6' }}
                title={`Signed in as ${profile?.name || session.user.email}`}
              >
                {(profile?.name || session.user.email || 'U').charAt(0).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* 3. Central Workspace Area */}
        <main className="flex-1 p-5 overflow-hidden flex flex-col">
          {navView === 'board' && (
            <Board
              projectId={projectId}
              selectedTaskId={selectedTaskId}
              searchQuery={searchQuery}
              currentUserId={session.user.id}
              activeFilter={boardFilter}
              onFilterChange={setBoardFilter}
              onSelectTask={setSelectedTaskId}
            />
          )}

          {navView === 'activity' && (
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-2xs flex flex-col overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Activity Stream</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time audit log of all project and task mutations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNavView('board')}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  ← Return to Board
                </button>
              </div>

              <div className="flex-1 p-6 overflow-y-auto space-y-3">
                {activityList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic text-center py-12">
                    No activity recorded in this workspace yet.
                  </p>
                ) : (
                  activityList.slice().reverse().map((act) => {
                    const actor = act.actor_id ? profiles[act.actor_id] : null;
                    const dateStr = act.created_at
                      ? (() => {
                          try {
                            return format(parseISO(act.created_at), 'MMM dd, yyyy HH:mm:ss');
                          } catch {
                            return act.created_at;
                          }
                        })()
                      : '';

                    return (
                      <div
                        key={act.id}
                        className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-3.5 text-sm flex items-start gap-3.5 hover:border-slate-300 transition"
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white mt-0.5"
                          style={{ backgroundColor: actor?.color || '#3b82f6' }}
                        >
                          {actor?.name?.charAt(0).toUpperCase() || 'S'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">
                              {actor?.name || 'Collaborator'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{dateStr}</span>
                          </div>
                          <p className="mt-1 text-slate-700 text-xs leading-relaxed">
                            {act.type === 'task_created' && (
                              <span>Created new task: <strong>{(act.payload as any)?.title || 'Untitled'}</strong></span>
                            )}
                            {act.type === 'status_changed' && (
                              <span>
                                Changed status from <code className="bg-slate-200 px-1.5 py-0.5 rounded text-xs">{(act.payload as any)?.from}</code> to <code className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-semibold">{(act.payload as any)?.to}</code>
                              </span>
                            )}
                            {act.type === 'assignee_changed' && <span>Reassigned task to collaborator</span>}
                            {act.type === 'due_changed' && (
                              <span>Updated deadline to {(act.payload as any)?.to || 'none'}</span>
                            )}
                            {act.type === 'comment_added' && (
                              <span>Posted comment: &ldquo;{(act.payload as any)?.body}&rdquo;</span>
                            )}
                          </p>
                          {act.task_id && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTaskId(act.task_id);
                                setNavView('board');
                              }}
                              className="mt-1.5 text-xs text-blue-600 font-semibold hover:underline"
                            >
                              Inspect Task: {act.task_id.slice(0, 8)} →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {navView === 'metrics' && (
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-2xs p-6 overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Workspace Metrics & Velocity</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Sprint burndown and status distribution</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNavView('board')}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ← Return to Board
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs font-medium text-slate-500 uppercase">Total Tasks</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</div>
                </div>
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
                  <div className="text-xs font-medium text-blue-700 uppercase">In Progress</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">{metrics.inProgress}</div>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                  <div className="text-xs font-medium text-amber-700 uppercase">In Review</div>
                  <div className="text-2xl font-bold text-amber-700 mt-1">{metrics.review}</div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <div className="text-xs font-medium text-emerald-700 uppercase">Done</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{metrics.done}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-800">Sprint Completion Rate</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>Progress: {metrics.done} of {metrics.total} items completed</span>
                    <span className="font-bold text-emerald-700">{metrics.percent}%</span>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                      style={{ width: `${metrics.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {navView === 'repo' && (
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-2xs p-6 overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Git Repository Status</h2>
                  <p className="text-xs text-slate-500 mt-0.5">VCS environment and branch metadata</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNavView('board')}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ← Return to Board
                </button>
              </div>

              <div className="space-y-4 max-w-xl text-sm">
                <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50 space-y-2.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Branch:</span>
                    <span className="font-semibold text-slate-900">main</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remote:</span>
                    <span className="text-blue-600 font-medium">origin/main</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tracking:</span>
                    <span className="text-emerald-600 font-semibold">Synchronized (0 ahead, 0 behind)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">OCC Concurrency:</span>
                    <span className="text-slate-900 font-medium">Version tokens active</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSyncBranch}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
                  >
                    Sync with Origin
                  </button>
                </div>
              </div>
            </div>
          )}

          {navView === 'team' && (
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white shadow-2xs p-6 overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Team Members & Presence</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage project access and view active collaborators</p>
                </div>
                <button
                  type="button"
                  onClick={() => setNavView('board')}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  ← Return to Board
                </button>
              </div>

              <div className="max-w-xl space-y-4">
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-blue-700 uppercase font-semibold">Workspace Join Code</span>
                    <p className="text-xl font-bold text-blue-900 mt-0.5">{project.join_code}</p>
                  </div>
                  <button
                    onClick={handleCopyJoinCode}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-2xs"
                  >
                    {copiedCode ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                  {Object.values(profiles).map((p) => {
                    const isOnline = online.some((u) => u.user_id === p.id);
                    return (
                      <div key={p.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs"
                            style={{ backgroundColor: p.color || '#3b82f6' }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <span className="font-semibold text-sm text-slate-900">{p.name}</span>
                            <div className="text-xs text-slate-400">
                              ID: {p.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isOnline
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 4. Right-side Inspector Drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        projectId={projectId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Documentation & Help Modal (Curved Rectangle) */}
      {showDocsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-semibold text-base text-slate-900">Developer Workspace Guide</h3>
              <button
                onClick={() => setShowDocsModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
              <div>
                <strong className="text-slate-900">Keyboard Shortcuts:</strong>
                <p className="text-xs mt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono">
                  Ctrl+K / ⌘K: Focus search tasks<br />
                  Esc: Close inspector or modal
                </p>
              </div>
              <div>
                <strong className="text-slate-900">Optimistic Concurrency Control (OCC):</strong>
                <p className="mt-1 text-xs">
                  When multiple developers edit the same task, our version-checking engine detects conflicts and presents a side-by-side diff. Use &ldquo;Take Theirs&rdquo; or &ldquo;Keep Mine&rdquo; to resolve.
                </p>
              </div>
              <div>
                <strong className="text-slate-900">Real-Time Sync:</strong>
                <p className="mt-1 text-xs">
                  Mutations stream over Supabase WebSockets. Active collaborator presence and currently focused tasks update automatically.
                </p>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDocsModal(false)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Creation Modal (Curved Rectangle) */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateNewTask}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-semibold text-base text-slate-900">Create New Issue / Task</h3>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task summary, bug report, or feature..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Status Column
                </label>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-blue-500 outline-none"
                >
                  <option value="todo">Backlog / To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTaskTitle.trim() || creatingTask}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {creatingTask ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
