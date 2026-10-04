import Link from 'next/link';

interface ProjectProgressItem {
  id: string;
  name: string;
  done: number;
  total: number;
  percent: number;
}

interface ProjectProgressProps {
  projects: ProjectProgressItem[];
}

export default function ProjectProgress({ projects }: ProjectProgressProps) {
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
        Project Progress
      </h3>
      {projects.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '24px 0' }}>
          No projects yet
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '140px 1fr auto',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                padding: '6px 8px',
                borderRadius: 8,
                transition: 'background 150ms ease',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={p.name}
              >
                {p.name}
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
                    background: '#10b981',
                    height: '100%',
                    width: `${p.percent}%`,
                    borderRadius: 999,
                    transition: 'width 200ms ease',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  minWidth: 80,
                  textAlign: 'right',
                }}
              >
                {p.total === 0 ? 'No tasks yet' : `${p.done}/${p.total} (${p.percent}%)`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
