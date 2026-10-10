import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "카드 맞추기 게임",
  description: "동일한 카드 맞추기 기억력 게임 by Haesol",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
