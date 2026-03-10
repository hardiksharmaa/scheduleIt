import { Calendar } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c0c0c] px-4">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c4956a]">
          <Calendar className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white">ScheduleIt</span>
      </Link>

      {children}
    </div>
  );
}
