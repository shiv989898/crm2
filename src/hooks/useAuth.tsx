
"use client";
import type { User as FirebaseUser } from "firebase/auth"; 
import { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/providers/AuthProvider";

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
