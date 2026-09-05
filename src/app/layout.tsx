import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentReady — Safe AI-buyable commerce",
  description: "A deterministic policy firewall for agentic commerce on Razorpay."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
