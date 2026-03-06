import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Timer Counter",
    description: "Labelled pomodoro timers with attached counters",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="bg-slate-800 min-h-screen">{children}</body>
        </html>
    );
}
