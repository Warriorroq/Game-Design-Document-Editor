export type ThemeColorScheme = "light" | "dark";

export type ThemeCssVars = {
  colorScheme: ThemeColorScheme;
  "--bg-base": string;
  "--bg-raised": string;
  "--bg-panel": string;
  "--bg-hover": string;
  "--bg-input": string;
  "--border": string;
  "--border-focus": string;
  "--text": string;
  "--text-muted": string;
  "--text-dim": string;
  "--accent": string;
  "--accent-soft": string;
  "--success": string;
  "--warning": string;
  "--danger": string;
};

export const THEME_CSS_VAR_KEYS = [
  "--bg-base",
  "--bg-raised",
  "--bg-panel",
  "--bg-hover",
  "--bg-input",
  "--border",
  "--border-focus",
  "--text",
  "--text-muted",
  "--text-dim",
  "--accent",
  "--accent-soft",
  "--success",
  "--warning",
  "--danger",
] as const;

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function accentSoft(hex: string, alpha = 0.14): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Palette = {
  base: string;
  raised: string;
  panel: string;
  hover: string;
  input: string;
  border: string;
  accent: string;
  text: string;
  muted: string;
  dim: string;
  success?: string;
  warning?: string;
  danger?: string;
};

function darkTheme(p: Palette): ThemeCssVars {
  return {
    colorScheme: "dark",
    "--bg-base": p.base,
    "--bg-raised": p.raised,
    "--bg-panel": p.panel,
    "--bg-hover": p.hover,
    "--bg-input": p.input,
    "--border": p.border,
    "--border-focus": p.accent,
    "--text": p.text,
    "--text-muted": p.muted,
    "--text-dim": p.dim,
    "--accent": p.accent,
    "--accent-soft": accentSoft(p.accent),
    "--success": p.success ?? "#4ade80",
    "--warning": p.warning ?? "#fbbf24",
    "--danger": p.danger ?? "#f87171",
  };
}

function lightTheme(p: Palette): ThemeCssVars {
  return {
    colorScheme: "light",
    "--bg-base": p.base,
    "--bg-raised": p.raised,
    "--bg-panel": p.panel,
    "--bg-hover": p.hover,
    "--bg-input": p.input,
    "--border": p.border,
    "--border-focus": p.accent,
    "--text": p.text,
    "--text-muted": p.muted,
    "--text-dim": p.dim,
    "--accent": p.accent,
    "--accent-soft": accentSoft(p.accent),
    "--success": p.success ?? "#16a34a",
    "--warning": p.warning ?? "#ca8a04",
    "--danger": p.danger ?? "#dc2626",
  };
}

