import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth, db } from "../firebase";
import { ref, set } from "firebase/database";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Sign up
  const signup = async (email, password) => {
    setIsGuest(false);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Write user info to Realtime Database
    await set(ref(db, `users/${user.uid}`), {
      uid: user.uid,
      email: email,
      createdAt: Date.now()
    });

    return userCredential;
  };

  // Log in
  const login = async (email, password) => {
    setIsGuest(false);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update last login timestamp in Realtime Database
    await set(ref(db, `users/${user.uid}/lastLogin`), Date.now());

    return userCredential;
  };

  // Guest Log in
  const loginAsGuest = () => {
    setIsGuest(true);
    setCurrentUser({
      uid: "guest-user-123",
      email: "guest@lumora.demo",
      displayName: "Guest Demo User"
    });
    return Promise.resolve();
  };

  // Log out
  const logout = () => {
    if (isGuest) {
      setIsGuest(false);
      setCurrentUser(null);
      return Promise.resolve();
    }
    return signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isGuest) {
        setCurrentUser(user);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [isGuest]);

  const value = {
    currentUser,
    loading,
    isGuest,
    signup,
    login,
    loginAsGuest,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
