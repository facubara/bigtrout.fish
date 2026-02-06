import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Big Trout Fish",
  description:
    "Watch 12,000+ token holders swim as pixel-art trouts. Find your trout, name it, and climb the leaderboard.",
  openGraph: {
    title: "Big Trout Fish",
    description: "Watch token holders swim as pixel-art trouts.",
    url: "https://bigtrout.fish",
    siteName: "Big Trout Fish",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Big Trout Fish",
    description: "Watch token holders swim as pixel-art trouts.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
