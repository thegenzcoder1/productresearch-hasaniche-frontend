import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Product Research Tracker',
  description: 'Track products under research, rank them, and manage suppliers & creatives.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
