import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Onboarding Scheduler",
  description: "Create a new-hire onboarding calendar in Outlook",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
