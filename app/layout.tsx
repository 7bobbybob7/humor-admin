import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Nav } from "./nav";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Humor Project · Admin",
  description: "Admin console for the Humor Project database.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body
        // Browser extensions (Grammarly and similar) inject attributes into
        // <body> before React hydrates, which reports as a hydration mismatch
        // that no change to our markup can fix.
        suppressHydrationWarning
        className="flex min-h-full flex-col bg-paper text-ink"
      >
        <Nav />
        {children}
      </body>
    </html>
  );
}
