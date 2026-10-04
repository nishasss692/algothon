interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center', gap: 8 }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: 16, color: '#374151' }}>{title}</p>
      {description && <p style={{ margin: 0, fontSize: 14, color: '#9ca3af' }}>{description}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
