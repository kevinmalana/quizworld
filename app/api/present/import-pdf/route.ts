import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  try {
    // Verify authentication — use the authenticated user's id, not client-supplied
    const ssr = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll() { /* no-op */ },
        },
      }
    );
    const { data: { session } } = await ssr.auth.getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = session.user.id;

    // Service-role client for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
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
