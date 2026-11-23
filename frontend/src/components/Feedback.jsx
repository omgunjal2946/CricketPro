import { Loader2, Inbox, AlertTriangle } from 'lucide-react';

export const Spinner = ({ size = 18 }) => <Loader2 className="spin" size={size} aria-label="Loading" />;

export const PageLoader = ({ label = 'Loading' }) => (
  <div className="page-loader"><Spinner size={26} /><span>{label}...</span></div>
);

export function EmptyState({ icon: Icon = Inbox, title, text, action }) {
  return (
    <div className="empty">
      <Icon size={34} strokeWidth={1.5} />
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty empty-error" role="alert">
      <AlertTriangle size={34} strokeWidth={1.5} />
      <h3>Could not load this page</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-ghost" onClick={() => onRetry()}>Try again</button>}
    </div>
  );
}
