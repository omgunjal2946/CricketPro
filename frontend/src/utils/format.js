export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-');
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
export const fmtNum = (n, digits = 2) => (n === null || n === undefined ? '-' : Number(n).toFixed(digits));
export const fmtMatchWhen = (m) => `${fmtDate(m.matchDate)}${m.matchTime ? `, ${m.matchTime}` : ''}`;
export const resultText = (m) => {
  const r = m.result;
  if (!r || !r.type) return '';
  if (r.type === 'Win') return `${r.winner?.name || 'Winner'} won ${r.margin}`;
  if (r.type === 'Tie') return 'Match tied';
  if (r.type === 'Draw') return 'Match drawn';
  return r.margin || 'No result';
};
export const defaultOvers = (m) => (m.matchType === 'Test' ? null : m.maxOvers || (m.matchType === 'ODI' ? 50 : 20));
