import { useEffect, useState } from "react";
import { CONFIG } from "../config";

export type BuildStatus = "idle" | "queued" | "building" | "success" | "failed" | "error";

export type BuildStatusDetails = {
  jobId: number;
  status: BuildStatus;
  urls?: {
    html?: string | null;
    artifacts?: string | null;
  };
  raw?: any;
};

const POLL_INTERVAL_MS = 6000;

export function useBuildStatus(jobIdFromScreen?: number | null) {
  const [status, setStatus] = useState<BuildStatus>("idle");
  const [details, setDetails] = useState<BuildStatusDetails | null>(null);

  useEffect(() => {
    if (!jobIdFromScreen) {
      setStatus("idle");
      setDetails(null);
      return;
    }

    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const res = await fetch(
          `${CONFIG.API.SUPABASE_EDGE_URL}/check-eas-build`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId: jobIdFromScreen }),
          }
        );

        const json = await res.json().catch(() => null);

        if (!isMounted) return;

        if (!res.ok || !json || json.ok === false) {
          console.log("[useBuildStatus] Error response:", json);
          setStatus("error");
          return;
        }

        const rawStatus = (json.status || "").toString().toLowerCase();

        let mapped: BuildStatus = "idle";
        switch (rawStatus) {
          case "queued":
          case "pending":
            mapped = "queued";
            break;
          case "building":
          case "in_progress":
            mapped = "building";
            break;
          case "success":
          case "completed":
            mapped = "success";
            break;
          case "failed":
          case "error":
            mapped = "failed";
            break;
          default:
            mapped = "idle";
            break;
        }

        setStatus(mapped);
        setDetails({
          jobId: jobIdFromScreen,
          status: mapped,
          urls: json.urls ?? undefined,
          raw: json,
        });
      } catch (e) {
        if (!isMounted) return;
        console.log("[useBuildStatus] Poll error:", e);
        setStatus("error");
      }
    };

    // sofort einmal pollen
    poll();
    interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [jobIdFromScreen]);

  return { status, details };
}
