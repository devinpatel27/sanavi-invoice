"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const vendorSchema = z.object({
  name: z.string().min(1),
  gstin: z.string().trim().optional(),
  address: z.string().trim().optional(),
  contact: z.string().trim().optional(),
});

export async function createVendor(formData: FormData) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") {
    throw new Error("Only admins can manage vendors");
  }

  const parsed = vendorSchema.parse({
    name: formData.get("name"),
    gstin: formData.get("gstin") || undefined,
    address: formData.get("address") || undefined,
    contact: formData.get("contact") || undefined,
  });

  await db.vendor.create({ data: parsed });
  revalidatePath("/vendors");
}
