import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getProjectScope } from "@/lib/projects/scope";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const projectScope = await getProjectScope({
    id: session.user.id,
    role: session.user.role,
  });

  return (
    <AppShell
      role={session.user.role}
      name={session.user.name ?? session.user.email ?? "User"}
      email={session.user.email ?? ""}
      projects={projectScope.projects}
      selectedProjectId={projectScope.selectedProjectId}
    >
      {children}
    </AppShell>
  );
}
