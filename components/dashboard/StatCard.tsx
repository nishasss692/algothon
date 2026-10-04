interface StatCardProps {
  label: string;
  value: number | string;
  accentColor?: string;
}

export default function StatCard({ label, value, accentColor }: StatCardProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: accentColor ?? '#111827',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
