import { initials } from '../utils/format.js';

export function StatusBadge({ status }) {
  return <span className={`badge badge-${String(status).toLowerCase().replace(/\s+/g, '-')}`}>{status === 'Live' && <i className="live-dot" />}{status}</span>;
}

export const RoleBadge = ({ role }) => <span className="badge badge-role">{role}</span>;

export function Avatar({ name, src, size = 38 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  return src
    ? <img className="avatar" style={style} src={src} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    : <span className="avatar avatar-text" style={style} aria-hidden="true">{initials(name)}</span>;
}
