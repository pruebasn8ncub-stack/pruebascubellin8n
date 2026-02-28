import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InnovaKine | Centro Clínico y Agendamiento",
  description: "Agenda tu hora médica y accede a nuestros servicios de salud integral con los mejores especialistas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${outfit.variable} antialiased bg-[var(--bg-main)] text-[var(--text)] font-sans`}>
        {children}
      </body>
    </html>
  );
}
