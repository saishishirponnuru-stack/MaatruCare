import type { Metadata } from "next";
import "./globals.css";
import { MaatruCareDemoProvider } from "@/context/MaatruCareDemoContext";

export const metadata: Metadata = {
  title: "MaatruCare — The Coordination Layer for Motherhood",
  description:
    "Patient-controlled care coordination from preconception to postnatal care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><MaatruCareDemoProvider>{children}</MaatruCareDemoProvider></body>
    </html>
  );
}