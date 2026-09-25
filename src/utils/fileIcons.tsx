// Mimics VS Code's per-extension file icon coloring: a small colored badge
// with a short label rather than a single generic document glyph, so files
// of different types are visually distinguishable at a glance. Shared
// between the file explorer tree and the editor tab strip so both use the
// exact same icon per extension.
export const FILE_BADGE: Record<string, { label: string; color: string }> = {
  ts: { label: 'TS', color: '#3178c6' },
  tsx: { label: 'TSX', color: '#3178c6' },
  js: { label: 'JS', color: '#e8c547' },
  jsx: { label: 'JSX', color: '#e8c547' },
  json: { label: '{}', color: '#cbcb41' },
  md: { label: 'MD', color: '#8a8a8a' },
  css: { label: '#', color: '#4287f5' },
  html: { label: '<>', color: '#e37933' },
  py: { label: 'PY', color: '#3572a5' },
  yml: { label: 'YML', color: '#a371f7' },
  yaml: { label: 'YML', color: '#a371f7' },
  java: { label: 'JV', color: '#ea2d2e' },
  c: { label: 'C', color: '#a8b9cc' },
  h: { label: 'H', color: '#a8b9cc' },
  cpp: { label: 'C++', color: '#00599c' },
  cc: { label: 'C++', color: '#00599c' },
  cxx: { label: 'C++', color: '#00599c' },
  hpp: { label: 'H++', color: '#00599c' },
  cs: { label: 'C#', color: '#178600' },
  go: { label: 'GO', color: '#00add8' },
  rs: { label: 'RS', color: '#dea584' },
  rb: { label: 'RB', color: '#cc342d' },
  php: { label: 'PHP', color: '#787cb5' },
  sh: { label: 'SH', color: '#89e051' },
  bash: { label: 'SH', color: '#89e051' },
  sql: { label: 'SQL', color: '#e38c00' },
  xml: { label: '</>', color: '#e37933' },
  vue: { label: 'VUE', color: '#41b883' },
  svelte: { label: 'SV', color: '#ff3e00' },
  swift: { label: 'SW', color: '#f05138' },
  kt: { label: 'KT', color: '#a97bff' },
  kts: { label: 'KT', color: '#a97bff' },
  scss: { label: 'SC', color: '#c6538c' },
  sass: { label: 'SA', color: '#c6538c' },
  less: { label: 'LES', color: '#5379a8' },
  lua: { label: 'LUA', color: '#8ea0cf' },
  dart: { label: 'DT', color: '#00b4ab' },
  toml: { label: 'TML', color: '#c17c4e' },
  ini: { label: 'INI', color: '#6d8086' },
  env: { label: 'ENV', color: '#8dc149' },
  txt: { label: 'TXT', color: '#8a8a8a' },
}

export function badgeForFile(name: string): { label: string; color: string } {
  const extension = name.split('.').pop()?.toLowerCase() ?? ''
  return FILE_BADGE[extension] ?? { label: '·', color: '#6a6a6a' }
}

function FileBadge({ name, className }: { name: string; className: string }) {
  const badge = badgeForFile(name)
  return (
    <span className={className} style={{ color: badge.color }}>
      {badge.label}
    </span>
  )
}

export default FileBadge
