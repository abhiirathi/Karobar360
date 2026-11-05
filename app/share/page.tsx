"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LZ from "lz-string";
import type { Blueprint } from "@/lib/types";
import { saveWorkspace } from "@/lib/store";

export default function Share() {
  const router = useRouter();
  const [err, setErr] = useState("");
  useEffect(() => {
    try {
      const code = window.location.hash.slice(1);
      const bp = JSON.parse(LZ.decompressFromEncodedURIComponent(code) || "null") as Blueprint | null;
      if (!bp?.id || !bp.intake) throw new Error("bad");
      saveWorkspace(bp);
      router.replace(`/w/${encodeURIComponent(bp.id)}`);
    } catch {
      setErr("This share link is incomplete or damaged. Ask the sender to copy it again.");
    }
  }, [router]);
  return <div className="flex min-h-screen items-center justify-center px-6 text-center text-ink-2">{err || <span className="live-dot">Opening shared dashboard…</span>}</div>;
}
