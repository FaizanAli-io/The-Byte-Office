import type { Metadata } from 'next';
import Navigation from '@/components/Navigation';

/**
 * The private workspace: finance, personal tracking, the assistant and the MCP
 * API docs. Navigation stays so you can move between the workspace areas, but
 * the marketing footer and structured data do not apply here — none of these
 * pages are public.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navigation />
      <main className="min-h-screen">{children}</main>
    </>
  );
}
