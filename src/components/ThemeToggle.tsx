'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop, Check, ChevronDown } from 'lucide-react';
import { useTheme, ThemeMode } from '@/context/ThemeContext';

interface ThemeToggleProps {
  variant?: 'compact' | 'segmented' | 'dropdown';
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'compact',
  className = '',
}) => {
  const { themeMode, resolvedTheme, setThemeMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      mode: 'system',
      label: 'Auto / OS',
      icon: <Laptop className="w-3.5 h-3.5" />,
      desc: 'Matches your system theme',
    },
    {
      mode: 'light',
      label: 'Light',
      icon: <Sun className="w-3.5 h-3.5" />,
      desc: 'Warm cream & terracotta',
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <Moon className="w-3.5 h-3.5" />,
      desc: 'Deep warm obsidian',
    },
  ];

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-1 rounded-2xl bg-[#EFE6DA]/70 dark:bg-[#2A2520] border border-[#E3D8CA] dark:border-[#3D352E] ${className}`}
        role="group"
        aria-label="Theme mode selection"
      >
        {options.map((opt) => {
          const isActive = themeMode === opt.mode;
          return (
            <button
              key={opt.mode}
              type="button"
              onClick={() => setThemeMode(opt.mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#FFFDFA] dark:bg-[#1C1916] text-[#C4633E] dark:text-[#E07A52] shadow-sm font-semibold'
                  : 'text-[#7A6F64] dark:text-[#A69B90] hover:text-[#2E2A26] dark:hover:text-[#F5EFEA]'
              }`}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  // Compact header dropdown toggle
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        id="theme-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={`Theme: ${themeMode} (${resolvedTheme} active)`}
        className="flex items-center gap-1.5 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full border border-[#E3D8CA] dark:border-[#3D352E] bg-[#FFFDFA] dark:bg-[#1C1916] text-[#5B5148] dark:text-[#D5CCC3] text-[13.5px] font-medium cursor-pointer transition-colors hover:border-[#C4633E] dark:hover:border-[#E07A52] hover:text-[#C4633E] dark:hover:text-[#E07A52]"
      >
        {themeMode === 'system' ? (
          <Laptop className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />
        ) : themeMode === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-[#E07A52]" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-[#C4633E]" />
        )}
        <span className="hidden sm:inline text-xs capitalize">
          {themeMode === 'system' ? 'Auto' : themeMode}
        </span>
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-2xl bg-[#FFFDFA] dark:bg-[#1C1916] border border-[#EAE0D4] dark:border-[#3D352E] shadow-xl p-1.5 z-50 animate-rise">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[#A08F80] dark:text-[#80756B]">
            Appearance
          </div>
          {options.map((opt) => {
            const isSelected = themeMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => {
                  setThemeMode(opt.mode);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left text-[13px] transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#FFF3EA] dark:bg-[#2C1C14] text-[#C4633E] dark:text-[#E07A52] font-semibold'
                    : 'text-[#5B5148] dark:text-[#D5CCC3] hover:bg-[#FAF6F0] dark:hover:bg-[#25211D]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={isSelected ? 'text-[#C4633E] dark:text-[#E07A52]' : 'opacity-70'}>
                    {opt.icon}
                  </span>
                  <span>{opt.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#C4633E] dark:text-[#E07A52]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
