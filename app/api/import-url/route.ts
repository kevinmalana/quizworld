import { NextResponse } from "next/server";
import {
  extractReadableTextFromHtml,
  extractTitleFromHtml,
} from "@/lib/quiz-import";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchSafeImportUrl, UnsafeImportUrlError } from "@/lib/url-import-security";

const MAX_IMPORT_BYTES = 1_000_000;

export async function POST(request: Request) {
  const rateLimitResponse = await checkRateLimit(request as any);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
      return NextResponse.json({ error: "Enter a URL to import from." }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      // Auto-prepend https:// if no protocol
      const withProtocol = /^(https?:)?\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      parsedUrl = new URL(withProtocol);
    } catch {
      return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only http and https URLs are supported." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetchSafeImportUrl(parsedUrl, { signal: controller.signal })
      .finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not fetch this URL (${response.status}).` },
        { status: 400 }
      );
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_IMPORT_BYTES) {
      return NextResponse.json({ error: "This page is too large to import." }, { status: 400 });
    }

    const contentType = response.headers.get("content-type") ?? "";
    const raw = (await response.text()).slice(0, MAX_IMPORT_BYTES);
    const isHtml = contentType.includes("text/html") || /<html/i.test(raw);
    const title = isHtml ? extractTitleFromHtml(raw) : parsedUrl.hostname;
    const extractedText = isHtml ? extractReadableTextFromHtml(raw) : raw.trim();

    if (!extractedText) {
      return NextResponse.json(
        { error: "This page loaded, but no readable text could be extracted." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      title,
      text: extractedText.slice(0, 24000),
    });
  } catch (error) {
    if (error instanceof UnsafeImportUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "This URL took too long to respond."
        : error instanceof Error
          ? error.message
          : "Could not import this URL right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
