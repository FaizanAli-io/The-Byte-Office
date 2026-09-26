import type { Metadata } from 'next';
import Footer from '@/components/site/Footer';
import Navigation from '@/components/Navigation';
import { siteUrl } from '@/content/site';
import { jsonLd, organizationSchema, websiteSchema } from '@/lib/seo';

/**
 * The public marketing site: home, services, projects, about and contact.
 * Everything indexable, and the only place the Organization/WebSite structured
 * data belongs.
 */
export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: 'The Byte Office | Software Development and AI Solutions',
    description:
      'Production-grade software, AI applications, automations, and full-stack platforms for businesses that need reliable delivery.',
    url: siteUrl,
    siteName: 'The Byte Office',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Byte Office | Software Development and AI Solutions',
    description: 'Custom software development, AI agents, RAG systems, automation, and full-stack web applications.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {jsonLd(organizationSchema)}
      {jsonLd(websiteSchema)}
      <Navigation />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
