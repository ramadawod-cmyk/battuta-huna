import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { type BhSession, getSession, handleMagicLinkCallback, signOut as signOutSession } from "./session";
import { identifyUser, resetAnalytics, track } from "./analytics";

type AuthContextValue = {
  session: BhSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setSession: (session: BhSession) => void;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  signOut: async () => {},
  setSession: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<BhSession | null>(() => getSession());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) identifyUser(session.user);

    handleMagicLinkCallback()
      .then((s) => {
        if (s) {
          setSessionState(s);
          identifyUser(s.user);
          track("Signed In", { method: "magic_link" });
        }
      })
      .catch((err) => console.error("Magic link callback failed:", err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await signOutSession();
    setSessionState(null);
    track("Signed Out");
    resetAnalytics();
  };

  return (
    <AuthContext.Provider value={{ session, loading, signOut, setSession: setSessionState }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
