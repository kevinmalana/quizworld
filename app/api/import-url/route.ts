import { NextResponse } from "next/server";
import { isIP } from "node:net";
import {
  extractReadableTextFromHtml,
  extractTitleFromHtml,
} from "@/lib/quiz-import";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_IMPORT_BYTES = 1_000_000;
const PRIVATE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateHostname(hostname: string) {
  const host = hostname.toLowerCase();
  if (PRIVATE_HOSTS.has(host) || host.endsWith(".local")) return true;

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    const [a, b] = host.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }

  if (ipVersion === 6) {
    return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80");
  }

  return false;
}

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

    if (isPrivateHostname(parsedUrl.hostname)) {
      return NextResponse.json({ error: "Private or local network URLs cannot be imported." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "QuizWorldImporter/1.0",
        Accept: "text/html, text/plain;q=0.9, */*;q=0.1",
      },
      signal: controller.signal,
      redirect: "follow",
    }).finally(() => clearTimeout(timeout));

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
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "This URL took too long to respond."
        : error instanceof Error
          ? error.message
          : "Could not import this URL right now.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
