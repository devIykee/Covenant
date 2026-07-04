import type { Metadata } from "next";
import { Source_Serif_4, Public_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";

const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Covenant | Programmable Trust on Stacks",
  description: "Conditional treasury platform. Funds move only when real-world conditions are verifiably met using FlowVault.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sourceSerif.variable} ${publicSans.variable} ${jetbrains.variable} h-full antialiased`}>
      <head>
        {/* Apply the saved/preferred theme before first paint so dark mode has no
            flash and works on every page, not just ones that render <Nav>. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('covenant-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--parchment)] text-[var(--ink)]">
        {children}
        <Toaster position="top-center" richColors closeButton />
        <Analytics />
      </body>
    </html>
  );
}
