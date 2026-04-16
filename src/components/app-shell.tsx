import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ToastProvider } from "@/components/toast-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-transparent text-foreground">
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
                <Link href="/exports" className="button-secondary">
                  Export Hub
                </Link>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}