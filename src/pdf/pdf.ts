import type { PdfLine } from '../domain/export';

/*
 * A PDF written in code, no library («бета 0.81» `buildPDF`; brief, Export:
 * not the print dialog, which is unreliable in an installed iPhone app).
 * A4, Noto Sans Mono embedded as CID fonts (Identity-H), so Cyrillic renders
 * on any phone. The font data (noto-sans-mono-pdf.json) is 0.81's: subsets of
 * Noto Sans Mono 2.014 Regular and Bold (Latin, Cyrillic with Ґ, punctuation,
 * ₴, №, arrows), OFL 1.1 (public/fonts/OFL-NotoSansMono.txt).
 */

export interface PdfFont {
  /** The TrueType file, base64. */
  readonly ttf: string;
  /** Code point → glyph id. */
  readonly cmap: Readonly<Record<string, number>>;
  /** Glyphs wider than the monospace 600. */
  readonly wide: Readonly<Record<string, number>>;
  readonly bbox: readonly number[];
  readonly asc: number;
  readonly desc: number;
  readonly cap: number;
}

export interface PdfFonts {
  readonly R: PdfFont;
  readonly B: PdfFont;
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 42;
/** Noto Sans Mono's advance: 600 of 1000. */
const CHAR_W = 0.6;
const LEADING = 1.35;
const QUESTION = 63;
/** Letters the font lacks, drawn with a look-alike it has. */
const LOOK_ALIKE: Readonly<Record<number, number>> = { 0x2bc: 0x2019 };

const hex4 = (n: number) => n.toString(16).padStart(4, '0');

/** Splits a line at spaces to fit `max` letters; a longer word is cut. */
export function wrapLine(text: string, max: number): string[] {
  const rows: string[] = [];
  let row: string[] = [];
  for (const word of text.split(' ')) {
    let letters = [...word];
    if (letters.length > max) {
      if (row.length) rows.push(row.join(''));
      for (; letters.length > max; letters = letters.slice(max)) rows.push(letters.slice(0, max).join(''));
      row = letters;
      continue;
    }
    const next = row.length ? [...row, ' ', ...letters] : letters;
    if (next.length > max) {
      rows.push(row.join(''));
      row = letters;
    } else row = next;
  }
  rows.push(row.join(''));
  return rows;
}

/** One font as it is used: glyph ids for the text and the letters each glyph shows. */
class FontUse {
  readonly shown = new Map<number, number>();

  constructor(readonly font: PdfFont) {}

  glyph(codePoint: number): number {
    const own = this.font.cmap[codePoint];
    const alike = LOOK_ALIKE[codePoint];
    const [point, id] = own !== undefined ? [codePoint, own]
      : alike !== undefined && this.font.cmap[alike] !== undefined ? [alike, this.font.cmap[alike]]
        : [QUESTION, this.font.cmap[QUESTION]!];
    this.shown.set(id, point);
    return id;
  }

  hex(text: string): string {
    return [...text].map((ch) => hex4(this.glyph(ch.codePointAt(0)!))).join('');
  }
}

/** Lays the lines out on A4 pages: each page is a list of text operators. */
function layOut(lines: readonly PdfLine[], fonts: readonly FontUse[]): string[][] {
  const pages: string[][] = [[]];
  let y = PAGE_H - MARGIN;
  for (const line of lines) {
    const max = Math.max(10, Math.floor((PAGE_W - 2 * MARGIN - line.indent) / (line.size * CHAR_W)));
    const height = line.size * LEADING;
    const f = line.bold ? 1 : 0;
    for (const row of wrapLine(line.text, max)) {
      if (y - height < MARGIN) {
        pages.push([]);
        y = PAGE_H - MARGIN;
      }
      y -= height;
      if (row) pages.at(-1)!.push(`BT /F${f + 1} ${line.size} Tf ${(MARGIN + line.indent).toFixed(2)} ${y.toFixed(2)} Td <${fonts[f]!.hex(row)}> Tj ET`);
    }
  }
  return pages;
}

function bytesOf(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
}

function toUnicode(shown: ReadonlyMap<number, number>): string {
  const ids = [...shown.keys()].sort((a, b) => a - b);
  const groups: string[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const part = ids.slice(i, i + 100);
    // UTF-16, as ToUnicode wants it
    const pairs = part.map((id) => `<${hex4(id)}> <${String.fromCodePoint(shown.get(id)!).split('').map((unit) => hex4(unit.charCodeAt(0))).join('')}>`);
    groups.push(`${part.length} beginbfchar\n${pairs.join('\n')}\nendbfchar\n`);
  }
  return '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n'
    + '/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n'
    + `1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n${groups.join('')}endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`;
}

/** Writes numbered objects and remembers where each starts, for the cross-reference table. */
class Writer {
  private readonly chunks: Uint8Array[] = [];
  private readonly encoder = new TextEncoder();
  readonly offsets: number[] = [];
  size = 0;

