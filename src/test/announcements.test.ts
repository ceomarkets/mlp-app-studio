import { beforeEach, describe, expect, it } from "vitest";
import {
  announcementState,
  isSafeLink,
  normalizeAnnouncement,
  validateAnnouncement,
} from "@/lib/announcements";
import type { Announcement, AnnouncementInput } from "@/lib/backend";
import { demoBackend as b, resetDemo } from "@/lib/backend/demo";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/backend/seed";
import { buildLeaderboard, buildTicker } from "@/lib/feed";

const now = Date.parse("2026-10-30T15:00:00Z");
const iso = (days: number) => new Date(now + days * 86_400_000).toISOString();

function ann(id: string, over: Partial<Announcement> = {}): Announcement {
  return {
    id,
    title: `Anuncio ${id}`,
    body: "",
    emoji: "📣",
    image: null,
    link: null,
    cta: "Ver más",
    tone: "news",
    priority: 0,
    active: true,
    startsAt: iso(-1),
    endsAt: null,
    createdAt: iso(-1),
    ...over,
  };
}

const input = (over: Partial<AnnouncementInput> = {}): AnnouncementInput => {
  const { id: _id, createdAt: _c, ...rest } = ann("x");
  return { ...rest, title: "Feria este sábado", ...over };
};

describe("reglas de anuncios", () => {
  it("estado según activo y fechas", () => {
    expect(announcementState(ann("a"), now)).toBe("live");
    expect(announcementState(ann("a", { active: false }), now)).toBe("paused");
    expect(announcementState(ann("a", { startsAt: iso(1) }), now)).toBe("scheduled");
    expect(announcementState(ann("a", { endsAt: iso(-0.5) }), now)).toBe("expired");
  });

  it("solo acepta enlaces internos o https", () => {
    expect(isSafeLink("/tienda/cafe-narino")).toBe(true);
    expect(isSafeLink("https://wa.me/57300")).toBe(true);
    expect(isSafeLink("javascript:alert(1)")).toBe(false);
    expect(isSafeLink("//evil.com")).toBe(false);
    expect(isSafeLink("http://inseguro.co")).toBe(false);
    expect(validateAnnouncement(input({ link: "javascript:alert(1)" }))).toMatch(/enlace/);
  });

  it("valida textos y fechas", () => {
    expect(validateAnnouncement(input())).toBeNull();
    expect(validateAnnouncement(input({ title: "ab" }))).toMatch(/título/);
    expect(validateAnnouncement(input({ body: "x".repeat(161) }))).toMatch(/160/);
    expect(validateAnnouncement(input({ endsAt: iso(-2) }))).toMatch(/fin/);
    expect(normalizeAnnouncement(input({ link: "  ", title: "  Hola mundo " }))).toMatchObject({
      link: null,
      title: "Hola mundo",
    });
  });
});

describe("anuncios en la cinta", () => {
  const list = [
    ann("baja", { priority: 10 }),
    ann("alta", { priority: 90, link: "/vendedores", cta: "Abrir" }),
    ann("pausado", { priority: 100, active: false }),
    ann("vencido", { priority: 100, endsAt: iso(-0.1) }),
  ];

  it("el leaderboard muestra solo los vigentes, por prioridad", () => {
    const news = buildLeaderboard([], [], "news", now, 8, list);
    expect(news.map((i) => i.key)).toEqual(["news-alta", "news-baja"]);
    expect(news[0]).toMatchObject({ kind: "announcement", badge: "NOVEDAD", metric: "Abrir" });
  });

  it("en 'Todos' los anuncios van primero", () => {
    expect(buildLeaderboard([], [], "all", now, 8, list)[0]?.key).toBe("news-alta");
  });

  it("la banda de la cabecera también los muestra", () => {
    const t = buildTicker([], [], now, list);
    expect(t.map((x) => x.key)).toEqual(["news-alta", "news-baja"]);
    expect(t[0]).toMatchObject({ kind: "news", productId: null, link: "/vendedores" });
  });
});

describe("anuncios en el backend demo", () => {
  beforeEach(() => {
    localStorage.clear();
    resetDemo();
  });

  it("el público ve los vigentes; solo el admin publica", async () => {
    const live = await b.listAnnouncements();
    expect(live.length).toBeGreaterThan(0);
    expect(live.some((a) => !a.active)).toBe(false);
    expect(await b.isAdmin()).toBe(false);
    await expect(b.saveAnnouncement(input())).rejects.toThrow();

    await b.signUp({ email: "otra@x.co", password: "secreto1", fullName: "Otra" });
    await expect(b.saveAnnouncement(input())).rejects.toThrow(/administradores/);
    await b.signOut();

    await b.signIn({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(await b.isAdmin()).toBe(true);
    const a = await b.saveAnnouncement(input({ title: "Nuevo anuncio", priority: 100 }));
    expect((await b.listAnnouncements())[0]?.id).toBe(a.id);
    await b.saveAnnouncement({ ...a, active: false });
    expect((await b.listAnnouncements()).some((x) => x.id === a.id)).toBe(false);
    expect((await b.allAnnouncements()).some((x) => x.id === a.id)).toBe(true);
    await b.deleteAnnouncement(a.id);
    expect((await b.allAnnouncements()).some((x) => x.id === a.id)).toBe(false);
  });
});
