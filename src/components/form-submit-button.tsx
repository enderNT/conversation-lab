"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
};

export function FormSubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={pending || disabled}>
      {pending ? pendingLabel ?? "Saving..." : children}
    </button>
  );
}