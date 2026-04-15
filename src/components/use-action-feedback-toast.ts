"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionFormState } from "@/lib/form-state";
import { useToast } from "@/components/toast-provider";

export function useActionFeedbackToast(
  state: ActionFormState,
  options: {
    errorTitle: string;
    successTitle: string;
  },
) {
  const router = useRouter();
  const { pushToast } = useToast();

  useEffect(() => {
    if (!state.eventId || !state.message || state.status === "idle") {
      return;
    }

    if (state.status === "error") {
      pushToast({
        title: options.errorTitle,
        description: state.message,
        variant: "error",
        durationMs: 7000,
      });

      return;
    }

    pushToast({
      title: options.successTitle,
      description: state.message,
      variant: "success",
      durationMs: 7000,
    });

    const redirectTo = state.redirectTo;

    if (!redirectTo) {
      if (state.shouldRefresh) {
        startTransition(() => {
          router.refresh();
        });
      }

      return;
    }

    startTransition(() => {
      if (state.navigationMode === "replace") {
        router.replace(redirectTo);
        return;
      }

      router.push(redirectTo);
    });
  }, [options.errorTitle, options.successTitle, pushToast, router, state.eventId, state.message, state.navigationMode, state.redirectTo, state.shouldRefresh, state.status]);
}