"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity";

const categorySchema = z.object({
  name: z.string().min(1),
  unit: z.string().trim().optional(),
});

export async function createCategory(formData: FormData) {
  const user = await requirePermission("category:manage");

  const parsed = categorySchema.parse({
    name: formData.get("name"),
    unit: formData.get("unit") || undefined,
  });

  const created = await db.category.create({ data: parsed });

  await logActivity({
    userId: user.id,
    action: "CATEGORY_CREATED",
    module: "CATEGORY",
    entityId: created.id,
    details: { name: created.name },
  });

  revalidatePath("/categories");
}
