import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { ClientLayout } from "@/components/ClientLayout";

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
        <ClientLayout>
          <Navigation />
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
