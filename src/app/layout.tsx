import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trajectory Arena",
    template: "%s · Trajectory Arena",
  },
  description: "Import, replay, and evaluate validated agentic coding trajectories.",
  applicationName: "Trajectory Arena",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
