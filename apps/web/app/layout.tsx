import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ripo Dashboard',
  description: 'Ripo guild management dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
