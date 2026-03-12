import type { Metadata } from "next";
import { Bebas_Neue, Inter, Oswald } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-oswald",
  display: "swap",
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ScheduleIt — Smart Appointment Scheduling",
  description:
    "Create scheduling links, share booking pages, and automatically schedule meetings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${oswald.variable} ${bebasNeue.variable}`}>
      <body className="antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
