import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ميزانيتي", description: "إدارة الدخل والمصروفات والديون والميزانيات.", icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/apple-icon" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }
