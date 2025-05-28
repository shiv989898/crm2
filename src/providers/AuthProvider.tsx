
"use client";

import type { User } from "firebase/auth";
import { createContext, useEffect, useState, ReactNode, useContext } from "react";
// import { auth, googleProvider } from "@/config/firebase"; // Firebase auth no longer used directly here
// import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from "firebase/auth"; // Firebase auth no longer used directly here
import { useRouter } from "next/navigation";

// Define a shape for our mock user if User type is too complex or tied to Firebase
interface MockUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextType {
  user: MockUser | null; // Changed to MockUser
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Create a default mock user
const mockUser: MockUser = {
  uid: "mock-user-id-123",
  email: "dev.user@example.com",
  displayName: "Dev User",
  photoURL: "https://placehold.co/100x100.png?text=DU", // Placeholder avatar
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<MockUser | null>(mockUser); // Initialize with mock user
  const [loading, setLoading] = useState(false); // Assume loaded as we're using a mock user
  const router = useRouter();

  // useEffect(() => {
  //   // Real auth listener removed for bypass
  //   // if (!auth) {
  //   //   console.error("Firebase Auth is not initialized. Check Firebase config.");
  //   //   setLoading(false);
  //   //   return;
  //   // }
  //   // const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
  //   //   setUser(currentUser);
  //   //   setLoading(false);
  //   // });
  //   // return () => unsubscribe();
  //   setLoading(false); // Ensure loading is false
  // }, []);

  const signInWithGoogle = async () => {
    console.log("signInWithGoogle called (auth bypassed - no action taken).");
    // No actual sign-in logic as auth is bypassed
    // setUser(mockUser); // Already set, but could re-set if needed
    // setLoading(false);
    router.push("/dashboard"); // Navigate to dashboard as if login was successful
  };

  const signOut = async () => {
    console.log("signOut called (auth bypassed - mock user cleared).");
    // setUser(null); // Clear mock user
    // router.push("/sign-in"); // Navigate to a conceptual sign-in page
    // For true bypass, we might keep the mock user or handle UI differently
    // For now, let's keep the user to allow continued UI interaction
    alert("Sign out functionality is currently bypassed for development.");
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
