import { ImageResponse } from "next/og";

// The picture shown when a Karobar360 link is shared on WhatsApp, LinkedIn or X.
export const alt = "Karobar360: software that runs your way";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const bar = (h: number, color: string) => <div style={{ width: 34, height: h, borderRadius: 9, background: color }} />;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#0f1412", color: "#e9ede9" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          {bar(70, "#e9ede9")}
          {bar(100, "rgba(233,237,233,0.75)")}
          {bar(120, "#3cc08c")}
          <div style={{ marginLeft: 24, fontSize: 56, fontWeight: 700, letterSpacing: -1.5 }}>Karobar360</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 92, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>Software that runs your way.</div>
          <div style={{ fontSize: 36, color: "rgba(233,237,233,0.7)" }}>Sales, cash, stock, staff, payroll and GST on one screen, in English or Hindi.</div>
        </div>
      </div>
    ),
    size,
  );
}
