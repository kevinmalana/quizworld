import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = "https://www.quizworld.xyz";

  // Static pages
  const staticPages = ["", "/explore", "/study", "/join", "/terms", "/privacy", "/contact"];

  // Fetch public quizzes for dynamic URLs
  let quizPages: string[] = [];
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quizzes?is_public=eq.true&archived_at=is.null&select=id`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
        },
        next: { revalidate: 3600 }, // Revalidate every hour
      }
    );
    if (res.ok) {
      const quizzes = (await res.json()) as Array<{ id: string }>;
      quizPages = quizzes.map((q) => `/study/${q.id}`);
    }
  } catch {
    // Continue with static pages only
  }

  const allPages = [...staticPages, ...quizPages];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (path) => `  <url>
    <loc>${baseUrl}${path}</loc>
    <changefreq>${path === "" ? "daily" : "weekly"}</changefreq>
    <priority>${path === "" ? "1.0" : "0.7"}</priority>
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
