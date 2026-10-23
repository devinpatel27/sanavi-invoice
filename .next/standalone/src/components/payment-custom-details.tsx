export function PaymentCustomDetails({ fields }: { fields: unknown }) {
  if (!Array.isArray(fields)) return null;
  return (
    <dl className="mt-2 grid gap-1 text-xs">
      {fields.map((field, index) => {
        if (!field || typeof field !== "object" || typeof field.label !== "string" || typeof field.value !== "string") return null;
        return (
          <div key={index} className="flex flex-wrap gap-x-2">
            <dt className="break-words font-medium">{field.label}:</dt>
            <dd className="min-w-0 break-words text-muted-foreground">{field.value}</dd>
          </div>
        );
      })}
    </dl>
  );
}
