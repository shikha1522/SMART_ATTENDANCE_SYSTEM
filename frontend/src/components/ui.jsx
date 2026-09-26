const PATHS = {
  check: 'M20 6 9 17l-5-5',
  plus: 'M12 5v14M5 12h14',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
  play: 'M6 4l14 8-14 8z',
  stop: 'M6 6h12v12H6z',
  back: 'M15 18l-6-6 6-6',
  forward: 'M9 18l6-6-6-6',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  building: 'M3 21h18M5 21V5l7-2 7 2v16M9 9h1M9 13h1M14 9h1M14 13h1',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  search: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14',
  x: 'M18 6 6 18M6 6l12 12',
  chevron: 'M9 18l6-6-6-6',
};

export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Logo({ size = 34 }) {
  return (
    <span className="logo" style={{ width: size, height: size }}>
      <Icon name="check" size={size * 0.55} />
    </span>
  );
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

const ACCENTS = ['#4f46e5', '#0891b2', '#16a34a', '#d97706', '#db2777', '#7c3aed', '#0d9488', '#e11d48'];
export const colorFor = (s = '') => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
};

export function Avatar({ name, size = 40 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: colorFor(name), fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export const pctTone = (p) => (p === null || p === undefined ? 'muted' : p >= 75 ? 'green' : p >= 60 ? 'amber' : 'red');

export function Ring({ value, size = 128, stroke = 12 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value ?? 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`ring ${pctTone(value)}`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="ring-text">
        {value === null || value === undefined ? '—' : `${value}%`}
      </text>
    </svg>
  );
}

export function Bar({ value, tone = 'primary' }) {
  return (
    <div className={`bar ${tone}`}><i style={{ width: `${Math.min(100, Math.max(0, value || 0))}%` }} /></div>
  );
}

export const Spinner = () => <div className="center"><span className="spinner" /></div>;

export function Empty({ icon = 'book', title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}