/** Curated themes — duplicates and near-duplicates removed. */
export const THEME_VARS = {
  midnight: darkTheme({
    base: "#0f1117",
    raised: "#161922",
    panel: "#1c2030",
    hover: "#252b3d",
    input: "#12151e",
    border: "#2a3148",
    accent: "#6b8cff",
    text: "#e8eaf0",
    muted: "#8b93ad",
    dim: "#5c6478",
  }),
  light: lightTheme({
    base: "#f0f2f6",
    raised: "#ffffff",
    panel: "#f7f8fb",
    hover: "#e8ebf2",
    input: "#ffffff",
    border: "#d4dae6",
    accent: "#3b5bdb",
    text: "#1a1d26",
    muted: "#5c6478",
    dim: "#8b93ad",
  }),
  slate: darkTheme({
    base: "#14171c",
    raised: "#1b2028",
    panel: "#222831",
    hover: "#2c3440",
    input: "#111418",
    border: "#343d4a",
    accent: "#7c9ab8",
    text: "#e2e6ec",
    muted: "#9aa3b2",
    dim: "#6b7585",
  }),
  graphite: darkTheme({
    base: "#121212",
    raised: "#1a1a1a",
    panel: "#222222",
    hover: "#2c2c2c",
    input: "#0e0e0e",
    border: "#383838",
    accent: "#b0b0b0",
    text: "#ececec",
    muted: "#a0a0a0",
    dim: "#707070",
  }),
  nord: darkTheme({
    base: "#2e3440",
    raised: "#3b4252",
    panel: "#434c5e",
    hover: "#4c566a",
    input: "#272c36",
    border: "#4c566a",
    accent: "#88c0d0",
    text: "#eceff4",
    muted: "#d8dee9",
    dim: "#81a1c1",
    success: "#a3be8c",
    warning: "#ebcb8b",
    danger: "#bf616a",
  }),
  warm: darkTheme({
    base: "#1a1612",
    raised: "#221e18",
    panel: "#2a241c",
    hover: "#363024",
    input: "#14110e",
    border: "#3d3528",
    accent: "#e8a54b",
    text: "#f0e6d8",
    muted: "#b8a894",
    dim: "#7a6f5e",
  }),
  paper: lightTheme({
    base: "#f6f1e8",
    raised: "#fffdf8",
    panel: "#faf6ee",
    hover: "#ebe4d6",
    input: "#fffdf8",
    border: "#ddd4c4",
    accent: "#8b6914",
    text: "#2c2618",
    muted: "#6a6050",
    dim: "#9a9080",
  }),
  forest: darkTheme({
    base: "#0f1411",
    raised: "#151c17",
    panel: "#1b2520",
    hover: "#243028",
    input: "#0c100e",
    border: "#2a3d32",
    accent: "#5ecf8a",
    text: "#e2ebe4",
    muted: "#94a89a",
    dim: "#5e7266",
  }),
  ocean: darkTheme({
    base: "#0a1218",
    raised: "#101c24",
    panel: "#142430",
    hover: "#1c3040",
    input: "#080e12",
    border: "#243848",
    accent: "#3dd6c6",
    text: "#dff6f2",
    muted: "#8ab8b0",
    dim: "#567a74",
  }),
  arctic: lightTheme({
    base: "#e8f4fc",
    raised: "#ffffff",
    panel: "#f0f8fd",
    hover: "#dceaf4",
    input: "#ffffff",
    border: "#c0d8e8",
    accent: "#0284c7",
    text: "#0c3a5c",
    muted: "#4a7898",
    dim: "#7aa0b8",
  }),
  sunset: darkTheme({
    base: "#180e10",
    raised: "#221418",
    panel: "#2c1a1e",
    hover: "#3a2428",
    input: "#120a0c",
    border: "#4a3034",
    accent: "#ff7b54",
    text: "#ffe8e0",
    muted: "#c49a90",
    dim: "#8a645c",
  }),
  cherry: darkTheme({
    base: "#160a0e",
    raised: "#201016",
    panel: "#2a141c",
    hover: "#381c26",
    input: "#100608",
    border: "#4a2834",
    accent: "#ff4d6d",
    text: "#ffe8ec",
    muted: "#c09098",
    dim: "#805860",
  }),
  rose: darkTheme({
    base: "#141018",
    raised: "#1c1522",
    panel: "#241c2c",
    hover: "#302638",
    input: "#100c14",
    border: "#3a3048",
    accent: "#d48cff",
    text: "#ece6f0",
    muted: "#a89ab4",
    dim: "#6e6278",
  }),
  lavender: lightTheme({
    base: "#f3f0fa",
    raised: "#ffffff",
    panel: "#f8f6fc",
    hover: "#ebe6f5",
    input: "#ffffff",
    border: "#d8d0e8",
    accent: "#7c5cbf",
    text: "#2a2238",
    muted: "#6a6080",
    dim: "#9a90a8",
  }),
  dracula: darkTheme({
    base: "#282a36",
    raised: "#313341",
    panel: "#383a4a",
    hover: "#44475a",
    input: "#21222c",
    border: "#44475a",
    accent: "#bd93f9",
    text: "#f8f8f2",
    muted: "#bcbfc9",
    dim: "#6272a4",
    success: "#50fa7b",
    warning: "#f1fa8c",
    danger: "#ff5555",
  }),
  monokai: darkTheme({
    base: "#272822",
    raised: "#2f3028",
    panel: "#383830",
    hover: "#45463c",
    input: "#1e1f1a",
    border: "#49483e",
    accent: "#a6e22e",
    text: "#f8f8f2",
    muted: "#b8b9a8",
    dim: "#75715e",
    success: "#a6e22e",
    warning: "#e6db74",
    danger: "#f92672",
  }),
  "solarized-dark": darkTheme({
    base: "#002b36",
    raised: "#073642",
    panel: "#0a3e4c",
    hover: "#124a58",
    input: "#001f27",
    border: "#2a5f6b",
    accent: "#2aa198",
    text: "#fdf6e3",
    muted: "#93a1a1",
    dim: "#657b83",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
  }),
  "solarized-light": lightTheme({
    base: "#fdf6e3",
    raised: "#fffef8",
    panel: "#f5efdc",
    hover: "#eee8d5",
    input: "#fffef8",
    border: "#d6cdb8",
    accent: "#268bd2",
    text: "#073642",
    muted: "#586e75",
    dim: "#839496",
    success: "#859900",
    warning: "#b58900",
    danger: "#dc322f",
  }),
  neon: darkTheme({
    base: "#050508",
    raised: "#0c0c12",
    panel: "#12121c",
    hover: "#1a1a28",
    input: "#030306",
    border: "#2a2a40",
    accent: "#00ff9f",
    text: "#f0fff8",
    muted: "#80c0a0",
    dim: "#408060",
    success: "#00ff9f",
    warning: "#ffe600",
    danger: "#ff2060",
  }),
} as const satisfies Record<string, ThemeCssVars>;

export type AppThemeId = keyof typeof THEME_VARS;

/** If a removed theme was saved, map to the closest remaining one. */
export const LEGACY_THEME_MAP: Record<string, AppThemeId> = {
  cobalt: "midnight",
  storm: "slate",
  gold: "warm",
  espresso: "warm",
  copper: "warm",
  ember: "sunset",
  sand: "paper",
  ivory: "paper",
  aurora: "forest",
  lagoon: "ocean",
  mint: "arctic",
  plum: "rose",
  twilight: "midnight",
  dusk: "rose",
  blood: "cherry",
  sage: "forest",
};

export function resolveThemeId(id: string): AppThemeId {
  if (id in THEME_VARS) return id as AppThemeId;
  return LEGACY_THEME_MAP[id] ?? "midnight";
}

export function applyThemeVars(id: AppThemeId): void {
  const vars = THEME_VARS[id];
  const root = document.documentElement;
  root.setAttribute("data-theme", id);
  root.style.colorScheme = vars.colorScheme;
  for (const key of THEME_CSS_VAR_KEYS) {
    root.style.setProperty(key, vars[key]);
  }
}
