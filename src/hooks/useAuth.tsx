
"use client";
// No changes needed to User type directly, but AuthContextType in AuthProvider was changed.
// For consistency, if MockUser is different, this might need an update,
// but since AuthContextType is defined in AuthProvider, this should still work.
// We'll assume User type from firebase/auth is a superset or compatible enough for MockUser properties.
import type { User as FirebaseUser } from "firebase/auth"; // Keep for potential future re-integration
import { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/providers/AuthProvider";

// If MockUser significantly differs from FirebaseUser, you might want a union type or a generic.
// For now, the properties (uid, email, displayName, photoURL) are common.
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
