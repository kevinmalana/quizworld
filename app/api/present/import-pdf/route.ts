import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  // Initialize Supabase inside the handler to avoid build-time errors
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const userId = formData.get("userId") as string;

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF must be under 50MB" }, { status: 400 });
    }

    // Store the PDF and return metadata for client-side rendering
    // Client uses PDF.js to render pages as images
    const pdfPath = `${userId}/pdf-imports/${Date.now()}-${file.name}`;
    
    const { error: uploadError } = await supabase.storage
      .from("quiz-images")
      .upload(pdfPath, file, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload PDF" }, { status: 500 });
    }

    const { data } = supabase.storage.from("quiz-images").getPublicUrl(pdfPath);

    // Return PDF info for client-side page rendering
    // Client will use PDF.js to render pages as images
    return NextResponse.json({
      success: true,
      pdf: {
        url: data.publicUrl,
        filename: file.name,
      },
    });

  } catch (error) {
    console.error("PDF import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process PDF" },
      { status: 500 }
    );
  }
}
