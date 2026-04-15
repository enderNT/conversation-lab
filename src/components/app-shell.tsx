import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-transparent text-foreground">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[rgba(246,241,232,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Conversation Lab
            </Link>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Source cases, typed artifacts, task projections, and reviewable derived examples.
            </p>
          </div>
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
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}