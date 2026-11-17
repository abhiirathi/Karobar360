// The Karobar360 app icon (three bars on dark), drawn for next/og at any size.
// `pad` shrinks the bars for maskable icons, whose edges Android may crop into a circle.
export function AppIconArt({ size, pad = 0.18, round = true }: { size: number; pad?: number; round?: boolean }) {
  const inner = size * (1 - pad * 2);
  const w = inner * 0.24;
  const gap = (inner - w * 3) / 2;
  const bar = (h: number, color: string, opacity = 1) => (
    <div style={{ width: w, height: inner * h, borderRadius: w * 0.3, background: color, opacity }} />
  );
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "#111412", borderRadius: round ? size * 0.22 : 0 }}>
      <div style={{ width: inner, height: inner, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap }}>
        {bar(0.55, "#eef0ec")}
        {bar(0.8, "#eef0ec", 0.75)}
        {bar(1, "#3cc08c")}
      </div>
    </div>
  );
}
