import Link from "next/link";

type StatusPanelProps = {
  icon?: string;
  title?: string;
  message: string;
  actionHref?: string;
  actionLabel?: string;
  maxWidth?: number;
};

export function StatusPanel({
  icon,
  title,
  message,
  actionHref,
  actionLabel,
  maxWidth = 420,
}: StatusPanelProps) {
  return (
    <div className="container status-panel-container">
      <div className="card status-panel-card" style={{ maxWidth }}>
        {icon && <div className="status-panel-icon">{icon}</div>}
        {title && <h2 className="font-display status-panel-title">{title}</h2>}
        <p className="status-panel-message">{message}</p>
        {actionHref && actionLabel && (
          <Link href={actionHref} className="btn btn-primary">{actionLabel}</Link>
        )}
      </div>
    </div>
  );
}

export function LoadingPanel({ message = "Loading..." }: { message?: string }) {
  return <div className="container status-loading-panel">{message}</div>;
}
