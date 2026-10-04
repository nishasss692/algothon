'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { TaskStatus } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { moveTask } from '@/lib/mutations';
import { between } from '@/lib/utils';
import { Column } from './Column';
import { TaskCard } from './TaskCard';

export type BoardFilter = 'all' | 'mine' | 'conflicts';

interface BoardProps {
  projectId: string;
  selectedTaskId?: string | null;
  searchQuery?: string;
  currentUserId?: string;
  activeFilter?: BoardFilter;
  onFilterChange?: (filter: BoardFilter) => void;
  onSelectTask?: (taskId: string) => void;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'Backlog / To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

export function Board({
  projectId,
  selectedTaskId,
  searchQuery = '',
  currentUserId,
  activeFilter = 'all',
  onFilterChange,
  onSelectTask,
}: BoardProps) {
  const tasks = useProjectStore((s) => s.tasks);
  const conn = useProjectStore((s) => s.conn);
  const conflicts = useProjectStore((s) => s.conflicts);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [internalFilter, setInternalFilter] = useState<BoardFilter>('all');

  const currentFilter = onFilterChange ? activeFilter : internalFilter;
  const setFilter = onFilterChange || setInternalFilter;

  // Configure PointerSensor with 6px constraint to prevent accidental drags on clicks
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeTask = activeTaskId ? tasks[activeTaskId] : null;

  function handleDragStart(event: DragStartEvent) {
    if (conn !== 'live') return;
    setActiveTaskId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTaskId(null);

    if (!over || conn !== 'live') return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const currentTask = tasks[activeId];
    if (!currentTask) return;

    let targetStatus: TaskStatus;
    let targetPosition: number;

    const isOverColumn = COLUMNS.some((c) => c.id === overId);

    if (isOverColumn) {
      targetStatus = overId as TaskStatus;
      const colTasks = Object.values(tasks)
        .filter((t) => t.status === targetStatus && t.id !== activeId && !t.archived)
        .sort((a, b) => a.position - b.position);

      if (colTasks.length === 0) {
        targetPosition = between(undefined, undefined);
      } else {
        const lastTask = colTasks[colTasks.length - 1];
        targetPosition = between(lastTask.position, undefined);
      }
    } else {
      const overTask = tasks[overId];
      if (!overTask) return;

      targetStatus = overTask.status;
      const colTasks = Object.values(tasks)
        .filter((t) => t.status === targetStatus && t.id !== activeId && !t.archived)
        .sort((a, b) => a.position - b.position);

      const overIndex = colTasks.findIndex((t) => t.id === overId);

      if (overIndex === -1) {
        targetPosition = between(undefined, undefined);
      } else {
        const prevTask = colTasks[overIndex - 1];
        const nextTask = colTasks[overIndex];
        targetPosition = between(prevTask?.position, nextTask?.position);
      }
    }

    if (
      currentTask.status !== targetStatus ||
      Math.abs(currentTask.position - targetPosition) > 0.001
    ) {
      moveTask({
        taskId: activeId,
        projectId,
        destinationStatus: targetStatus,
        newPosition: targetPosition,
      });
    }
  }

  const query = searchQuery.trim().toLowerCase();
  const allTasksList = Object.values(tasks).filter((t) => !t.archived);
  const myTasksCount = allTasksList.filter((t) => t.assignee_id === currentUserId).length;
  const conflictCount = Object.keys(conflicts).length;

  return (
    <div className="flex flex-col h-full">
      {/* Board Controls / Filter Pills Bar */}
      <div className="mb-4 flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2 bg-slate-200/60 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition ${
              currentFilter === 'all'
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>All Tasks</span>
            <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-700 font-semibold">
              {allTasksList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('mine')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition ${
              currentFilter === 'mine'
                ? 'bg-white text-blue-700 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span>Assigned to Me</span>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700 font-semibold">
              {myTasksCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('conflicts')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-xl transition ${
              currentFilter === 'conflicts'
                ? 'bg-white text-rose-700 shadow-sm font-semibold ring-1 ring-rose-200'
                : conflictCount > 0
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {conflictCount > 0 && <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />}
              Has Conflicts
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                conflictCount > 0
                  ? 'bg-rose-100 text-rose-700 border border-rose-300'
                  : 'bg-slate-100 border border-slate-200 text-slate-700'
              }`}
            >
              {conflictCount}
            </span>
          </button>
        </div>
      </div>

      {/* Kanban Columns Grid with Curved Rectangles */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 min-h-0 overflow-x-auto pb-2">
          {COLUMNS.map((col) => {
            const colTasks = Object.values(tasks)
              .filter((t) => {
                if (t.status !== col.id || t.archived) return false;

                // Filter by view tab
                if (currentFilter === 'mine' && t.assignee_id !== currentUserId) {
                  return false;
                }
                if (currentFilter === 'conflicts' && !conflicts[t.id]) {
                  return false;
                }

                // Filter by search query
                if (!query) return true;
                return (
                  t.title.toLowerCase().includes(query) ||
                  t.description.toLowerCase().includes(query) ||
                  t.id.toLowerCase().includes(query)
                );
              })
              .sort((a, b) => a.position - b.position);

            return (
              <Column
                key={col.id}
                status={col.id}
                title={col.title}
                tasks={colTasks}
                projectId={projectId}
                selectedTaskId={selectedTaskId}
                currentUserId={currentUserId}
                onSelectTask={onSelectTask}
              />
            );
          })}
        </div>

        {/* Drag Overlay for smooth card movement */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-72 shadow-xl">
              <TaskCard task={activeTask} isOverlay />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
