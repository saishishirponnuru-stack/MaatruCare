import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { LocalSettingsProvider } from "@/context/LocalSettingsContext";
import { AuthProvider } from "@/context/AuthContext";
import AuthenticatedProviders from "@/components/auth/AuthenticatedProviders";

export const metadata: Metadata = {
  title: "MaatruCare — The Coordination Layer for Motherhood",
  description:
    "Maternal care coordination from preconception to postnatal care.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <LocalSettingsProvider>
            <PreferencesProvider>
              <AuthenticatedProviders>{children}</AuthenticatedProviders>
            </PreferencesProvider>
          </LocalSettingsProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
