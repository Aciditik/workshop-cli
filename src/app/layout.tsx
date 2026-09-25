import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { prototype } from "@/lib/fonts";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CdF Terraforming Mars",
  description: "Gestion de tournois CdF Terraforming Mars",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${prototype.variable} ${inter.className}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
