'use client';

import Avatar from '@/components/ui/Avatar';

interface WorkloadItem {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface WorkloadBarsProps {
  workload: WorkloadItem[];
}

export default function WorkloadBars({ workload }: WorkloadBarsProps) {
  if (workload.length === 0) {
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
        <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>
          Workload
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          No open tasks
        </p>
      </div>
    );
  }

  const maxCount = Math.max(...workload.map((w) => w.count), 1);

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
      <h3 style={{ margin: '0 0 16px 0', fontSize: 15, fontWeight: 600, color: '#111827' }}>
        Workload by Member
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {workload.map((item) => {
          const rawPct = (item.count / maxCount) * 100;
          const widthPct = Math.max(rawPct, 4);

          return (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 100px 1fr auto',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Avatar name={item.name} color={item.color} size={24} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#374151',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={item.name}
              >
                {item.name}
              </span>
              <div
                style={{
                  background: '#f3f4f6',
                  borderRadius: 999,
                  height: 10,
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    background: item.color,
                    height: '100%',
                    width: `${widthPct}%`,
                    borderRadius: 999,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#4b5563',
                  minWidth: 20,
                  textAlign: 'right',
                }}
              >
                {item.count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
