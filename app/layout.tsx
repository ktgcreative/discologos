import type { Metadata } from "next";
import { PageViewAnalytics } from "@/components/analytics";
import "./globals.css";

export const metadata: Metadata = {
  title: "Discologos",
  description: "Interactive disco logo cubes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PageViewAnalytics />
      </body>
    </html>
  );
}
