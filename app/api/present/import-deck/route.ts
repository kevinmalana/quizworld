import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint"];
const ALLOWED_EXTS = [".pdf", ".pptx", ".ppt"];

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum is 100MB.` }, { status: 400 });
    }

    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported format. Use PDF, PPTX, or PPT.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // PDF: return directly, no conversion needed
    if (ext === ".pdf") {
      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${file.name}"`,
          "X-Page-Source": "direct",
        },
      });
    }

    // PPTX/PPT: convert to PDF via LibreOffice headless
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
        { timeout: 60_000, env: { ...process.env, HOME: tmpDir } }
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
        "Content-Disposition": `inline; filename="${file.name.replace(ext, ".pdf")}"`,
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
