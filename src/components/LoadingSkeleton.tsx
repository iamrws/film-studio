interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  lines?: number;
}

export function LoadingSkeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  lines = 1,
}: LoadingSkeletonProps) {
  const barStyle: React.CSSProperties = {
    background: 'var(--bg-tertiary)',
    borderRadius,
    animation: 'skeleton-pulse 1.5s ease-in-out infinite',
  };

  if (lines > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            style={{
              ...barStyle,
              width: i === lines - 1 ? '60%' : width,
              height,
            }}
          />
        ))}
      </div>
    );
  }

  return <div style={{ width, height, ...barStyle }} />;
}
