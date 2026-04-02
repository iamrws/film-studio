interface EmptyStateProps {
  icon?: string;
  heading: string;
  subtext?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon, heading, subtext, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && (
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 16 }} aria-hidden="true">
          {icon}
        </div>
      )}
      <h3>{heading}</h3>
      {subtext && <p>{subtext}</p>}
      {children}
    </div>
  );
}
