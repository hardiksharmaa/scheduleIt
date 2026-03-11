import { auth } from "@/lib/auth";
import LandingClient from "./LandingClient";

export default async function LandingPage() {
  const session = await auth();
  const isLoggedIn = !!session?.user?.id;

  return <LandingClient isLoggedIn={isLoggedIn} />;
}
