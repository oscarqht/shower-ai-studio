import type { Metadata } from 'next';
import { Instrument_Serif, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-serif',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Shower',
  description: 'Compose image generation prompts from Raindrop character collections & style packs',
  icons: {
    icon: '/app-icon.svg',
  },
};

const themeInitScript = `
  (function() {
    try {
      var savedMode = localStorage.getItem('shower_theme_mode');
      var isDark = false;
      if (savedMode === 'dark') {
        isDark = true;
      } else if (savedMode === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      var docEl = document.documentElement;
      if (isDark) {
        docEl.classList.add('dark');
        docEl.setAttribute('data-theme', 'shower-dark');
        docEl.style.colorScheme = 'dark';
      } else {
        docEl.classList.remove('dark');
        docEl.setAttribute('data-theme', 'shower');
        docEl.style.colorScheme = 'light';
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="shower"
      suppressHydrationWarning
      className={`${instrumentSerif.variable} ${dmSans.variable} ${dmMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen font-sans antialiased text-base-content">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

