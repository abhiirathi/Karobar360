/** Photos and documents are stored as "file:<id>" in a company account, or as data URLs in the demo. */
export function fileSrc(p: string) {
  return p?.startsWith("file:") ? `/api/stone/file/${p.slice(5)}` : p;
}
