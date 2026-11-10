import { describe, expect, it } from 'vitest';
import type { PdfLine } from '../domain/export';
import FONTS from './noto-sans-mono-pdf.json';
import { buildPdf, wrapLine, type PdfFonts } from './pdf';

const line = (text: string, more: Partial<PdfLine> = {}): PdfLine => ({ text, size: 10, bold: false, indent: 0, ...more });
/** One character per byte (TextDecoder's «latin1» is windows-1252, which changes 0x80–0x9F). */
const latin1 = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');
const fonts = FONTS as PdfFonts;
const gid = (ch: string, f: 'R' | 'B' = 'R') => fonts[f].cmap[String(ch.codePointAt(0))]!.toString(16).padStart(4, '0');

/** The text drawing operators of the file, in order. */
const drawn = (pdf: string) => [...pdf.matchAll(/BT \/F(\d) ([\d.]+) Tf ([\d.]+) ([\d.]+) Td <([0-9a-f]*)> Tj ET/g)]
  .map(([, font, size, x, y, hex]) => ({ font: Number(font), size: Number(size), x: Number(x), y: Number(y), hex: hex! }));

describe('buildPdf', () => {
  it('writes a PDF whose cross-reference table points at every object', () => {
    const pdf = latin1(buildPdf([line('привіт')], fonts));
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf.endsWith('%%EOF')).toBe(true);
    const start = Number(pdf.match(/startxref\n(\d+)\n%%EOF$/)![1]);
    expect(pdf.slice(start, start + 4)).toBe('xref');
    const offsets = pdf.slice(start).match(/^\d{10} 00000 n $/gm)!.map((row) => Number(row.slice(0, 10)));
    expect(offsets).toHaveLength(14);
    offsets.forEach((offset, i) => expect(pdf.slice(offset).startsWith(`${i + 1} 0 obj\n`)).toBe(true));
    expect(pdf).toContain('/Size 15 /Root 1 0 R');
  });

  it('draws Cyrillic with the embedded font, glyph by glyph', () => {
    const pdf = latin1(buildPdf([line('ґа')], fonts));
    expect(drawn(pdf)[0]!.hex).toBe(gid('ґ') + gid('а'));
    expect(pdf).toContain('/BaseFont /NotoSansMono /Encoding /Identity-H');
    expect(pdf).toContain(`/Length ${atob(fonts.R.ttf).length} /Length1 ${atob(fonts.R.ttf).length}`);
  });

  it('lets copied text come out as typed (ToUnicode)', () => {
    const pdf = latin1(buildPdf([line('є')], fonts));
    expect(pdf).toContain(`<${gid('є')}> <0454>`);
  });

  it('draws the Ukrainian apostrophe ʼ as ’ and ? for what the font lacks; copying gives what is drawn', () => {
    const pdf = latin1(buildPdf([line('мʼяч 🙂')], fonts));
    expect(drawn(pdf)[0]!.hex).toBe([...'м’яч ?'].map((ch) => gid(ch)).join(''));
    expect(pdf).toContain(`<${gid('’')}> <2019>`);
    expect(pdf).toContain(`<${gid('?')}> <003f>`);
  });

  it('puts bold lines in the second font, at their size and indent, from the top of an A4 page', () => {
    const pdf = latin1(buildPdf([line('а', { bold: true, size: 16 }), line('б', { indent: 12, size: 9.5 })], fonts));
    const [title, row] = drawn(pdf);
    expect(title).toEqual({ font: 2, size: 16, x: 42, y: 778.29, hex: gid('а', 'B') });
    expect(row).toMatchObject({ font: 1, size: 9.5, x: 54 });
    expect(row!.y).toBeCloseTo(778.29 - 9.5 * 1.35, 1);
    expect(pdf).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(pdf).toContain('/BaseFont /NotoSansMono-Bold');
  });

  it('gives a blank line its height without drawing it', () => {
    const pdf = latin1(buildPdf([line('а'), line('', { size: 6 }), line('б')], fonts));
    const [a, b] = drawn(pdf);
    expect(drawn(pdf)).toHaveLength(2);
    expect(a!.y - b!.y).toBeCloseTo(6 * 1.35 + 10 * 1.35, 2);
  });

  it('starts a new page when the page is full', () => {
    const pdf = latin1(buildPdf(Array.from({ length: 60 }, (_, i) => line(`рядок ${i}`)), fonts));
    expect(pdf).toContain('/Count 2');
    const ys = drawn(pdf).map((d) => d.y);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(42);
    expect(ys.filter((y) => y === 786.39)).toHaveLength(2);
  });

  it('lists only the wide glyphs it uses', () => {
    const wide = Object.keys(fonts.R.wide)[0]!;
    const ch = String.fromCodePoint(Number(Object.entries(fonts.R.cmap).find(([, g]) => String(g) === wide)![0]));
    expect(latin1(buildPdf([line('а')], fonts))).not.toContain('/W [');
    expect(latin1(buildPdf([line(ch)], fonts))).toContain(`/W [${wide} [${fonts.R.wide[wide]}]]`);
  });

  it('splits the ToUnicode map into groups of 100', () => {
    const pdf = latin1(buildPdf([line('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZабвгґдеєжзиіїйклмнопрстуфхцчшщьюяАБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ0123456789')], fonts));
    expect(pdf).toContain('100 beginbfchar');
  });
});

/** The file's objects by number, as a reader finds them. */
function objects(pdf: string): Map<number, string> {
  return new Map([...pdf.matchAll(/^(\d+) 0 obj\n([\s\S]*?)\nendobj$/gm)].map(([, n, body]) => [Number(n), body!]));
}
const ref = (body: string, key: string) => Number(body.match(new RegExp(`/${key} \\[?(\\d+) 0 R`))![1]);
const streamOf = (body: string) => body.slice(body.indexOf('stream\n') + 7, body.lastIndexOf('\nendstream'));

