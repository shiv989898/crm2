
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export default function ProfilePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile Not Found</h1>
        <p className="text-muted-foreground">User data could not be loaded. Please try signing in again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">My Profile</h1>
        <p className="text-muted-foreground">View your profile details.</p>
      </div>

      <Card className="w-full max-w-2xl mx-auto shadow-lg rounded-lg">
        <CardHeader className="items-center text-center p-6 bg-card">
          <Avatar className="h-28 w-28 border-4 border-primary mb-4 shadow-md">
            <AvatarImage src={user.photoURL || undefined} alt={user.displayName || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
              {getInitials(user.displayName)}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="text-2xl font-semibold text-card-foreground">{user.displayName || "Anonymous User"}</CardTitle>
          <CardDescription className="text-muted-foreground">{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="space-y-2">
            <Label htmlFor="profileDisplayName" className="text-sm font-medium text-foreground">Display Name</Label>
            <Input id="profileDisplayName" value={user.displayName || ""} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileEmail" className="text-sm font-medium text-foreground">Email Address</Label>
            <Input id="profileEmail" type="email" value={user.email || ""} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profileUid" className="text-sm font-medium text-foreground">User ID</Label>
            <Input id="profileUid" value={user.uid || ""} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
          </div>
          {/* <Button className="w-full mt-4" disabled>Edit Profile (Coming Soon)</Button> */}
        </CardContent>
      </Card>
    </div>
  );
}
