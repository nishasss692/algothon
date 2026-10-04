'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import AuthGuard from '@/components/AuthGuard';
import { useDashboardData } from '@/lib/useDashboardData';
import {
  openTasks,
  overdueTasks,
  atRiskTasks,
  completionPercent,
  workloadByMember,
  progressByProject,
} from '@/lib/dashboardStats';
import StatCard from '@/components/dashboard/StatCard';
import WorkloadBars from '@/components/dashboard/WorkloadBars';
import ProjectProgress from '@/components/dashboard/ProjectProgress';
import OverdueList from '@/components/dashboard/OverdueList';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const { tasks, projects, profiles, conn, loading, error, reload } =
    useDashboardData();

  useEffect(() => {
    document.title = 'Dashboard';
  }, []);

  const today = format(new Date(), 'yyyy-MM-dd');

  const open = openTasks(tasks);
  const overdue = overdueTasks(tasks, today);
  const atRisk = atRiskTasks(tasks, today);
  const compPct = completionPercent(tasks);
  const workload = workloadByMember(tasks, profiles);
  const projProgress = progressByProject(tasks, projects);

  const projectNames: Record<string, string> = {};
  for (const p of projects) {
    projectNames[p.id] = p.name;
  }

  const isLive = conn === 'live';

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        padding: '24px 20px 48px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
          Dashboard
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 500,
            color: isLive ? '#065f46' : '#92400e',
            background: isLive ? '#d1fae5' : '#fef3c7',
            padding: '4px 10px',
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isLive ? '#10b981' : '#f59e0b',
            }}
          />
          <span>{isLive ? 'Live' : 'Reconnecting'}</span>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            <Skeleton style={{ height: 84 }} />
            <Skeleton style={{ height: 84 }} />
            <Skeleton style={{ height: 84 }} />
            <Skeleton style={{ height: 84 }} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 16,
            }}
          >
            <Skeleton style={{ height: 220 }} />
            <Skeleton style={{ height: 220 }} />
          </div>
          <Skeleton style={{ height: 260 }} />
        </div>
      ) : error ? (
        /* Error state */
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fee2e2',
            padding: 24,
            borderRadius: 12,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <p style={{ margin: 0, color: '#b91c1c', fontSize: 14 }}>{error}</p>
          <button
            type="button"
            onClick={reload}
            style={{
              padding: '6px 16px',
              background: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <EmptyState
          title="No projects yet"
          action={
            <Link
              href="/projects"
              style={{
                display: 'inline-block',
                marginTop: 8,
                padding: '8px 16px',
                background: '#6366f1',
                color: '#ffffff',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Go to Projects
            </Link>
          }
        />
      ) : (
        /* Content Grid */
        <>
          {/* Stat Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <StatCard label="Overdue" value={overdue.length} accentColor="#dc2626" />
            <StatCard label="At risk" value={atRisk.length} accentColor="#d97706" />
            <StatCard label="Open tasks" value={open.length} />
            <StatCard label="Completion" value={`${compPct}%`} />
          </div>

          {/* Two-column Workload + Project Progress */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: 16,
            }}
          >
            <WorkloadBars workload={workload} />
            <ProjectProgress projects={projProgress} />
          </div>

          {/* Full width Overdue List */}
          <OverdueList
            overdue={overdue}
            atRisk={atRisk}
            projectNames={projectNames}
            profiles={profiles}
            today={today}
          />
        </>
      )}
    </div>
  );
}
