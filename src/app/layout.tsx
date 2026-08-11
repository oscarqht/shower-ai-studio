import type { Metadata } from 'next';
import { Instrument_Serif, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

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
  title: 'Shower Studio',
  description: 'Compose image generation prompts from Raindrop character collections & style packs',
  icons: {
    icon: '/app-icon.svg',
  },
};

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
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
