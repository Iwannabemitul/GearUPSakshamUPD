import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/lib/lang-context";
import { A11yProvider } from "@/lib/a11y-context";
import { ServiceWorkerRegister } from "@/components/saksham/sw-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saksham — Skill Intelligence",
  description:
    "Saksham connects roles, activities, competencies, skill gaps, learning and assessment into one app built to work alongside iGOT.",
  manifest: "/manifest.json",
  keywords: [
    "Saksham",
    "iGOT",
    "Karmayogi",
    "skill intelligence",
    "government workforce",
    "competency",
    "capacity building",
  ],
  authors: [{ name: "Saksham" }],
  icons: {
    icon: "/logo-outline.png",
  },
  openGraph: {
    title: "Saksham — Skill Intelligence",
    description:
      "Skill intelligence for a future-ready government workforce, built to work alongside iGOT.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="light">
          <A11yProvider>
            <LanguageProvider>{children}</LanguageProvider>
            <Toaster />
            <ServiceWorkerRegister />
          </A11yProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
