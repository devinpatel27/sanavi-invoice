import { NextResponse } from "next/server";
import { isDocumentIntelligenceConfigured } from "@/lib/azure/document-intelligence";
import { processInvoiceUpload } from "@/lib/invoices/process-upload";
import { requireUser } from "@/lib/permissions";
import { handleError, newRequestId, isAppError } from "@/lib/errors";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const requestId = newRequestId();
  const endpoint = "/api/invoices/upload";
  const method = "POST";

  try {
    const user = await requireUser();

    if (!isDocumentIntelligenceConfigured()) {
      return NextResponse.json(
        {
          error:
            "Azure Document Intelligence is not configured. Set AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY in .env.",
        },
        { status: 503 }
      );
    }

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
      userId: user.id,
      role: user.role,
      categoryId,
    });

    await logActivity({
      userId: user.id,
      action: "INVOICE_UPLOADED",
      module: "INVOICE",
      entityId: result.invoiceId,
      details: { duplicateWarning: result.duplicateWarning },
    });

    return NextResponse.json({
      invoiceId: result.invoiceId,
      reviewUrl: `/invoices/${result.invoiceId}/review`,
      duplicateWarning: result.duplicateWarning,
      originalInvoiceNumber: result.originalInvoiceNumber,
    });
  } catch (error) {
    const appError = await handleError({
      error,
      endpoint,
      method,
      requestId,
    });
    const status = isAppError(error) ? appError.status : 500;
    return NextResponse.json(
      { error: appError.message, code: appError.code, requestId },
      { status }
    );
  }
}
