export function cleanMarkdown(md: string): string {
  return md
    .replace(/^[ \t]*[-·][ \t]*$/gm, "")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
