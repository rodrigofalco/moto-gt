export const THEME = {
  // Semantic colors (string for text)
  gold: '#f5c518',
  cyan: '#00e5ff',
  bg: '#1a1a2e',
  panel: '#16213e',
  border: '#0f3460',
  green: '#00c853',
  red: '#e94560',
  text: '#e0e0e0',
  muted: '#94a3b8',
  white: '#ffffff',
  black: '#0b0b14',
  purple: '#d500f9',
  blue: '#9ad0ff',

  // Phaser number colors (same values as hex but usable as numbers)
  get goldNum(): number { return 0xf5c518; },
  get cyanNum(): number { return 0x00e5ff; },
  get bgNum(): number { return 0x1a1a2e; },
  get panelNum(): number { return 0x16213e; },
  get borderNum(): number { return 0x0f3460; },
  get greenNum(): number { return 0x00c853; },
  get redNum(): number { return 0xe94560; },

  // Design tokens
  bgGradient: ['#1a1a2e', '#16213e'] as const,
  shadow: { color: 0x000000, alpha: 0.4, blur: 8, offsetY: 3 } as const,
  fontFamily: 'Inter, "Segoe UI", system-ui, sans-serif',
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const,
  panelStyle: {
    bg: '#16213e', bgNum: 0x16213e,
    border: '#0f3460', borderNum: 0x0f3460,
    radius: 8,
  } as const,
  header: { bg: '#0f3460', bgNum: 0x0f3460 } as const,
  button: {
    normal: 0x2962ff, hover: 0x448aff, press: 0x0039cb, disabled: 0x555555,
  } as const,
} as const;

export const FONTS = {
  h1: '24px',
  h2: '20px',
  body: '14px',
  mono: '13px',
  small: '12px',
} as const;

export function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}
