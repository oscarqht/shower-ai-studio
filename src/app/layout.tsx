import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Shower - Character & Style Prompt Studio',
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen bg-base-300 text-base-content antialiased`}>
        {children}
      </body>
    </html>
  );
}
