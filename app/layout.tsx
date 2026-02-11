import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ClientLayout } from "@/components/ClientLayout";
import { AnalyticsProvider } from "@/lib/analytics";

export const metadata: Metadata = {
  title: "Mappico",
  description: "Mappico MVP Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AnalyticsProvider>
          <ClientLayout>
            <Navigation />
            {children}
          </ClientLayout>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
