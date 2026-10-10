import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "ميزانيتي | النظام المالي الشخصي", description: "إدارة الدخل والمصروفات والديون والميزانيات.", icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="ar" dir="rtl"><body>{children}</body></html>; }
