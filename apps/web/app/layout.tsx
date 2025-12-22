import type { Metadata } from "next";
import "./globals.css";
import { AdminProvider } from "@/contexts/AdminContext";
import { AdminLogin } from "@/components/AdminLogin";
import { SqlQueryPanel } from "@/components/SqlQueryPanel";

export const metadata: Metadata = {
  title: "F1 Pro - Advanced Telemetry & Analytics",
  description: "Professional F1 data analysis, telemetry visualization, and race predictions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Titillium+Web:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <AdminProvider>
          {/* SQL Query Panel for Admins */}
          <SqlQueryPanel />
          {children}
        </AdminProvider>
      </body>
    </html>
  );
}
