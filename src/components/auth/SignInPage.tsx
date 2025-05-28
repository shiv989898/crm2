
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { ChromeIcon, Loader2 } from "lucide-react"; // Using ChromeIcon as a placeholder for Google G
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function SignInPage() {
  const { signInWithGoogle, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (loading && !user) { // Show loader if loading and no user yet (initial auth check)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user) { // If user becomes available while on this page, redirect
     return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Nexus CRM</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to access your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={signInWithGoogle} 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ChromeIcon className="mr-2 h-5 w-5" /> // Placeholder for Google icon
            )}
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
