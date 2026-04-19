import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyCaseCreationRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sessionId: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const { projectId, sessionId } = await params;
  const resolvedSearchParams = await searchParams;
  const paramsString = new URLSearchParams();

  if (resolvedSearchParams.start) {
    paramsString.set("start", resolvedSearchParams.start);
  }

  if (resolvedSearchParams.end) {
    paramsString.set("end", resolvedSearchParams.end);
  }

  redirect(
    `/projects/${projectId}/sessions/${sessionId}/dataset/new${
      paramsString.size ? `?${paramsString.toString()}` : ""
    }`,
  );
}
