import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PAPS 학생 기록 시스템",
  description: "교사 세션 운영과 학생 기록 입력을 위한 PAPS MVP",
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
