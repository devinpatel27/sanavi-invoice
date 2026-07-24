import {
  DocumentAnalysisClient,
  AzureKeyCredential,
  type AnalyzeResult,
  type AnalyzedDocument,
} from "@azure/ai-form-recognizer";

let cachedClient: DocumentAnalysisClient | null = null;

function getClient() {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim();
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim();
  if (!endpoint || !key) {
    throw new Error(
      "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT / AZURE_DOCUMENT_INTELLIGENCE_KEY are not set. Provision Azure Document Intelligence and add them to .env."
    );
  }
  if (!cachedClient) {
    cachedClient = new DocumentAnalysisClient(
      endpoint,
      new AzureKeyCredential(key)
    );
  }
  return cachedClient;
}

export function isDocumentIntelligenceConfigured() {
  return Boolean(
    process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT?.trim() &&
      process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY?.trim()
  );
}

export type ExtractedInvoiceLineItem = {
  description: string;
  productCode?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount?: number;
  confidence: number;
};

export type ExtractedInvoice = {
  vendorName?: string;
  vendorGstin?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  totalTax?: number;
  invoiceTotal?: number;
  lineItems: ExtractedInvoiceLineItem[];
  raw: AnalyzeResult<AnalyzedDocument>;
};

/**
 * Azure currency fields often come back as `{ amount, currencyCode }` objects,
 * not plain numbers. Normalize anything we get into a finite number or undefined.
 */
function toNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("amount" in obj) return toNumber(obj.amount);
    if ("value" in obj) return toNumber(obj.value);
  }
  return undefined;
}

function fieldValue(fields: Record<string, unknown>, name: string): unknown {
  const field = fields[name] as { value?: unknown } | undefined;
  return field && "value" in field ? field.value : undefined;
}

/**
 * Runs the prebuilt-invoice model against an uploaded invoice file and
 * returns a normalized shape ready to prefill the review screen.
 */
export async function extractInvoice(
  fileBuffer: Buffer
): Promise<ExtractedInvoice> {
  const client = getClient();
  const poller = await client.beginAnalyzeDocument(
    "prebuilt-invoice",
    fileBuffer
  );
  const result = await poller.pollUntilDone();

  const document = result.documents?.[0];
  const fields = (document?.fields ?? {}) as Record<string, unknown>;

  const getString = (name: string) => {
    const value = fieldValue(fields, name);
    return typeof value === "string" ? value : undefined;
  };

  const getNumber = (name: string) => toNumber(fieldValue(fields, name));

  const getDate = (name: string) => {
    const value = fieldValue(fields, name);
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    return undefined;
  };

  const itemsField = fields["Items"] as
    | { values?: Array<{ properties?: Record<string, { value?: unknown }>; confidence?: number }> }
    | undefined;

  const lineItems: ExtractedInvoiceLineItem[] = Array.isArray(itemsField?.values)
    ? itemsField.values.map((item) => {
        const props = item?.properties ?? {};
        return {
          description: String(props["Description"]?.value ?? ""),
          productCode:
            typeof props["ProductCode"]?.value === "string"
              ? props["ProductCode"].value
              : undefined,
          quantity: toNumber(props["Quantity"]?.value),
          unit:
            typeof props["Unit"]?.value === "string"
              ? props["Unit"].value
              : undefined,
          unitPrice: toNumber(props["UnitPrice"]?.value),
          amount: toNumber(props["Amount"]?.value),
          confidence: item?.confidence ?? 0,
        };
      })
    : [];

  return {
    vendorName: getString("VendorName"),
    vendorGstin: getString("VendorTaxId"),
    invoiceNumber: getString("InvoiceId"),
    invoiceDate: getDate("InvoiceDate"),
    dueDate: getDate("DueDate"),
    subtotal: getNumber("SubTotal"),
    totalTax: getNumber("TotalTax"),
    invoiceTotal: getNumber("InvoiceTotal"),
    lineItems,
    raw: result,
  };
}
