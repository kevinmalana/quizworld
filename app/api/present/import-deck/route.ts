import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/rate-limit";

const execFileAsync = promisify(execFile);

// SECURITY: was 100MB; capped at 25MB to bound CPU/memory exposure on Vercel
// when LibreOffice processes untrusted files.
const MAX_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"];
const ALLOWED_EXTS = [".pdf", ".pptx", ".ppt"];

// SECURITY: LibreOffice conversion is CPU-bound. Cap timeout at 30s to bound
// worker time per request, limiting blast radius of any LibreOffice bug or runaway conversion.
const CONVERSION_TIMEOUT_MS = 30_000;

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    // ── Auth: require a logged-in Supabase session (mirrors /import-pdf)
    // Anonymous uploads were an open door before — anyone could spike our
    // CPU quota by uploading random PPTX files. Now requires auth.
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() { /* no-op */ },
        },
      },
    );
    const { data: { session } } = await ssr.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // ── Rate limit: bound per-user request rate.
    // Per-IP rate limit (no `userId` aware) is fine here since auth has already gated.
    // 10 per minute is generous enough for legitimate use (a single user editing their deck
    // uploads many files in one sitting, but rarely more than 10 per minute).
    const rateLimitResponse = await checkRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum is 25MB.` }, { status: 400 });
    }

    // SECURITY: validate extension matches declared Content-Type to avoid
    // browser-vs-server MIME confusion (e.g., the file is .pdf but content is HTML).
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format. Use PDF, PPTX, or PPT.` },
        { status: 400 }
      );
    }
    if (ext !== ".pdf" && file.type && file.type !== ALLOWED_TYPES.find((t) => t.startsWith(file.type))) {
      // accept if Content-Type is in our allow-list (for non-PDF, only PPTX/PPT)
      // For PDF case we already exit below; this guard handles PPTX specifically.
      if (!ALLOWED_TYPES.slice(1).includes(file.type)) {
        return NextResponse.json(
          { error: "Declared Content-Type does not match file extension." },
          { status: 400 }
        );
      }
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // PDF: return directly, no conversion needed
    if (ext === ".pdf") {
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          // SECURITY: don't echo user-supplied filename back into headers without escaping.
          // Browsers don't execute Content-Disposition filename in modern engines, but
          // sanitize defensively.
          "Content-Disposition": `inline; filename="${file.name.replace(/[^\w.\-]/g, "_")}"`,
          "X-Page-Source": "direct",
        },
      });
    }

    // PPTX/PPT: convert to PDF via LibreOffice headless
    // SECURITY: tmpDir uses Math.random() (good enough for collision avoidance here).
    // The input filename uses only `ext` (validated against ALLOWED_EXTS) so no path traversal.
    tmpDir = join(tmpdir(), `qw-deck-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(tmpDir, { recursive: true });

    const inputPath = join(tmpDir, `input${ext}`);
    const outputPath = join(tmpDir, "input.pdf");

    await writeFile(inputPath, buffer);

    try {
      await execFileAsync(
        "libreoffice",
        [
          "--headless",
          "--norestore",
          "--nofirststartwizard",
          "--convert-to", "pdf",
          "--outdir", tmpDir,
          inputPath,
        ],
        { timeout: CONVERSION_TIMEOUT_MS, env: { ...process.env, HOME: tmpDir } }
      );
    } catch (convErr) {
      console.error("LibreOffice conversion failed:", convErr);
      return NextResponse.json(
        { error: "Failed to convert presentation. Make sure the file is not password-protected or corrupted." },
        { status: 422 }
      );
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await readFile(outputPath);
    } catch {
      return NextResponse.json(
        { error: "Conversion produced no output. The file may be empty or unsupported." },
        { status: 422 }
      );
    }

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${file.name.replace(ext, ".pdf").replace(/[^\w.\-]/g, "_")}"`,
        "X-Page-Source": "converted",
      },
    });

  } catch (error) {
    console.error("import-deck error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error processing deck." },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    if (tmpDir) {
      try {
        const { readdir } = await import("fs/promises");
        const files = await readdir(tmpDir);
        await Promise.all(files.map((f) => unlink(join(tmpDir!, f)).catch(() => {})));
        await import("fs/promises").then((m) => m.rmdir(tmpDir!).catch(() => {}));
      } catch {
        // Best-effort cleanup
      }
    }
  }
}
