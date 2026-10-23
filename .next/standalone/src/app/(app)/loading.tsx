import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      Loading...
    </div>
  );
}
