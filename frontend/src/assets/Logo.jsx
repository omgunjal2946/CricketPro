export default function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#153826" />
      <g stroke="#c8a24a" strokeWidth="2.4" strokeLinecap="round"><path d="M10 9v15M16 9v15M22 9v15" /></g>
      <g stroke="#ecf1ea" strokeWidth="2.4" strokeLinecap="round"><path d="M9.5 7.5h6M16.5 7.5h6" /></g>
    </svg>
  );
}
