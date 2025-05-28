
"use client";

import type { User } from "firebase/auth";
import { createContext, useEffect, useState, ReactNode } from "react";
import { auth, googleProvider } from "@/config/firebase";
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

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
    if (!auth) {
      console.error("Firebase Auth is not initialized. Check Firebase config.");
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized for signInWithGoogle.");
      return;
    }
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Successful sign-in will be handled by onAuthStateChanged
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // Handle error (e.g., show toast notification via a toast service if integrated)
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized for signOut.");
      return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      router.push("/sign-in"); // Redirect to sign-in after sign out
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
