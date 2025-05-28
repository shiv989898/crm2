
"use client";

import type { User } from "firebase/auth";
import { createContext, useEffect, useState, ReactNode } from "react";
import { auth, googleProvider } from "@/config/firebase";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // router.push("/dashboard"); // Let redirect logic handle this
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // Handle error (e.g., show toast notification)
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push("/sign-in");
    } catch (error) {
      console.error("Error signing out:", error);
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
      <Toaster />
    </AuthContext.Provider>
  );
}
