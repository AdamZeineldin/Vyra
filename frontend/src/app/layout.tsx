import type { Metadata } from "next";
import localFont from "next/font/local";
import { ProjectSidebar } from "@/components/layout/project-sidebar";
import { SessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Vyra",
  description: "Multi-model iterative code generation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <div className="flex h-screen overflow-hidden">
            <ProjectSidebar />
            <main className="flex-1 overflow-auto">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
