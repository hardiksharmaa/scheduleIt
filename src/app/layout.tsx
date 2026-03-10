import type { Metadata } from "next";
import { Arvo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const arvo = Arvo({
  weight: ["400", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-arvo",
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
    <html lang="en" className={arvo.variable}>
      <body className="antialiased"><Providers>{children}</Providers></body>
    </html>
  );
}
