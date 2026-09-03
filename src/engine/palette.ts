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
    id: 'blue',
    name: 'Sky Blue',
    hex: '#1e90ff',
    light: '#4da6ff',
    dark: '#0e6ecf',
    rim: '#094b8f',
    text: '#ffffff',
    bgGradient: 'from-[#4da6ff] to-[#1a85f0]'
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
    id: 'lime',
    name: 'Lime Green',
    hex: '#84cc16',
    light: '#a3e635',
    dark: '#65a30d',
    rim: '#4d7c0f',
    text: '#274005',
    bgGradient: 'from-[#a3e635] to-[#65a30d]'
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
    id: 'dark_brown',
    name: 'Dark Choco',
    hex: '#602a0a',
    light: '#78350f',
    dark: '#451a03',
    rim: '#331201',
    text: '#fed7aa',
    bgGradient: 'from-[#78350f] to-[#451a03]'
  },
  {
    id: 'gray',
    name: 'Slate Gray',
    hex: '#64748b',
    light: '#94a3b8',
    dark: '#475569',
    rim: '#334155',
    text: '#ffffff',
    bgGradient: 'from-[#94a3b8] to-[#475569]'
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
    id: 'purple',
    name: 'Lavender Purple',
    hex: '#a855f7',
    light: '#c084fc',
    dark: '#9333ea',
    rim: '#7e22ce',
    text: '#ffffff',
    bgGradient: 'from-[#c084fc] to-[#9333ea]'
  },
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
    id: 'cyan',
    name: 'Aqua Cyan',
    hex: '#06b6d4',
    light: '#22d3ee',
    dark: '#0891b2',
    rim: '#0e7490',
    text: '#ffffff',
    bgGradient: 'from-[#22d3ee] to-[#0891b2]'
  },
  {
    id: 'white',
    name: 'Ivory White',
    hex: '#f8fafc',
    light: '#ffffff',
    dark: '#cbd5e1',
    rim: '#94a3b8',
    text: '#334155',
    bgGradient: 'from-white to-slate-200'
  },
  {
    id: 'lavender',
    name: 'Light Lavender',
    hex: '#c084fc',
    light: '#e9d5ff',
    dark: '#a855f7',
    rim: '#7e22ce',
    text: '#ffffff',
    bgGradient: 'from-[#e9d5ff] to-[#a855f7]'
  },
  {
    id: 'indigo',
    name: 'Royal Indigo',
    hex: '#6366f1',
    light: '#818cf8',
    dark: '#4f46e5',
    rim: '#3730a3',
    text: '#ffffff',
    bgGradient: 'from-[#818cf8] to-[#4338ca]'
  }
];

export const COLOR_MAP: Record<string, ColorDef> = COLOR_PALETTE.reduce((acc, c) => {
  acc[c.id] = c;
  return acc;
}, {} as Record<string, ColorDef>);

export function getColorDef(colorId: string): ColorDef {
  return COLOR_MAP[colorId] || {
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
