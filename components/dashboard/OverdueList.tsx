'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInCalendarDays, parse } from 'date-fns';
import type { Task, Profile } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';

interface OverdueListProps {
  overdue: Task[];
  atRisk: Task[];
  projectNames: Record<string, string>;
  profiles: Record<string, Profile>;
  today: string;
}

export default function OverdueList({
  overdue,
  atRisk,
  projectNames,
  profiles,
  today,
}: OverdueListProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'overdue' | 'at_risk'>('overdue');

  const items = tab === 'overdue' ? overdue : atRisk;
  const emptyText =
    tab === 'overdue' ? 'Nothing overdue. Nice.' : 'Nothing at risk.';

  function getDueLabel(dueDateStr: string): string {
    const todayDate = parse(today, 'yyyy-MM-dd', new Date());
    const dueDate = parse(dueDateStr, 'yyyy-MM-dd', new Date());
    const diff = differenceInCalendarDays(dueDate, todayDate);

    if (diff < 0) {
      const abs = Math.abs(diff);
      return abs === 1 ? '1 day overdue' : `${abs} days overdue`;
    }
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `Due in ${diff} days`;
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          borderBottom: '1px solid #e5e7eb',
          paddingBottom: 12,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setTab('overdue')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            color: tab === 'overdue' ? '#dc2626' : '#6b7280',
            borderBottom: tab === 'overdue' ? '2px solid #dc2626' : '2px solid transparent',
          }}
        >
          Overdue ({overdue.length})
        </button>

        <button
          type="button"
          onClick={() => setTab('at_risk')}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            color: tab === 'at_risk' ? '#d97706' : '#6b7280',
            borderBottom: tab === 'at_risk' ? '2px solid #d97706' : '2px solid transparent',
          }}
        >
          At risk ({atRisk.length})
        </button>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: '#9ca3af',
            textAlign: 'center',
            padding: '24px 0',
          }}
        >
          {emptyText}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((task) => {
            const assignee = task.assignee_id ? profiles[task.assignee_id] : null;
            const projectName = projectNames[task.project_id] ?? 'Project';
            const dueLabel = task.due_date ? getDueLabel(task.due_date) : '';

            return (
              <div
                key={task.id}
                onClick={() =>
                  router.push(`/projects/${task.project_id}?task=${task.id}`)
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
              >
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: '#111827',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {task.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#f3f4f6',
                      color: '#4b5563',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {projectName}
                  </span>
                </div>

                {assignee ? (
                  <Avatar name={assignee.name} color={assignee.color} size={24} />
                ) : (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Unassigned</span>
                )}

                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: tab === 'overdue' ? '#dc2626' : '#d97706',
                    minWidth: 100,
                    textAlign: 'right',
                  }}
                >
                  {dueLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
