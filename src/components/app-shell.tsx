"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSessionChatRoute = /^\/projects\/[^/]+\/sessions\/[^/]+$/.test(pathname);

  return (
    <ToastProvider>
      <div className="flex h-dvh min-h-screen flex-col overflow-hidden bg-transparent text-foreground">
        <header className="theme-header sticky top-0 z-20 backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <div>
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Conversation Lab
              </Link>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Source cases, typed artifacts, task projections, and reviewable derived examples.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <ThemeToggle />
              <nav className="flex items-center gap-3 text-sm font-medium">
                <Link href="/" className="button-secondary">
                  Projects
                </Link>
                <Link href="/cases" className="button-secondary">
                  Case Library
                </Link>
                <Link href="/tasks" className="button-secondary">
                  Task Catalog
                </Link>
                <Link href="/session-tags" className="button-secondary">
                  Session Tags
                </Link>
                <Link href="/exports" className="button-secondary">
                  Export Hub
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-x-hidden",
            isSessionChatRoute
              ? "w-full overflow-hidden px-0 py-0"
              : "mx-auto w-full max-w-7xl overflow-y-auto px-4 py-6 sm:px-6 sm:py-7 lg:px-8 lg:py-8",
          )}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
