import type { Metadata } from 'next';
import '../editor.css';
import './espace.css';

export const metadata: Metadata = {
  title: 'Mon espace',
  robots: { index: false, follow: false },
};

export default function EspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
