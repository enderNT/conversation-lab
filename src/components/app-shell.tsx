"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Projects" },
  { href: "/dataset-examples", label: "Dataset Examples" },
  { href: "/dataset-specs", label: "Dataset Specs" },
  { href: "/session-tags", label: "Session Tags" },
  { href: "/exports", label: "Export Hub" },
] as const;

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSessionChatRoute = /^\/projects\/[^/]+\/sessions\/[^/]+$/.test(pathname);

  return (
    <ToastProvider>
      <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-transparent text-foreground">
        <header className="theme-header sticky top-0 z-20 backdrop-blur-xl">
          <div className="mx-auto grid w-full max-w-[90rem] grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:px-8">
            <div className="min-w-0">
              <Link href="/" className="editorial-heading text-[2rem] leading-none text-[var(--foreground)]">
                Conversation Lab
              </Link>
              <p className="mt-1 text-[0.68rem] uppercase tracking-[0.28em] text-[var(--muted)]">
                The digital archivist protocol
              </p>
            </div>
            <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm font-medium lg:justify-center">
              {NAV_ITEMS.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative rounded-full px-3 py-2 transition-colors",
                      isActive
                        ? "text-[var(--accent)]"
                        : "text-[var(--muted-strong)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {item.label}
                    {isActive ? (
                      <span className="absolute inset-x-3 bottom-0 h-px bg-[var(--accent)]" aria-hidden="true" />
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <div className="flex justify-start lg:justify-end">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden",
            isSessionChatRoute
              ? "w-full overflow-hidden px-0 py-0"
              : "mx-auto w-full max-w-[90rem] overflow-y-auto px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-10",
          )}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
