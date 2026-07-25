import "./globals.css";
import { Inter } from "next/font/google";
import type { Metadata, Viewport } from "next";
import Footer from "./components/Footer";
import Navigation from "./components/Navigation";
import { company, siteUrl } from "./data/site";
import { jsonLd, organizationSchema, websiteSchema } from "./lib/seo";

// Work around Node runtimes that expose a malformed global localStorage object.
if (typeof window === "undefined") {
  const currentStorage = (globalThis as { localStorage?: Storage })
    .localStorage;

  if (!currentStorage || typeof currentStorage.getItem !== "function") {
    const storageMap = new Map<string, string>();

    const storageShim: Storage = {
      getItem: (key: string) =>
        storageMap.has(key) ? storageMap.get(key)! : null,
      setItem: (key: string, value: string) => {
        storageMap.set(key, value);
      },
      removeItem: (key: string) => {
        storageMap.delete(key);
      },
      clear: () => {
        storageMap.clear();
      },
      key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
      get length() {
        return storageMap.size;
      },
    };

    (globalThis as { localStorage?: Storage }).localStorage = storageShim;
  }
}

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "The Byte Office | Software Development and AI Solutions",
    template: "%s | The Byte Office",
  },
  description:
    "The Byte Office builds custom software, SaaS platforms, AI agents, RAG systems, automation workflows, backend APIs, and full-stack web applications.",
  applicationName: company.name,
  authors: [{ name: company.name }],
  creator: company.name,
  publisher: company.name,
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "The Byte Office | Software Development and AI Solutions",
    description:
      "Production-grade software, AI applications, automations, and full-stack platforms for businesses that need reliable delivery.",
    url: siteUrl,
    siteName: company.name,
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Byte Office | Software Development and AI Solutions",
    description:
      "Custom software development, AI agents, RAG systems, automation, and full-stack web applications.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        {jsonLd(organizationSchema)}
        {jsonLd(websiteSchema)}
        <Navigation />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
