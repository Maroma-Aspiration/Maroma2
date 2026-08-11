import React from "react";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampFloat(raw: string | null, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const src = url.searchParams.get("src")?.trim() ?? "";
  if (!/^https?:\/\//i.test(src)) {
    return new Response("Missing or invalid src", { status: 400 });
  }

  const width = clampInt(url.searchParams.get("w"), 600, 16, 2400);
  const height = clampInt(url.searchParams.get("h"), 320, 16, 2400);
  const offsetX = clampFloat(url.searchParams.get("ox"), 0, -2000, 2000);
  const offsetY = clampFloat(url.searchParams.get("oy"), 0, -2000, 2000);
  const zoom = clampFloat(url.searchParams.get("zoom"), 1, 0.2, 5);
  const fit = url.searchParams.get("fit") === "contain" ? "contain" : "cover";

  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        },
      },
      React.createElement("img", {
        src,
        alt: "",
        width,
        height,
        style: {
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: fit,
          objectPosition: "center center",
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
          transformOrigin: "center center",
        },
      })
    ),
    {
      width,
      height,
    }
  );
}
