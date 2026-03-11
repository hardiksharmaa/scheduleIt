import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-32">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  );
}
