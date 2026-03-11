
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg-primary px-4">
      {/* Logo */}
      <div className="mb-8">
        <Logo size="lg" />
      </div>

      {children}
    </div>
  );
}
