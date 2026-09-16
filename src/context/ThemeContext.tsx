'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'shower_theme_mode';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize from localStorage and detect system theme
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved && (saved === 'system' || saved === 'light' || saved === 'dark')) {
        setThemeModeState(saved);
      }
    } catch (e) {
      console.error('Failed to read theme preference from localStorage:', e);
    }

    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      setMounted(true);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, []);

  // Compute the current active/resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (themeMode === 'system') {
      return systemTheme;
    }
    return themeMode;
  }, [themeMode, systemTheme]);

  // Apply changes to document <html> element
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'shower-dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'shower');
      root.style.colorScheme = 'light';
    }
  }, [resolvedTheme]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (e) {
      console.error('Failed to save theme preference to localStorage:', e);
    }
  };

  const toggleTheme = () => {
    if (themeMode === 'system') {
      setThemeMode('dark');
    } else if (themeMode === 'dark') {
      setThemeMode('light');
    } else {
      setThemeMode('system');
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
