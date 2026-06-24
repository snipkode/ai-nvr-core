// Pure inline SVG icons — no font/image dependency, works offline, production-ready
const S = (d, vb = '0 0 24 24') => ({ d, vb });

const icons = {
  dashboard:  S('M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z'),
  grid:       S('M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z'),
  camera:     S('M12 15a3 3 0 100-6 3 3 0 000 6zm10-7h-3.17l-1.24-1.35A2 2 0 0016.12 6H7.88a2 2 0 00-1.47.65L5.17 8H2a2 2 0 00-2 2v9a2 2 0 002 2h20a2 2 0 002-2V10a2 2 0 00-2-2zm-10 9a5 5 0 110-10 5 5 0 010 10z'),
  video:      S('M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z'),
  menu:       S('M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z'),
  close:      S('M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
  chevLeft:   S('M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z'),
  chevRight:  S('M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z'),
  chevDown:   S('M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z'),
  chevUp:     S('M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z'),
  trash:      S('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
  play:       S('M8 5v14l11-7z'),
  stop:       S('M6 6h12v12H6z'),
  fullscreen: S('M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'),
  exitFs:     S('M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z'),
  videoOff:   S('M21 6.5l-4-4-2 2-1 1v7l4 4 1-1 2-2V6.5zM3.27 2L2 3.27 4.73 6H4a1 1 0 00-1 1v10a1 1 0 001 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z'),
  plus:       S('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z'),
  monitor:    S('M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z'),
  activity:   S('M22 12h-4l-3 9L9 3l-3 9H2'),
  wifi:       S('M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z'),
  cpu:        S('M9 3H7v2H5v2H3v2h2v6H3v2h2v2h2v2h2v-2h6v2h2v-2h2v-2h2v-2h-2V9h2V7h-2V5h-2V3h-2v2H9V3zm6 4v10H9V7h6z'),
  cctv:       S('M2 6l2-2h14l2 2v10l-2 2H4l-2-2V6zm8 8a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 110-4 2 2 0 010 4zm6-3h2v2h-2v-2z'),
};

export function Icon({ name, size = 20, color = 'currentColor', style }) {
  const ico = icons[name];
  if (!ico) return null;
  return (
    <svg width={size} height={size} viewBox={ico.vb} fill={color} style={{ flexShrink: 0, display: 'block', ...style }}>
      <path d={ico.d} />
    </svg>
  );
}
