import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans, Poppins } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import { BottomTabBar } from "@/components/common/bottom-tab-bar";
import Footer from "@/components/common/footer";
import Navbar from "@/components/common/navbar";

import ProgessProvider from "@/components/providers/progess-provider";
import TanstackQueryProvider from "@/components/providers/tanstack-query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";

import "./globals.css";

// Display face. Bound to --font-serif so every `font-serif` heading picks up
// Peerly's rounded geometric look.
const display = Poppins({
  variable: "--font-serif",
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
});

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  weight: ["400", "700"],
  subsets: ["latin"],
});

const description =
  "Peerly — play live quizzes with your class and learn from seniors' real placement experiences.";

export const metadata: Metadata = {
  title: {
    default: "Peerly",
    template: "%s · Peerly",
  },
  description,
  applicationName: "Peerly",
  openGraph: {
    title: "Peerly",
    description,
    siteName: "Peerly",
  },
  twitter: {
    card: "summary",
    title: "Peerly",
    description,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f6fe" },
    { media: "(prefers-color-scheme: dark)", color: "#121626" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable} overflow-x-hidden antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <TanstackQueryProvider>
            <ProgessProvider>
              <div className="flex min-h-dvh flex-col">
                <Navbar />
                <main className="flex-1">{children}</main>
                <Footer />
              </div>
              <BottomTabBar />
              <Toaster />
            </ProgessProvider>
          </TanstackQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
