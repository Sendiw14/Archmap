import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Sora } from "next/font/google";
import { SiteHeader } from "../components/site-header";
import { ToastProvider } from "../components/ui/toast";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "ARCHMAP: See the architecture behind your code", template: "%s | ARCHMAP" },
  description:
    "Deterministic, evidence-backed dependency graphs for JavaScript and TypeScript repositories.",
  openGraph: {
    title: "ARCHMAP: See the architecture behind your code",
    description: "Deterministic, evidence-backed dependency graphs for JavaScript and TypeScript.",
    type: "website",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="absolute left-3 top-3 z-[80] -translate-y-20 rounded-lg bg-ink px-3 py-2 text-sm text-white focus:translate-y-0"
        >
          Skip to content
        </a>
        <ToastProvider>
          <SiteHeader />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
