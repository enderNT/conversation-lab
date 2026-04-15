import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FormLabel({
  children,
  required = false,
  className,
}: {
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("text-sm font-medium", className)}>
      {children}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </span>
  );
}