export interface ColorDef {
  id: string;
  name: string;
  hex: string;
  light: string;
  dark: string;
  rim: string;
  text: string;
  bgGradient: string;
}

export const COLOR_PALETTE: ColorDef[] = [
  {
    id: 'red',
    name: 'Cherry Red',
    hex: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
    rim: '#b91c1c',
    text: '#ffffff',
    bgGradient: 'from-[#f87171] to-[#dc2626]'
  },
  {
    id: 'blue',
    name: 'Royal Blue',
    hex: '#1d4ed8',
    light: '#60a5fa',
    dark: '#1e3a8a',
    rim: '#172554',
    text: '#ffffff',
    bgGradient: 'from-[#3b82f6] to-[#1e40af]'
  },
  {
    id: 'green',
    name: 'Grass Green',
    hex: '#10b981',
    light: '#34d399',
    dark: '#059669',
    rim: '#047857',
    text: '#ffffff',
    bgGradient: 'from-[#34d399] to-[#059669]'
  },
  {
    id: 'yellow',
    name: 'Canary Yellow',
    hex: '#ffcc00',
    light: '#ffe04d',
    dark: '#d9a300',
    rim: '#b38200',
    text: '#734600',
    bgGradient: 'from-[#ffe04d] to-[#ffc400]'
  },
  {
    id: 'pink',
    name: 'Bubblegum Pink',
    hex: '#ff69b4',
    light: '#ff8ec7',
    dark: '#d6458f',
    rim: '#b3246b',
    text: '#ffffff',
    bgGradient: 'from-[#ff8ec7] to-[#ff52a5]'
  },
  {
    id: 'orange',
    name: 'Vivid Orange',
    hex: '#f97316',
    light: '#fb923c',
    dark: '#ea580c',
    rim: '#c2410c',
    text: '#ffffff',
    bgGradient: 'from-[#fb923c] to-[#ea580c]'
  },
  {
    id: 'brown',
    name: 'Warm Brown',
    hex: '#b45309',
    light: '#d97706',
    dark: '#92400e',
    rim: '#78350f',
    text: '#ffffff',
    bgGradient: 'from-[#d97706] to-[#92400e]'
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    hex: '#00e5ff',
    light: '#70ffff',
    dark: '#00b4d8',
    rim: '#0077b6',
    text: '#003840',
    bgGradient: 'from-[#70ffff] to-[#00b4d8]'
  }
];

export const COLOR_MAP: Record<string, ColorDef> = COLOR_PALETTE.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {} as Record<string, ColorDef>);

// Backwards-compatibility aliases for former palette colors
const COLOR_ALIASES: Record<string, string> = {
  lime: 'green',
  dark_brown: 'brown',
  gray: 'brown',
  white: 'cyan',
  lavender: 'pink',
  indigo: 'blue',
  purple: 'pink'
};

export function getColorDef(colorId: string): ColorDef {
  const resolvedId = COLOR_ALIASES[colorId] || colorId;
  return COLOR_MAP[resolvedId] || {
    id: colorId,
    name: colorId,
    hex: colorId.startsWith('#') ? colorId : '#888888',
    light: '#aaaaaa',
    dark: '#555555',
    rim: '#333333',
    text: '#ffffff',
    bgGradient: 'from-gray-400 to-gray-600'
  };
}
