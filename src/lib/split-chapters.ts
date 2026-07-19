export type Chapter = { title: string; body: string };

export function splitChapters(text: string, fallbackTitle = "本文"): Chapter[] {
  const src = text.replace(/\r\n?/g, "\n").trim();
  if (!src) return [];

  // Markdown-style headings: lines starting with "# "
  if (/^#\s+.+/m.test(src)) {
    const parts: Chapter[] = [];
    const regex = /^#\s+(.+)$/gm;
    const matches: { title: string; index: number; length: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(src))) {
      matches.push({ title: m[1].trim(), index: m.index, length: m[0].length });
    }
    // Any prelude before the first heading
    if (matches[0]!.index > 0) {
      const pre = src.slice(0, matches[0]!.index).trim();
      if (pre) parts.push({ title: fallbackTitle, body: pre });
    }
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i]!.index + matches[i]!.length;
      const end = i + 1 < matches.length ? matches[i + 1]!.index : src.length;
      parts.push({
        title: matches[i]!.title,
        body: src.slice(start, end).trim(),
      });
    }
    return parts.filter((c) => c.body);
  }

  return [{ title: fallbackTitle, body: src }];
}
