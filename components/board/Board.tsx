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

interface BoardProps {
  projectId: string;
  currentUserId?: string;
  onSelectTask?: (taskId: string) => void;
}

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
];

export function Board({
  projectId,
  currentUserId,
  onSelectTask,
}: BoardProps) {
  const tasks = useProjectStore((s) => s.tasks);
  const conn = useProjectStore((s) => s.conn);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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
      // 1. Dropped directly over a column container or empty column
      targetStatus = overId as TaskStatus;
      const colTasks = Object.values(tasks)
        .filter((t) => t.status === targetStatus && t.id !== activeId && !t.archived)
        .sort((a, b) => a.position - b.position);

      if (colTasks.length === 0) {
        targetPosition = between(undefined, undefined); // 1000
      } else {
        const lastTask = colTasks[colTasks.length - 1];
        targetPosition = between(lastTask.position, undefined); // lastTask.position + 1000
      }
    } else {
      // 2. Dropped over another task card
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

    // Persist move if status or position shifted
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-140px)] min-h-[500px]">
        {COLUMNS.map((col) => {
          const colTasks = Object.values(tasks)
            .filter((t) => t.status === col.id && !t.archived)
            .sort((a, b) => a.position - b.position);

          return (
            <Column
              key={col.id}
              status={col.id}
              title={col.title}
              tasks={colTasks}
              projectId={projectId}
              currentUserId={currentUserId}
              onSelectTask={onSelectTask}
            />
          );
        })}
      </div>

      {/* Drag Overlay for smooth card movement representation */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72">
            <TaskCard task={activeTask} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
