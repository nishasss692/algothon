interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        background: '#e5e7eb',
        borderRadius: 6,
        animation: 'pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    >
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}
