import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WAR ROOM DASHBOARD",
  description: "Central de Inteligencia da Empresa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