describe('buildPdf structure', () => {
  const lines = Array.from({ length: 60 }, (_, i) => line(`рядок ${i}`, { bold: i === 0 }));
  const pdf = latin1(buildPdf(lines, fonts));
  const objs = objects(pdf);
  const at = (n: number) => objs.get(n)!;

  it('leads from the catalog to every page and its text', () => {
    const pages = at(ref(at(1), 'Pages'));
    const kids = [...pages.match(/\/Kids \[([^\]]*)\]/)![1]!.matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
    expect(kids).toHaveLength(2);
    const contents = kids.map((kid) => {
      expect(at(kid)).toContain('/Type /Page /Parent 2 0 R');
      return streamOf(at(ref(at(kid), 'Contents')));
    });
    expect(contents[0]).toContain(`<${[...'рядок 0'].map((ch) => gid(ch, 'B')).join('')}>`);
    expect(contents[1]).toContain(`<${[...'рядок 59'].map((ch) => gid(ch)).join('')}>`);
    expect(contents[0]).not.toContain(`<${[...'рядок 59'].map((ch) => gid(ch)).join('')}>`);
  });

  it('leads from each page font to its descriptor, its file and its ToUnicode map', () => {
    const page = at(ref(at(2), 'Kids'));
    [['F1', 'NotoSansMono', 80, fonts.R], ['F2', 'NotoSansMono-Bold', 120, fonts.B]].forEach(([key, name, stem, font]) => {
      const type0 = at(ref(page, key as string));
      expect(type0).toContain(`/Subtype /Type0 /BaseFont /${name} `);
      const cid = at(ref(type0, 'DescendantFonts'));
      expect(cid).toContain(`/Subtype /CIDFontType2 /BaseFont /${name} `);
      const descriptor = at(ref(cid, 'FontDescriptor'));
      const f = font as typeof fonts.R;
      expect(descriptor).toContain(`/FontName /${name} /Flags 5 /FontBBox [${f.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${f.asc} /Descent ${f.desc} /CapHeight ${f.cap} /StemV ${stem} `);
      expect(streamOf(at(ref(descriptor, 'FontFile2')))).toBe(atob(f.ttf));
      const map = streamOf(at(ref(type0, 'ToUnicode')));
      expect(map).toMatch(/^\/CIDInit \/ProcSet findresource begin\n12 dict begin\nbegincmap\n\/CIDSystemInfo << \/Registry \(Adobe\) \/Ordering \(UCS\) \/Supplement 0 >> def\n\/CMapName \/Adobe-Identity-UCS def\n\/CMapType 2 def\n1 begincodespacerange\n/);
    });
  });

  it('lists the glyphs of the ToUnicode map in order', () => {
    const map = streamOf(at(ref(at(3), 'ToUnicode')));
    const ids = [...map.matchAll(/^<([0-9a-f]{4})> </gm)].map((m) => parseInt(m[1]!, 16));
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    expect(ids.length).toBeGreaterThan(5);
  });

  it('has one cross-reference row per object, and no more', () => {
    const table = pdf.slice(pdf.lastIndexOf('\nxref\n'), pdf.indexOf('trailer'));
    // «xref», «0 17», then the free entry and objects 1–16
    expect(table.split('\n').filter(Boolean)).toHaveLength(2 + 17);
  });

  it('makes no empty group in a ToUnicode map of exactly 100 glyphs', () => {
    const hundred = Object.keys(fonts.R.cmap).map(Number).filter((cp) => cp > 32).slice(0, 100).map((cp) => String.fromCodePoint(cp)).join('');
    const map = latin1(buildPdf([line(hundred, { size: 1 })], fonts));
    expect(map.match(/beginbfchar/g)).toHaveLength(1);
  });

  it('draws ? when even the look-alike is missing', () => {
    const { [String(0x2019)]: _, ...cmap } = fonts.R.cmap;
    const bare = latin1(buildPdf([line('ʼ')], { ...fonts, R: { ...fonts.R, cmap } }));
    expect(drawn(bare)[0]!.hex).toBe(gid('?'));
  });

  it('fills a line to the page width at its size and indent', () => {
    const rows = (l: PdfLine) => drawn(latin1(buildPdf([l], fonts))).map((d) => d.hex.length / 4);
    expect(rows(line('а'.repeat(170)))).toEqual([85, 85]);
    expect(rows(line('а'.repeat(100), { size: 9.5, indent: 12 }))).toEqual([87, 13]);
  });
});

describe('wrapLine', () => {
  it('keeps a word exactly as long as the line', () => {
    expect(wrapLine('абвгд', 5)).toEqual(['абвгд']);
    expect(wrapLine('а абвгд', 5)).toEqual(['а', 'абвгд']);
    expect(wrapLine('абвгдеєжзи', 5)).toEqual(['абвгд', 'еєжзи']);
  });

  it('breaks at spaces to fit the width', () => {
    expect(wrapLine('один два три чотири', 9)).toEqual(['один два', 'три', 'чотири']);
  });

  it('cuts a word longer than the line', () => {
    expect(wrapLine('https://example.com/довге', 10)).toEqual(['https://ex', 'ample.com/', 'довге']);
    expect(wrapLine('аб ввввввввввввв', 5)).toEqual(['аб', 'ввввв', 'ввввв', 'ввв']);
  });

  it('counts letters, not code units', () => {
    expect(wrapLine('🙂🙂🙂 а', 5)).toEqual(['🙂🙂🙂 а']);
  });

  it('keeps an empty line', () => {
    expect(wrapLine('', 10)).toEqual(['']);
  });
});
