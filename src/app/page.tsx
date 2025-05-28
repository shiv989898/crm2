
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
// import { useAuth } from "@/hooks/useAuth"; // useAuth might not be needed if directly redirecting
import { Loader2 } from "lucide-react";

export default function HomePage() {
  // const { user, loading } = useAuth(); // Auth check bypassed
  const router = useRouter();

  useEffect(() => {
    // Since auth is bypassed, always redirect to dashboard
    router.replace("/dashboard");
    // if (!loading) {
    //   if (user) {
    //     router.replace("/dashboard");
    //   } else {
    //     // router.replace("/sign-in"); // Sign-in bypassed
    //     router.replace("/dashboard"); // Go to dashboard even if "no user" as auth is off
    //   }
    // }
  }, [router]); // Removed user, loading dependency

  return (
    <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
      <p className="ml-4">Redirecting...</p>
    </div>
  );
}
