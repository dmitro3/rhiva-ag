"use client";
import bs58 from "bs58";
import xior from "xior";
import type z from "zod";
import { toast } from "react-toastify";
import { SignMessage } from "@rhiva-ag/shared";
import { useWallet } from "@solana/wallet-adapter-react";
import { CookiesProvider, useCookies } from "react-cookie";
import type {
  extendedUserSelectSchema,
  safeAuthUserSchema,
} from "@rhiva-ag/trpc";
import {
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import "../../firebase.config";
import AuthModal from "./AuthModal";
import SolanaWalletProvider from "@/providers/SolanaWalletProvider";

type User = z.infer<typeof safeAuthUserSchema>;

export type TAuthContext = {
  user?: User;
  isAuthenticated: boolean;
  signIn: () => Promise<User>;
  signOut: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<User | undefined>>;
};

export const AuthContext = createContext<TAuthContext | null>(null);

export const withCookieProvider =
  <T extends React.ElementType>(Component: T) =>
  (props: React.ComponentProps<T>) => (
    <CookiesProvider>
      <SolanaWalletProvider>
        <Component {...props} />
      </SolanaWalletProvider>
    </CookiesProvider>
  );

export default withCookieProvider(function AuthProvider({
  children,
  serverUser,
}: React.PropsWithChildren & {
  serverUser?: User;
}) {
  const manualFetchUser = useRef(false);
  const disableWalletConnect = useRef(false);
  const signInRejecter = useRef<(error: Error) => void>(null);
  const signInResolver = useRef<(user: User) => void>(null);

  const wallet = useWallet();
  const [user, setUser] = useState(serverUser);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(user));
  const [cookies] = useCookies<"email", { email?: string }>(["email"]);

  const auth = useMemo(() => getAuth(), []);

  const signIn = useCallback(async () => {
    if (user) return Promise.resolve(user);
    manualFetchUser.current = true;
    setShowAuthModal(true);
    return new Promise<User>((resolve, reject) => {
      signInRejecter.current = reject;
      signInResolver.current = resolve;
    });
  }, [user]);

  const signOut = useCallback(async () => {
    disableWalletConnect.current = true;
    wallet.disconnect().catch(() => null);
    firebaseSignOut(auth).catch(() => null);
    xior
      .delete<z.infer<typeof extendedUserSelectSchema>>("/api/auth/session")
      .catch(() => null);
    localStorage.clear();

    setUser(undefined);
    setIsAuthenticated(false);
  }, [auth, wallet]);

  const fetchServerUser = useCallback(async (user: FirebaseUser) => {
    const token = await user.getIdToken();
    const { data } = await xior.post<User>("/api/auth/firebase/", { token });
    setUser(data);
    setIsAuthenticated(true);

    if (signInResolver.current) {
      signInResolver.current(data);
      signInResolver.current = null;
    }

    setShowAuthModal(false);
    return data;
  }, []);

  useEffect(() => {
    const emailLink = location.href;

    if (isSignInWithEmailLink(auth, emailLink) && cookies.email) {
      signInWithEmailLink(auth, cookies.email, emailLink)
        .then(async ({ user }) => {
          fetchServerUser(user);
        })
        .catch((error) => {
          console.error(error);
          return Promise.reject(error);
        });
    }
  }, [cookies.email, auth, fetchServerUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (user) return;
      if (manualFetchUser.current) return;

      if (firebaseUser) await fetchServerUser(firebaseUser);
    });

    return () => unsubscribe();
  }, [user, auth, fetchServerUser]);

  const signInWithWallet = useCallback(async () => {
    const message = {
      domain: window.location.href,
      publicKey: wallet.publicKey!.toBase58(),
      statement: "Login to Rhiva by signing this message",
    };
    const signMessage = new SignMessage(message);
    const data = new TextEncoder().encode(signMessage.prepare());
    if (wallet.signMessage) {
      const signature = await wallet.signMessage(data);
      const serializedSignature = bs58.encode(signature);
      const { data: user } = await xior.post<User>("/api/auth/wallet", {
        message,
        signature: serializedSignature,
      });
      setUser(user);
      setIsAuthenticated(true);
      setShowAuthModal(false);

      return;
    }

    toast.error("Oops! This wallet is not supported.");
  }, [wallet]);

  useEffect(() => {
    if (disableWalletConnect.current) return;
    if (user) return;
    if (wallet.publicKey) signInWithWallet();
  }, [wallet, user, signInWithWallet]);

  return (
    <AuthContext.Provider
      value={{ user, setUser, isAuthenticated, signIn, signOut }}
    >
      {children}
      <AuthModal
        open={showAuthModal}
        onClose={(closed) => {
          if (closed && signInRejecter.current) {
            signInRejecter.current(new Error("User cancelled signIn"));
            signInRejecter.current = null;
          }
          setShowAuthModal(closed);
        }}
        onSignIn={fetchServerUser}
      />
    </AuthContext.Provider>
  );
});