  write(part: string | Uint8Array): void {
    const bytes = typeof part === 'string' ? this.encoder.encode(part) : part;
    this.chunks.push(bytes);
    this.size += bytes.length;
  }

  object(n: number, body: string): void {
    this.offsets[n] = this.size;
    this.write(`${n} 0 obj\n${body}\nendobj\n`);
  }

  stream(n: number, dict: string, data: string | Uint8Array): void {
    const bytes = typeof data === 'string' ? this.encoder.encode(data) : data;
    this.offsets[n] = this.size;
    this.write(`${n} 0 obj\n<< /Length ${bytes.length}${dict} >>\nstream\n`);
    this.write(bytes);
    this.write('\nendstream\nendobj\n');
  }

  bytes(): Uint8Array<ArrayBuffer> {
    const all = new Uint8Array(this.size);
    this.chunks.reduce((at, chunk) => {
      all.set(chunk, at);
      return at + chunk.length;
    }, 0);
    return all;
  }
}

/** Objects 3–7 (regular) or 8–12 (bold): type 0 font, CID font, descriptor, file, ToUnicode. */
function writeFont(out: Writer, n: number, use: FontUse, bold: boolean): void {
  const { font } = use;
  const name = bold ? 'NotoSansMono-Bold' : 'NotoSansMono';
  const wide = [...use.shown.keys()].filter((id) => font.wide[id] !== undefined).map((id) => `${id} [${font.wide[id]}]`).join(' ');
  const file = bytesOf(font.ttf);
  out.object(n, `<< /Type /Font /Subtype /Type0 /BaseFont /${name} /Encoding /Identity-H /DescendantFonts [${n + 1} 0 R] /ToUnicode ${n + 4} 0 R >>`);
  out.object(n + 1, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> `
    + `/FontDescriptor ${n + 2} 0 R /DW 600 ${wide ? `/W [${wide}] ` : ''}/CIDToGIDMap /Identity >>`);
  out.object(n + 2, `<< /Type /FontDescriptor /FontName /${name} /Flags 5 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 `
    + `/Ascent ${font.asc} /Descent ${font.desc} /CapHeight ${font.cap} /StemV ${bold ? 120 : 80} /FontFile2 ${n + 3} 0 R >>`);
  out.stream(n + 3, ` /Length1 ${file.length}`, file);
  out.stream(n + 4, '', toUnicode(use.shown));
}

/**
 * The whole file. Objects: 1 catalog, 2 page list, 3–12 the two fonts,
 * then a page and its content for each page.
 */
export function buildPdf(lines: readonly PdfLine[], fonts: PdfFonts): Uint8Array<ArrayBuffer> {
  const uses = [new FontUse(fonts.R), new FontUse(fonts.B)];
  const pages = layOut(lines, uses);
  const first = 13;
  const out = new Writer();
  out.write('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  out.object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  out.object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${first + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  uses.forEach((use, i) => writeFont(out, 3 + i * 5, use, i === 1));
  pages.forEach((page, i) => {
    const n = first + i * 2;
    out.object(n, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 8 0 R >> >> /Contents ${n + 1} 0 R >>`);
    out.stream(n + 1, '', page.join('\n'));
  });
  const total = first + pages.length * 2;
  const xref = out.size;
  const rows = out.offsets.slice(1, total).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out.write(`xref\n0 ${total}\n0000000000 65535 f \n${rows}trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return out.bytes();
}
