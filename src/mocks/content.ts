// Mock state and handlers for /admin/v1/content (backend PR #31). Used by src/mocks/admin-api.ts.

import type { ContentBlock, ContentCategory, ContentEntry, ContentRedirect } from "@/lib/api/types";

const KINDS = ["page", "post", "help", "case_study", "legal", "faq"];
const BLOCK_TYPES = ["p", "h2", "h3", "ul", "ol", "callout", "quote", "image", "hero", "features", "comparison", "faq", "cta", "testimonial", "pricing", "steps", "metrics"];
const LINK_FIELDS = ["href", "url", "src", "image", "cover", "logo", "canonical"];
const SLUG = /^[a-z0-9؀-ۿ‌]+(-[a-z0-9؀-ۿ‌]+)*$/;
const PATH = /^\/[^\s?#]{0,299}$/;

interface Copy {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  author: string | null;
  body: ContentBlock[];
  data: Record<string, unknown>;
}

interface MockEntry {
  id: string;
  kind: string;
  status: string;
  draft: Copy;
  published: Copy | null;
  revision: number;
  publishedRevision: number | null;
  firstPublishedAt: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentMockState {
  entries: MockEntry[];
  categories: ContentCategory[];
  redirects: ContentRedirect[];
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
type Problem = (status: number, code: string, errors?: Record<string, string[]>) => Response;

const isLink = (v: string) => (v.startsWith("/") ? !v.startsWith("//") && PATH.test(v) : /^https:\/\/\S+$/.test(v));

export function seedContent(): ContentMockState {
  const at = (iso: string) => new Date(iso).toISOString();
  const entry = (n: number, kind: string, status: string, copy: Partial<Copy> & { slug: string; title: string }, over: Partial<MockEntry> = {}): MockEntry => {
    const draft: Copy = { description: null, category: null, author: null, body: [{ type: "p", text: `متن ${copy.title}` }], data: {}, ...copy };
    const published = status === "draft" ? null : structuredClone(draft);
    return {
      id: `01938f90-0000-7000-8000-0000000000${String(n).padStart(2, "0")}`,
      kind,
      status,
      draft,
      published,
      revision: 1,
      publishedRevision: published ? 1 : null,
      firstPublishedAt: published ? at("2026-10-20T08:00:00Z") : null,
      publishedAt: status === "published" ? at("2026-10-20T08:00:00Z") : null,
      scheduledAt: null,
      createdAt: at("2026-10-19T08:00:00Z"),
      updatedAt: at(`2026-10-${String(20 + (n % 9)).padStart(2, "0")}T08:00:00Z`),
      ...over,
    };
  };
  return {
    categories: [
      { id: "01938f91-0000-7000-8000-000000000001", kind: "blog", slug: "instagram", title: "اینستاگرام", description: "ترفندهای فروش در اینستاگرام", sortOrder: 0 },
      { id: "01938f91-0000-7000-8000-000000000002", kind: "blog", slug: "news", title: "خبرها", description: null, sortOrder: 1 },
      { id: "01938f91-0000-7000-8000-000000000003", kind: "help", slug: "getting-started", title: "شروع کار", description: null, sortOrder: 0 },
    ],
    redirects: [{ id: "01938f92-0000-7000-8000-000000000001", from: "/pricing-old", to: "/pricing", permanent: true, createdAt: at("2026-10-25T08:00:00Z") }],
    entries: [
      entry(1, "page", "published", { slug: "home", title: "صفحهٔ اصلی", body: [{ type: "hero", title: "پاسخ خودکار دایرکت", cta: { label: "شروع رایگان", href: "/signup" } }] }),
      entry(2, "post", "published", {
        slug: "پاسخ-خودکار-دایرکت",
        title: "پاسخ خودکار دایرکت اینستاگرام",
        description: "راهنمای کامل پاسخ خودکار",
        category: "instagram",
        author: "تیم پیشخوان",
        body: [{ type: "h2", text: "چرا پاسخ خودکار؟", id: "why" }, { type: "p", text: "مشتری منتظر نمی‌ماند." }, { type: "ul", items: ["سریع", "دقیق"] }],
        data: { seoTitle: "پاسخ خودکار دایرکت | پیشخوان", keywords: ["دایرکت", "پاسخ خودکار"] },
      }),
      entry(3, "post", "draft", { slug: "قیمت-گذاری", title: "قیمت‌گذاری در دایرکت", category: null }),
      entry(4, "help", "published", { slug: "connect-instagram", title: "اتصال حساب اینستاگرام", category: "getting-started" }, { revision: 2, publishedRevision: 1 }),
      entry(5, "case_study", "draft", { slug: "boutique-rose", title: "بوتیک رز", data: { consent: false } }),
      entry(6, "legal", "published", { slug: "terms", title: "قوانین و مقررات", data: { version: "1.0" } }),
      entry(7, "faq", "archived", { slug: "trial-length", title: "دورهٔ آزمایشی چند روز است؟" }),
    ],
  };
}

function settle(e: MockEntry) {
  if (e.scheduledAt && Date.parse(e.scheduledAt) <= Date.now()) publish(e);
}

function publish(e: MockEntry) {
  const now = new Date().toISOString();
  e.published = structuredClone(e.draft);
  e.publishedRevision = e.revision;
  e.status = "published";
  e.firstPublishedAt ??= now;
  e.publishedAt = now;
  e.scheduledAt = null;
}

function toResponse(e: MockEntry): ContentEntry {
  settle(e);
  return {
    id: e.id,
    kind: e.kind,
    status: e.status,
    ...e.draft,
    revision: e.revision,
    publishedRevision: e.publishedRevision,
    hasUnpublishedChanges: e.published !== null && JSON.stringify(e.published) !== JSON.stringify(e.draft),
    firstPublishedAt: e.firstPublishedAt,
    publishedAt: e.publishedAt,
    scheduledAt: e.scheduledAt,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function checkLinks(value: unknown, depth = 0): string | null {
  if (depth > 6) return "validation.content.too_deep";
  if (Array.isArray(value)) {
    for (const v of value) {
      const e = checkLinks(v, depth + 1);
      if (e) return e;
    }
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" && LINK_FIELDS.includes(k) && v && !isLink(v)) return "validation.content.link";
      const e = checkLinks(v, depth + 1);
      if (e) return e;
    }
  }
  return null;
}

export async function handleContent(request: Request, url: URL, s: ContentMockState, roles: string[], problem: Problem): Promise<Response | null> {
  const path = url.pathname.replace(/^\/admin\/v1\/content/, "");
  const reader = roles.some((r) => ["SuperAdmin", "ContentEditor", "Support", "ReadOnly"].includes(r));
  const writer = roles.some((r) => r === "SuperAdmin" || r === "ContentEditor");
  const method = request.method;
  if (!reader || (method !== "GET" && !writer)) return problem(403, "auth.forbidden");
  const body = async <T,>(): Promise<Partial<T>> => {
    try {
      return (await request.json()) as Partial<T>;
    } catch {
      return {};
    }
  };
  const categoryKindOf = (kind: string) => (kind === "post" ? "blog" : kind === "help" ? "help" : null);

  const validate = async (kind: string, b: Partial<Copy>): Promise<{ copy?: Copy; errors?: Record<string, string[]> }> => {
    const errors: Record<string, string[]> = {};
    const slug = (b.slug ?? "").trim();
    if (!slug || slug.length > 120 || !SLUG.test(slug)) errors.slug = ["validation.content.slug"];
    const title = (b.title ?? "").trim();
    if (!title || title.length > 200) errors.title = [title ? "validation.too_long" : "validation.required"];
    const category = b.category?.trim() || null;
    const ck = categoryKindOf(kind);
    if (category && (!ck || !s.categories.some((c) => c.kind === ck && c.slug === category))) errors.category = ["validation.content.category"];
    const blocks = b.body ?? [];
    if (!Array.isArray(blocks) || blocks.some((x) => !x || typeof x !== "object" || !BLOCK_TYPES.includes(String((x as ContentBlock).type)))) errors.body = ["validation.content.block_type"];
    else if (checkLinks(blocks)) errors.body = [checkLinks(blocks)!];
    if (checkLinks(b.data ?? {})) errors.data = [checkLinks(b.data ?? {})!];
    if (Object.keys(errors).length) return { errors };
    return { copy: { slug, title, description: b.description?.trim() || null, category, author: b.author?.trim() || null, body: blocks, data: b.data ?? {} } };
  };

  if (method === "GET" && path === "/entries") {
    const q = url.searchParams;
    const kind = q.get("kind");
    const status = q.get("status");
    const text = (q.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(q.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(q.get("pageSize") ?? 25)));
    const list = s.entries
      .map(toResponse)
      .filter((e) => (!kind || e.kind === kind) && (!status || e.status === status) && (!text || `${e.title} ${e.description ?? ""} ${JSON.stringify(e.body)}`.toLowerCase().includes(text)))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    const items = list.slice((page - 1) * pageSize, page * pageSize).map((e) => ({
      id: e.id,
      kind: e.kind,
      slug: e.slug,
      status: e.status,
      title: e.title,
      category: e.category,
      revision: e.revision,
      hasUnpublishedChanges: e.hasUnpublishedChanges,
      publishedAt: e.publishedAt,
      scheduledAt: e.scheduledAt,
      updatedAt: e.updatedAt,
    }));
    return json({ items, totalCount: list.length, page, pageSize });
  }
  if (method === "POST" && path === "/entries") {
    const b = await body<Copy & { kind: string }>();
    if (!KINDS.includes(b.kind ?? "")) return problem(400, "validation.failed", { kind: ["validation.invalid"] });
    const { copy, errors } = await validate(b.kind!, b);
    if (errors) return problem(400, "validation.failed", errors);
    if (s.entries.some((e) => e.kind === b.kind && e.draft.slug === copy!.slug)) return problem(409, "content.slug_taken");
    const now = new Date().toISOString();
    const created: MockEntry = { id: crypto.randomUUID(), kind: b.kind!, status: "draft", draft: copy!, published: null, revision: 1, publishedRevision: null, firstPublishedAt: null, publishedAt: null, scheduledAt: null, createdAt: now, updatedAt: now };
    s.entries.push(created);
    return json(toResponse(created), 201);
  }
  const m = /^\/entries\/([0-9a-f-]{36})(?:\/(publish|schedule|archive|preview))?$/i.exec(path);
  if (m) {
    const e = s.entries.find((x) => x.id === m[1]!.toLowerCase());
    if (!e) return problem(404, "not_found");
    const act = m[2];
    if (method === "GET" && !act) return json(toResponse(e));
    if (method === "PUT" && !act) {
      const b = await body<Copy & { revision: number }>();
      const { copy, errors } = await validate(e.kind, b);
      if (errors) return problem(400, "validation.failed", errors);
      if (b.revision !== e.revision) return problem(409, "content.stale");
      if (copy!.slug !== e.draft.slug) {
        if (e.firstPublishedAt) return problem(409, "content.slug_locked");
        if (s.entries.some((x) => x !== e && x.kind === e.kind && x.draft.slug === copy!.slug)) return problem(409, "content.slug_taken");
      }
      e.draft = copy!;
      e.revision += 1;
      e.updatedAt = new Date().toISOString();
      return json(toResponse(e));
    }
    if (method === "POST" && act === "publish") {
      const b = await body<{ at: string }>();
      if (e.kind === "case_study" && e.draft.data.consent !== true) return problem(409, "content.consent_required");
      if (categoryKindOf(e.kind) && !e.draft.category) return problem(409, "content.category_required");
      if (b.at && Date.parse(b.at) > Date.now()) e.scheduledAt = new Date(b.at).toISOString();
      else publish(e);
      return json(toResponse(e));
    }
    if (method === "DELETE" && act === "schedule") {
      e.scheduledAt = null;
      return json(toResponse(e));
    }
    if (method === "POST" && act === "archive") {
      const b = await body<{ reason: string | null }>();
      if ((b.reason ?? "").length > 300) return problem(400, "validation.failed", { reason: ["validation.too_long"] });
      e.status = "archived";
      e.scheduledAt = null;
      return json(toResponse(e));
    }
    if (method === "POST" && act === "preview") return json({ token: `mock-preview-${e.id}`, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    if (method === "DELETE" && !act) {
      if (e.firstPublishedAt) return problem(409, "content.was_published");
      s.entries.splice(s.entries.indexOf(e), 1);
      return new Response(null, { status: 204 });
    }
  }

  if (method === "GET" && path === "/categories") {
    const kind = url.searchParams.get("kind");
    return json(s.categories.filter((c) => !kind || c.kind === kind).sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)));
  }
  const c = /^\/categories(?:\/([0-9a-f-]{36}))?$/i.exec(path);
  if (c && method !== "GET") {
    const found = c[1] ? s.categories.find((x) => x.id === c[1]!.toLowerCase()) : undefined;
    if (c[1] && !found) return problem(404, "not_found");
    if (method === "DELETE" && found) {
      const kind = found.kind === "blog" ? "post" : "help";
      if (s.entries.some((e) => e.kind === kind && (e.draft.category === found.slug || e.published?.category === found.slug))) return problem(409, "content.category_in_use");
      s.categories.splice(s.categories.indexOf(found), 1);
      return new Response(null, { status: 204 });
    }
    const b = await body<{ kind: string; slug: string; title: string; description: string | null; sortOrder: number }>();
    const errors: Record<string, string[]> = {};
    if (!found && !["blog", "help"].includes(b.kind ?? "")) errors.kind = ["validation.invalid"];
    if (!found && !SLUG.test((b.slug ?? "").trim())) errors.slug = ["validation.content.slug"];
    const title = (b.title ?? "").trim();
    if (!title || title.length > 100) errors.title = [title ? "validation.too_long" : "validation.required"];
    if ((b.description ?? "").length > 500) errors.description = ["validation.too_long"];
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    if (found) {
      Object.assign(found, { title, description: b.description?.trim() || null, sortOrder: b.sortOrder ?? found.sortOrder });
      return json(found);
    }
    if (s.categories.some((x) => x.kind === b.kind && x.slug === b.slug!.trim())) return problem(409, "content.slug_taken");
    const created = { id: crypto.randomUUID(), kind: b.kind!, slug: b.slug!.trim(), title, description: b.description?.trim() || null, sortOrder: b.sortOrder ?? 0 };
    s.categories.push(created);
    return json(created, 201);
  }

  if (method === "GET" && path === "/redirects") return json([...s.redirects].sort((a, b) => a.from.localeCompare(b.from)));
  if (method === "POST" && path === "/redirects") {
    const b = await body<{ from: string; to: string; permanent: boolean }>();
    const from = (b.from ?? "").trim();
    const to = (b.to ?? "").trim();
    const errors: Record<string, string[]> = {};
    if (!PATH.test(from) || from.startsWith("//")) errors.from = ["validation.content.path"];
    if (!isLink(to) || to === from) errors.to = ["validation.content.path"];
    if (Object.keys(errors).length) return problem(400, "validation.failed", errors);
    if (s.redirects.some((r) => r.from === from)) return problem(409, "content.redirect_exists");
    const created = { id: crypto.randomUUID(), from, to, permanent: b.permanent ?? true, createdAt: new Date().toISOString() };
    s.redirects.push(created);
    return json(created, 201);
  }
  const r = /^\/redirects\/([0-9a-f-]{36})$/i.exec(path);
  if (r && method === "DELETE") {
    const i = s.redirects.findIndex((x) => x.id === r[1]!.toLowerCase());
    if (i < 0) return problem(404, "not_found");
    s.redirects.splice(i, 1);
    return new Response(null, { status: 204 });
  }
  return null;
}
