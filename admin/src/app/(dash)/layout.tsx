import { AdminShell } from "@/components/admin-shell";

export default function DashLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell>{children}</AdminShell>;
}
