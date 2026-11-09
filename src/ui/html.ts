const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Text from the settings or the log, safe inside HTML text and quoted attributes. */
export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char]!);
}
