import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ThinkPath",
  description: "Platform integritas akademik berbasis bukti untuk guru.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${body.variable} ${display.variable} font-body`}>
        {children}
      </body>
    </html>
  );
}
