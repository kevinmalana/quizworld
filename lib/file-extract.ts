const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_LENGTH = 24000;

const ALLOWED_TYPES: Record<string, string> = {
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};

const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf", ".docx"];

export class FileExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileExtractionError";
  }
}

function validateFile(file: File): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new FileExtractionError(`File is too large. Maximum size is 5MB. Your file is ${(file.size / 1024 / 1024).toFixed(1)}MB.`);
  }

  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  const isAllowedType = Object.keys(ALLOWED_TYPES).includes(file.type);
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(ext);

  if (!isAllowedType && !isAllowedExt) {
    throw new FileExtractionError(`File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }
}

async function extractTxt(file: File): Promise<string> {
  return await file.text();
}

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  // Use CDN worker for browser
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }

  return textParts.join("\n\n");
}

async function extractDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractTextFromFile(file: File): Promise<{ text: string; filename: string }> {
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
      throw new FileExtractionError(`Unsupported file extension: ${ext}`);
  }

  text = text.trim();

  if (text.length < 50) {
    throw new FileExtractionError("Could not extract enough text from this file. Try a file with more content.");
  }

  if (text.length > MAX_TEXT_LENGTH) {
    text = text.slice(0, MAX_TEXT_LENGTH);
  }

  return { text, filename: file.name };
}
