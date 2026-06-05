import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = "https://www.quizworld.xyz";

  const CATEGORY_SLUGS = [
    "general-knowledge",
    "science-and-nature",
    "history",
    "technology",
    "sports",
    "music",
    "movies",
    "geography",
    "mathematics",
    "animals",
    "video-games",
    "art-and-literature",
    "food-and-drink",
    "books",
    "mythology",
    "programming",
    "space-and-astronomy",
    "tv-shows",
    "comics-and-anime",
    "travel-and-tourism",
  ];

  const staticPages = [
    { path: "", priority: "1.0", changefreq: "daily" },
    { path: "/explore", priority: "0.9", changefreq: "daily" },
    { path: "/quiz", priority: "0.9", changefreq: "daily" },
    { path: "/study", priority: "0.8", changefreq: "weekly" },
    { path: "/join", priority: "0.7", changefreq: "monthly" },
    { path: "/aws-practice-test", priority: "0.8", changefreq: "weekly" },
    { path: "/kahoot-alternative", priority: "0.8", changefreq: "weekly" },
    { path: "/terms", priority: "0.3", changefreq: "monthly" },
    { path: "/privacy", priority: "0.3", changefreq: "monthly" },
    ...CATEGORY_SLUGS.map((slug) => ({ path: `/explore/${slug}`, priority: "0.8", changefreq: "weekly" })),
  ];

  let quizPages: { path: string; priority: string; changefreq: string }[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?is_public=eq.true&archived_at=is.null&select=id,slug,updated_at`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
        },
        next: { revalidate: 3600 },
      }
    );
    if (res.ok) {
      const quizzes = (await res.json()) as Array<{ id: string; slug: string | null; updated_at: string }>;
      quizPages = quizzes.flatMap((q) => {
        const identifier = q.slug || q.id;
        const lastmod = q.updated_at ? `\n    <lastmod>${q.updated_at.split("T")[0]}</lastmod>` : "";
        return [
          { path: `/quiz/${identifier}`, priority: "0.8", changefreq: "weekly", lastmod },
          { path: `/study/${identifier}`, priority: "0.8", changefreq: "weekly", lastmod },
        ];
      });
    }
  } catch {
    // Continue with static pages only
  }

  const allPages = [
    ...staticPages.map((p) => ({ ...p, lastmod: "" })),
    ...quizPages,
  ];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${baseUrl}${p.path}</loc>${(p as { lastmod?: string }).lastmod || ""}
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
