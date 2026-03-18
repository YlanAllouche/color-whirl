export type ColorPreset = {
  id: string;
  label: string;
  group: string;
  colors: string[];
  backgroundColor: string;
  source?: string;
};

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = Number.parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function toHexColor(rgb: { r: number; g: number; b: number }): string {
  const r = clampByte(rgb.r).toString(16).padStart(2, '0');
  const g = clampByte(rgb.g).toString(16).padStart(2, '0');
  const b = clampByte(rgb.b).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

// Relative luminance (sRGB) to pick a "darkest" color.
function luminance(hex: string): number {
  const rgb = parseHexColor(hex);
  if (!rgb) return 1;

  const srgb = [rgb.r, rgb.g, rgb.b].map((c) => c / 255);
  const lin = srgb.map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function mix(hexA: string, hexB: string, t: number): string {
  const a = parseHexColor(hexA);
  const b = parseHexColor(hexB);
  if (!a || !b) return hexA;
  const tt = Math.max(0, Math.min(1, t));
  return toHexColor({
    r: a.r + (b.r - a.r) * tt,
    g: a.g + (b.g - a.g) * tt,
    b: a.b + (b.b - a.b) * tt
  });
}

function deriveBackgroundFromPalette(colors: string[]): string {
  const usable = colors.map((c) => (c.startsWith('#') ? c : `#${c}`)).filter((c) => parseHexColor(c));
  if (usable.length === 0) return '#0a0a0f';

  let darkest = usable[0];
  let darkestL = luminance(darkest);
  for (const c of usable.slice(1)) {
    const l = luminance(c);
    if (l < darkestL) {
      darkest = c;
      darkestL = l;
    }
  }

  // Nudge toward near-black so sticks pop.
  return mix(darkest, '#000000', 0.78);
}

function fromColorHuntCode(code: string): { colors: string[]; backgroundColor: string } {
  const raw = code.trim().toLowerCase();
  const colors: string[] = [];
  for (let i = 0; i + 6 <= raw.length; i += 6) {
    const hex = `#${raw.slice(i, i + 6)}`;
    if (parseHexColor(hex)) colors.push(hex);
  }
  return { colors, backgroundColor: deriveBackgroundFromPalette(colors) };
}

const CURATED_PRESETS: ColorPreset[] = [
  {
    id: 'curated-sunset',
    label: 'Sunset',
    group: 'Curated',
    colors: ['#FF6B6B', '#FF8E53', '#FE6B8B', '#FF8E53', '#FFD93D'],
    backgroundColor: '#1a1a2e'
  },
  {
    id: 'curated-ocean',
    label: 'Ocean',
    group: 'Curated',
    colors: ['#0077BE', '#0099CC', '#00BBDD', '#4ECDC4', '#44A08D'],
    backgroundColor: '#0a1d2e'
  },
  {
    id: 'curated-forest',
    label: 'Forest',
    group: 'Curated',
    colors: ['#2D5016', '#3E6B1F', '#4F7D28', '#61A534', '#7CB342'],
    backgroundColor: '#0d1a0a'
  },
  {
    id: 'curated-monochrome',
    label: 'Monochrome',
    group: 'Curated',
    colors: ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#e6e6e6'],
    backgroundColor: '#0f0f0f'
  },
  {
    id: 'curated-candy',
    label: 'Candy',
    group: 'Curated',
    colors: ['#FF006E', '#8338EC', '#3A86FF', '#06FFB4', '#FFBE0B'],
    backgroundColor: '#1a0d26'
  },
  {
    id: 'curated-neon',
    label: 'Neon',
    group: 'Curated',
    colors: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000'],
    backgroundColor: '#0a0a15'
  },
  {
    id: 'curated-lavender',
    label: 'Lavender',
    group: 'Curated',
    colors: ['#B19CD9', '#D8BFD8', '#E6B3E0', '#DDA0DD', '#C8A2C8'],
    backgroundColor: '#2a1f3d'
  },
  {
    id: 'curated-tropical',
    label: 'Tropical',
    group: 'Curated',
    colors: ['#FF6B9D', '#FFC656', '#26C485', '#00D4FF', '#C44569'],
    backgroundColor: '#1a2d3a'
  },
  {
    id: 'curated-vintage',
    label: 'Vintage',
    group: 'Curated',
    colors: ['#A0522D', '#CD853F', '#DEB887', '#D2B48C', '#BC8F8F'],
    backgroundColor: '#2a1f15'
  },
  {
    id: 'curated-midnight',
    label: 'Midnight',
    group: 'Curated',
    colors: ['#0F3460', '#16213E', '#533483', '#E94560', '#FFBB3F'],
    backgroundColor: '#0a0e1a'
  },
  {
    id: 'curated-aurora',
    label: 'Aurora',
    group: 'Curated',
    colors: ['#1FBF71', '#00D4FF', '#FF6BCB', '#FFE66D', '#6C3DFF'],
    backgroundColor: '#0d1117'
  },
  {
    id: 'curated-ember',
    label: 'Ember',
    group: 'Curated',
    colors: ['#FF4500', '#FF6347', '#FF8C42', '#FFA500', '#FFD700'],
    backgroundColor: '#1a0a00'
  }
];

const SOLARIZED_PRESETS: ColorPreset[] = [
  {
    id: 'solarized-dark',
    label: 'Dark',
    group: 'Solarized',
    // Accent colors (canonical).
    colors: ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900'],
    backgroundColor: '#002b36',
    source: 'https://ethanschoonover.com/solarized/'
  },
  {
    id: 'solarized-light',
    label: 'Light',
    group: 'Solarized',
    colors: ['#b58900', '#cb4b16', '#dc322f', '#d33682', '#6c71c4', '#268bd2', '#2aa198', '#859900'],
    backgroundColor: '#fdf6e3',
    source: 'https://ethanschoonover.com/solarized/'
  }
];

const GRUVBOX_PRESETS: ColorPreset[] = [
  {
    id: 'gruvbox-dark',
    label: 'Dark',
    group: 'Gruvbox',
    colors: ['#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#fe8019'],
    backgroundColor: '#282828',
    source: 'https://github.com/morhetz/gruvbox'
  },
  {
    id: 'gruvbox-light',
    label: 'Light',
    group: 'Gruvbox',
    colors: ['#9d0006', '#79740e', '#b57614', '#076678', '#8f3f71', '#427b58', '#af3a03'],
    backgroundColor: '#fbf1c7',
    source: 'https://github.com/morhetz/gruvbox'
  }
];

const DRACULA_PRESETS: ColorPreset[] = [
  {
    id: 'dracula-dracula',
    label: 'Dracula',
    group: 'Dracula',
    // Accents (canonical).
    colors: ['#ff5555', '#ffb86c', '#f1fa8c', '#50fa7b', '#8be9fd', '#bd93f9', '#ff79c6', '#6272a4'],
    backgroundColor: '#282a36',
    source: 'https://github.com/dracula/dracula-theme'
  },
  {
    id: 'dracula-alucard',
    label: 'Alucard',
    group: 'Dracula',
    // Light variant name commonly used for the inverse of Dracula.
    colors: ['#ff5555', '#ffb86c', '#f1fa8c', '#50fa7b', '#8be9fd', '#bd93f9', '#ff79c6', '#6272a4'],
    backgroundColor: '#f8f8f2',
    source: 'https://github.com/dracula/dracula-theme'
  }
];

const CATPPUCCIN_PRESETS: ColorPreset[] = [
  {
    id: 'catppuccin-latte',
    label: 'Latte',
    group: 'Catppuccin',
    colors: ['#8839ef', '#1e66f5', '#209fb5', '#179299', '#40a02b', '#fe640b', '#df8e1d', '#d20f39'],
    backgroundColor: '#eff1f5',
    source: 'https://github.com/catppuccin/catppuccin'
  },
  {
    id: 'catppuccin-frappe',
    label: 'Frappe',
    group: 'Catppuccin',
    colors: ['#ca9ee6', '#8caaee', '#85c1dc', '#81c8be', '#a6d189', '#ef9f76', '#e5c890', '#e78284'],
    backgroundColor: '#303446',
    source: 'https://github.com/catppuccin/catppuccin'
  },
  {
    id: 'catppuccin-macchiato',
    label: 'Macchiato',
    group: 'Catppuccin',
    colors: ['#c6a0f6', '#8aadf4', '#7dc4e4', '#8bd5ca', '#a6da95', '#f5a97f', '#eed49f', '#ed8796'],
    backgroundColor: '#24273a',
    source: 'https://github.com/catppuccin/catppuccin'
  },
  {
    id: 'catppuccin-mocha',
    label: 'Mocha',
    group: 'Catppuccin',
    colors: ['#cba6f7', '#89b4fa', '#74c7ec', '#94e2d5', '#a6e3a1', '#fab387', '#f9e2af', '#f38ba8'],
    backgroundColor: '#1e1e2e',
    source: 'https://github.com/catppuccin/catppuccin'
  }
];

const COLORHUNT_CODES: string[] = [
  'ffdcdcfff2ebffe8cdffd6ba',
  '222831393e46948979dfd0b8',
  'f1efecd4c9be123458030303',
  'f2efe79acbd048a6a7006a71',
  '9ecad6748daef5cbcbffeaea',
  '21344854779294b4c1ecefca',
  'faf7f3f0e4d3dcc5b2d9a299',
  '819a91a7c1a8d1d8beeeefe0',
  '9fb3df9ec6f3bddde4fff1d5',
  'fcf9eabadfdbffa4a4ffbdbd',
  '3a0519670d2fa53860ef88ad',
  'fff2e0c0c9eea2aadb898ac4',
  'f7cfd8f4f8d3a6d6d68e7dbe',
  'f9f8f6efe9e3d9cfc7c9b59c',
  '1b3c53456882d2c1b6f9f3ef',
  'f2f2f2eae4d5b6b09f000000',
  '8f87f1c68efde9a5f1fed2e2',
  'ecfae5ddf6d2cae8bdb0db9c',
  'ff90bbffc1daf8f8e18accd5',
  'fcf8f8fbefeff9dfdff5afaf',
  '3e0703660b058c1007fff0c4',
  'd6a99dfbf3d5d6dac89cafaa',
  '537d5d73946b9ebc8ad2d0a0',
  '96a78db6ceb4d9e9cff0f0f0',
  'f1e7e7e69db8ffd0c7fffece',
  '328e6e67ae6e90c67ce1eebc',
  '626f47a4b465f5ecd5f0bb78',
  'f5eedc27548a183b4edda853',
  'f1f3e0d2dcb6a1bc98778873',
  '3334467f8caab8cfceeaefef',
  '706d54a08963c9b194dbdbdb',
  'efece38fabd44a70a9000000',
  'fffbde91c8e4749bc24682a9',
  'bbdce5eceedfd9c4b0cfab8d',
  'fcf5eeffc4c4ee6983850e35',
  'fbdb93be5b508a2d3b641b2e',
  '1b3c53234c6a456882d2c1b6',
  '55587998a1bcded3c4f4ebd3',
  'feeac9ffcdc9fdacacfd7979',
  '0a400c819067b1ab86fefae0',
  '37353e44444e715a5ad3dad9',
  'f5d2d2f8f7babde3c3a3ccda',
  'f5efe6e8dfca6d94c5cbdceb',
  'ffe99affd586ffaaaaff9898',
  '0f28541c4d8d4988c4bde8f5',
  'fff5f2f5babb568f87064232',
  '896c6ce5beb5eee6caf5fae1',
  'f08787ffc7a7fee2adf8fab4',
  '21344854779294b4c1eae0cf',
  'fffbde90d1ca129990096b68',
  '7f55b19b7ebdf49babffe1e0',
  '102e50f5c45ee78b48be3d2a',
  'b77466ffe1afe2b59a957c62',
  '113f6734699a58a0c8fdf5aa',
  'f6f0d7c5d89d9cab8489986d',
  '0000008e1616e8c999f8eedf',
  'a8df8ef0ffdfffd8dfffaab8',
  '3e5f445e936c93da97e8ffd7',
  '19183b708993a1c2bde7f2ef',
  '8dbcc7a4ccd9c4e1e6ebffd8',
  'dc143cf75270f7cac9fdebd0',
  'e7efc7aec8a48a784e3b3b1a',
  'eaebd0da6c6ccd5656af3e3e',
  'f3f3e027548a183b4edda853',
  '556b2f8fa31ec6d870eff5d2',
  'ffdbdbffc6c6644a07594100',
  '662222842a3ba3485af5daa7',
  'faf9eea2af9bdccfc0eeeeee',
  '1a2a803b38a07a85c1b2b0e8',
  '9a3f3fc1856de6cfa9fbf9d1',
  '6b3f698d5f8ca376a2ddc3c3',
  '80a1ba91c4c3b4debdfff7dd',
  '309898ff9f00f4631ecb0404',
  'fffdf6faf6e9ddeb9da0c878',
  '4b352aca7842b2cd9cf0f2bd',
  '1b3c53234c6a456882e3e3e3',
  'ffecc0ffc29bf39f9fb95e82',
  '60465273555797866ad29f80',
  '5d688af7a5a5ffdbb6fff2ef',
  'bf92646f826abbd8a3f0f1c5'
];

const COLORHUNT_PRESETS: ColorPreset[] = COLORHUNT_CODES.map((code, i) => {
  const { colors, backgroundColor } = fromColorHuntCode(code);
  return {
    id: `colorhunt-${code}`,
    label: `CH ${i + 1}`,
    group: 'ColorHunt Popular',
    colors,
    backgroundColor,
    source: `https://colorhunt.co/palette/${code}`
  };
});

export const COLOR_PRESETS: ColorPreset[] = [
  ...CURATED_PRESETS,
  ...SOLARIZED_PRESETS,
  ...DRACULA_PRESETS,
  ...CATPPUCCIN_PRESETS,
  ...GRUVBOX_PRESETS,
  ...COLORHUNT_PRESETS
];

export const COLOR_PRESET_GROUPS: string[] = [
  'Curated',
  'Solarized',
  'Dracula',
  'Catppuccin',
  'Gruvbox',
  'ColorHunt Popular'
];
