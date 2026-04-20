import type { Metadata } from "next";
import { IBM_Plex_Sans, Newsreader, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body-google",
});

const editorialFont = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
  variable: "--font-editorial-google",
});

const labelFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-label-google",
});

export const metadata: Metadata = {
  title: "Conversation Lab",
  description:
    "MVP para conversar con un LLM, mapear slices hacia DSPy y exportar dataset examples en JSONL.",
};

const themeInitScript = `
  (() => {
    try {
      const storedTheme = window.localStorage.getItem("conversation-lab-theme");
      const resolvedTheme =
        storedTheme === "dark" || storedTheme === "light"
          ? storedTheme
          : window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";

      document.documentElement.dataset.theme = resolvedTheme;
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${bodyFont.variable} ${editorialFont.variable} ${labelFont.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="h-full">
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
