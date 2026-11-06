import type { Metadata } from "next";
import "./globals.css";
import { MaatruCareDemoProvider } from "@/context/MaatruCareDemoContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { LocalSettingsProvider } from "@/context/LocalSettingsContext";

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
      <body>
        <LocalSettingsProvider>
          <PreferencesProvider>
            <MaatruCareDemoProvider>{children}</MaatruCareDemoProvider>
          </PreferencesProvider>
        </LocalSettingsProvider>
      </body>
    </html>
  );
}
