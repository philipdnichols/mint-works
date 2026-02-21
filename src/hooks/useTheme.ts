import { useEffect, useLayoutEffect, useState } from 'react';
import type { ThemeMode } from '../types/theme';

const THEME_STORAGE_KEY = 'mintworks-theme';

const isTheme = (value: string | null): value is ThemeMode => value === 'light' || value === 'dark';

const getStoredTheme = (): ThemeMode | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
};

const getSystemTheme = (): ThemeMode => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<ThemeMode>(() => getStoredTheme() ?? getSystemTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors (e.g., private mode).
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
};
