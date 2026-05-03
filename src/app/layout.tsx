import "./globals.css";
import { Inter } from "next/font/google";
import Footer from "./components/Footer";
import Navigation from "./components/Navigation";

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

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "The Byte Office - AI, Automation & Full-Stack Development",
  description:
    "Premier freelance agency specializing in AI solutions, automation, and full-stack development. Transform your business with cutting-edge technology.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>
        <Navigation />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
