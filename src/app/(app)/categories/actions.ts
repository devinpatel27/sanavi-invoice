"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const categorySchema = z.object({
  name: z.string().min(1),
  unit: z.string().trim().optional(),
});

export async function createCategory(formData: FormData) {
  const session = await auth();
  // Full categories management page remains ADMIN-only (enforced by proxy).
  // Inline create during invoice review uses createCategoryInline (STAFF allowed).
  if (session?.user.role !== "ADMIN") {
    throw new Error("Only admins can manage categories from this page");
  }

  const parsed = categorySchema.parse({
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
  });

  await db.category.create({ data: parsed });
  revalidatePath("/categories");
}
