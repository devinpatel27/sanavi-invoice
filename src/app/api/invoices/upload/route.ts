import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isDocumentIntelligenceConfigured } from "@/lib/azure/document-intelligence";
import { processInvoiceUpload } from "@/lib/invoices/process-upload";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isDocumentIntelligenceConfigured()) {
    return NextResponse.json(
      {
        error:
          "Azure Document Intelligence is not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY in .env.",
      },
      { status: 503 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const categoryIdRaw = formData.get("categoryId");
    const categoryId =
      typeof categoryIdRaw === "string" && categoryIdRaw.trim()
        ? categoryIdRaw.trim()
        : null;

    if (!categoryId) {
      return NextResponse.json(
        { error: "Please select a category before extracting." },
        { status: 400 }
      );
    }

    const result = await processInvoiceUpload({
      file,
      userId: session.user.id,
      role: session.user.role,
      categoryId,
    });

    return NextResponse.json({
      invoiceId: result.invoiceId,
      reviewUrl: `/invoices/${result.invoiceId}/review`,
      duplicateWarning: result.duplicateWarning,
      originalInvoiceNumber: result.originalInvoiceNumber,
    });
  } catch (error) {
    console.error("[POST /api/invoices/upload]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Upload failed unexpectedly.",
      },
      { status: 500 }
    );
  }
}
