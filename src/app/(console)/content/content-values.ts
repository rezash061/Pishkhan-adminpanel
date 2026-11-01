import type { ContentBlock } from "@/lib/api/types";

/** Blocks the editor has a form for; any other allowed type is edited as JSON. */
export const TEXT_BLOCKS = ["p", "h2", "h3", "ul", "ol", "callout", "quote", "image"] as const;
export const OTHER_BLOCKS = ["hero", "features", "comparison", "faq", "cta", "testimonial", "pricing", "steps", "metrics"] as const;
export const ALL_BLOCKS = [...TEXT_BLOCKS, ...OTHER_BLOCKS] as const;

/** One block in the editor: plain strings for every field, plus a stable key for React. */
export interface EditorBlock {
  key: string;
  type: string;
  text: string;
  id: string;
  /** ul/ol: one item per line. */
  items: string;
  tone: string;
  src: string;
  alt: string;
  caption: string;
  /** Other types: the block's fields (without `type`) as JSON. */
  json: string;
}

let counter = 0;
const nextKey = () => `b${++counter}`;

export function emptyBlock(type: string): EditorBlock {
  return { key: nextKey(), type, text: "", id: "", items: "", tone: "info", src: "", alt: "", caption: "", json: (OTHER_BLOCKS as readonly string[]).includes(type) ? "{}" : "" };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function toEditorBlocks(blocks: ContentBlock[]): EditorBlock[] {
  return blocks.map((b) => {
    const e = emptyBlock(b.type);
    switch (b.type) {
      case "p":
      case "h3":
      case "quote":
        return { ...e, text: str(b.text) };
      case "h2":
        return { ...e, text: str(b.text), id: str(b.id) };
      case "ul":
      case "ol":
        return { ...e, items: Array.isArray(b.items) ? b.items.map(str).join("\n") : "" };
      case "callout":
        return { ...e, text: str(b.text), tone: b.tone === "warning" ? "warning" : "info" };
      case "image":
        return { ...e, src: str(b.src), alt: str(b.alt), caption: str(b.caption) };
      default: {
        const { type: _type, ...rest } = b;
        void _type;
        return { ...e, json: JSON.stringify(rest, null, 2) };
      }
    }
  });
}

/** Builds the API blocks. Throws `BlockError` with the block's index when a JSON block does not parse to an object. */
export class BlockError extends Error {
  constructor(public readonly index: number) {
    super(`block ${index}`);
  }
}

export function toBlocks(blocks: EditorBlock[]): ContentBlock[] {
  return blocks.map((b, i) => {
    switch (b.type) {
      case "p":
      case "h3":
      case "quote":
        return { type: b.type, text: b.text.trim() };
      case "h2":
        return b.id.trim() ? { type: "h2", text: b.text.trim(), id: b.id.trim() } : { type: "h2", text: b.text.trim() };
      case "ul":
      case "ol":
        return { type: b.type, items: b.items.split("\n").map((x) => x.trim()).filter(Boolean) };
      case "callout":
        return { type: "callout", tone: b.tone, text: b.text.trim() };
      case "image":
        return { type: "image", src: b.src.trim(), alt: b.alt.trim(), ...(b.caption.trim() ? { caption: b.caption.trim() } : {}) };
      default: {
        let parsed: unknown;
        try {
          parsed = JSON.parse(b.json || "{}");
        } catch {
          throw new BlockError(i);
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new BlockError(i);
        return { ...(parsed as Record<string, unknown>), type: b.type };
      }
    }
  });
}

/** Lower-case Latin letters, digits and hyphens, or Persian letters with hyphens (the backend's rule). */
export const SLUG_PATTERN = /^[a-z0-9؀-ۿ‌]+(-[a-z0-9؀-ۿ‌]+)*$/;

/** A Persian-safe slug from a title: words joined by hyphens, punctuation dropped, Persian digits made Latin. */
export function slugify(title: string): string {
  return title
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ‌\s-]/g, " ")
    .replace(/[،؛؟٪-٭۔]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

/** A site path or an https URL (the backend's link rule). */
export function isLink(value: string): boolean {
  if (value.startsWith("/")) return !value.startsWith("//") && /^\/[^\s?#]{0,299}$/.test(value);
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** The category kind an entry kind uses: posts are in blog categories, help articles in help categories. */
export function categoryKindOf(kind: string): "blog" | "help" | null {
  return kind === "post" ? "blog" : kind === "help" ? "help" : null;
}

/** Fields under `data` the editor shows for a kind; other keys are kept as they are. */
export function dataFieldsOf(kind: string): string[] {
  const common = ["seoTitle", "canonical"];
  switch (kind) {
    case "post":
      return [...common, "cover", "keywords"];
    case "help":
      return [...common, "keywords"];
    case "case_study":
      return [...common, "cover", "logo", "consent", "metrics"];
    case "legal":
      return [...common, "version"];
    case "faq":
      return ["tags"];
    default:
      return [...common, "keywords"];
  }
}

/** keywords and tags are lists, typed comma-separated (Persian «،» too). */
export const LIST_FIELDS = ["keywords", "tags"];

export function splitList(text: string): string[] {
  return text
    .split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
