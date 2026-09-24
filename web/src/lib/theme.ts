import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'v2i-theme';
const CANVAS: Record<Theme, string> = { dark: '#090b0c', light: '#f4f6f6' };

function current(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Dark is the product default; the choice is remembered per browser. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CANVAS[theme]);
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable: session only */ }
  }, [theme]);

  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return { theme, setTheme: setThemeState, toggle };
}
