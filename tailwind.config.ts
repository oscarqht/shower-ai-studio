import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        breathe: {
          '0%, 100%': { opacity: '.35', transform: 'scale(.94)' },
          '50%': { opacity: '1', transform: 'scale(1)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        breathe: 'breathe 1.4s ease-in-out infinite',
        rise: 'rise .5s ease both',
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        shower: {
          primary: '#C4633E',
          'primary-content': '#FFF7F1',
          secondary: '#7C8F6F',
          'secondary-content': '#EDF1E6',
          accent: '#D9A06B',
          'accent-content': '#2E2A26',
          neutral: '#2E2A26',
          'neutral-content': '#FDF6EE',
          'base-100': '#FFFDFA',
          'base-200': '#FAF6F0',
          'base-300': '#EFE6DA',
          'base-content': '#2E2A26',
          info: '#5C6B50',
          'info-content': '#EDF1E6',
          success: '#4E6140',
          'success-content': '#EDF1E6',
          warning: '#C4633E',
          'warning-content': '#FFF7F1',
          error: '#A0433A',
          'error-content': '#FFF3EF',
          '--rounded-box': '1.25rem',
          '--rounded-btn': '999px',
          '--rounded-badge': '999px',
          '--tab-radius': '999px',
        },
        'shower-dark': {
          primary: '#E07A52',
          'primary-content': '#181411',
          secondary: '#8FA87F',
          'secondary-content': '#171D15',
          accent: '#E6AF7E',
          'accent-content': '#181411',
          neutral: '#2E2924',
          'neutral-content': '#F5EFEA',
          'base-100': '#1C1916',
          'base-200': '#141210',
          'base-300': '#2A2520',
          'base-content': '#F5EFEA',
          info: '#7E9670',
          'info-content': '#171D15',
          success: '#6D8E5B',
          'success-content': '#171D15',
          warning: '#E07A52',
          'warning-content': '#181411',
          error: '#D95D50',
          'error-content': '#FFF3EF',
          '--rounded-box': '1.25rem',
          '--rounded-btn': '999px',
          '--rounded-badge': '999px',
          '--tab-radius': '999px',
        },
      },
    ],
  },
};

export default config;
