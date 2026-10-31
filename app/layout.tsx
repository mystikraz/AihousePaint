import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bihani Paints - AI House Color Visualizer',
  description: 'Interactive exterior and interior house paint visualizer with realistic texture preservation, authentic Bihani color palette, and AI architectural consultation.',
  openGraph: {
    title: 'Bihani Paints - AI House Color Visualizer',
    description: 'Interactive exterior and interior house paint visualizer with realistic texture preservation, authentic Bihani color palette, and AI architectural consultation.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bihani Paints - AI House Color Visualizer',
    description: 'Interactive exterior and interior house paint visualizer with realistic texture preservation, authentic Bihani color palette, and AI architectural consultation.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-50 antialiased">
      <body className="min-h-full flex flex-col font-sans text-slate-800" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
