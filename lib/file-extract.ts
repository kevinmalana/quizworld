const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_TEXT_LENGTH = 24000;
const MIN_TEXT_LENGTH = 50;

const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"];

export class FileExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileExtractionError";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function validateFile(file: File): void {
  if (file.size === 0) {
    throw new FileExtractionError("This file is empty. Try a file with content.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new FileExtractionError(
      `File is too large (${formatBytes(file.size)}). Maximum size is 25MB.`
    );
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new FileExtractionError(
      `".${file.name.split(".").pop()}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`
    );
  }
}

async function extractTxt(file: File): Promise<string> {
  try {
    return await file.text();
  } catch {
    throw new FileExtractionError("Could not read this text file. It may be corrupted or use an unsupported encoding.");
  }
}

async function extractPdf(file: File): Promise<string> {
  let pdfjsLib;
  try {
    pdfjsLib = await import("pdfjs-dist");
  } catch {
    throw new FileExtractionError("PDF support failed to load. Try refreshing the page.");
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  let pdf;
  try {
    const arrayBuffer = await file.arrayBuffer();
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch {
    throw new FileExtractionError("Could not read this PDF. It may be corrupted, password-protected, or unsupported.");
  }

  if (pdf.numPages === 0) {
    throw new FileExtractionError("This PDF has no pages.");
  }

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(" ");
    if (pageText.trim()) textParts.push(pageText);
  }

  return textParts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  let mammoth;
  try {
    mammoth = await import("mammoth");
  } catch {
    throw new FileExtractionError("Word document support failed to load. Try refreshing the page.");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch {
    throw new FileExtractionError("Could not read this Word document. It may be corrupted or an unsupported format. Only .docx files are supported (not .doc).");
  }
}

export async function extractTextFromFile(file: File): Promise<{ text: string; filename: string; truncated: boolean }> {
  validateFile(file);

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  let text: string;

  switch (ext) {
    case ".txt":
    case ".md":
      text = await extractTxt(file);
      break;
    case ".pdf":
      text = await extractPdf(file);
      break;
    case ".docx":
      text = await extractDocx(file);
      break;
    default:
      throw new FileExtractionError(`Unsupported file type: ${ext}`);
  }

  text = text.replace(/\s+/g, " ").trim();

  if (text.length < MIN_TEXT_LENGTH) {
    throw new FileExtractionError(
      `Only found ${text.length} characters. Need at least ${MIN_TEXT_LENGTH} characters to generate questions. Try a file with more text content.`
    );
  }

  let truncated = false;
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
    truncated = true;
  }

  return { text, filename: file.name, truncated };
}
