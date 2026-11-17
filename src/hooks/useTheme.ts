import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'ch-theme';

const read = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch { /* storage non disponibile */ }
  return 'system';
};

const apply = (theme: Theme) => {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  return dark;
};

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);
  const [isDark, setIsDark] = useState(() => apply(read()));

  useEffect(() => {
    setIsDark(apply(theme));
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setIsDark(apply('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
    setThemeState(t);
  }, []);

  const toggle = useCallback(() => setTheme(isDark ? 'light' : 'dark'), [isDark, setTheme]);

  return { theme, isDark, setTheme, toggle };
}
