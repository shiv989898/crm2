
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { createContext, useEffect, useState, ReactNode } from "react";
import { auth, googleProvider } from "@/config/firebase"; 
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

export interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true); // Start loading true for initial auth check
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
      console.log("Auth state changed, user:", currentUser ? currentUser.uid : null);
      if (!currentUser && window.location.pathname !== '/sign-in') {
        // Only redirect if not already on sign-in to avoid loops
        // router.push("/sign-in"); // Let AuthenticatedLayout handle this
      }
    });
    return () => unsubscribe();
  }, [router]);

  const signInWithGoogle = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized. Cannot sign in.");
      return;
    }
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle setting user and redirecting via useEffect in AuthenticatedLayout or page.tsx
      // router.push("/dashboard"); // No longer needed here, let auth state drive redirects
    } catch (error) {
      console.error("Error signing in with Google:", error);
      // Handle specific errors like auth/popup-blocked if needed
      if ((error as any).code === 'auth/popup-blocked') {
        alert('Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if ((error as any).code === 'auth/cancelled-popup-request') {
        console.log('Google Sign-In popup request was cancelled by the user.');
      }
      else {
        alert('Failed to sign in with Google. See console for details.');
      }
    } finally {
      // setLoading(false); // onAuthStateChanged will set loading to false
    }
  };

  const signOut = async () => {
    if (!auth) {
      console.error("Firebase Auth is not initialized. Cannot sign out.");
      return;
    }
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set user to null
      router.push("/sign-in"); 
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // setLoading(false); // onAuthStateChanged will set loading to false
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
