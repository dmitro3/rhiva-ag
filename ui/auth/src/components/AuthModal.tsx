import clsx from "clsx";
import type z from "zod";
import { format } from "util";
import { useMemo } from "react";
import { object, string } from "yup";
import { toast } from "react-toastify";
import { FcGoogle } from "react-icons/fc";
import { useCookies } from "react-cookie";
import { Field, Form, Formik } from "formik";
import type { ActionCodeSettings } from "firebase/auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { MdArrowForward, MdClose } from "react-icons/md";
import type { safeAuthUserSchema } from "@rhiva-ag/trpc";
import { BsFacebook, BsApple, BsXSquareFill } from "react-icons/bs";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  getAuth,
  sendSignInLinkToEmail,
  signInWithPopup,
  OAuthProvider,
  TwitterAuthProvider,
  GoogleAuthProvider,
  FacebookAuthProvider,
  type GithubAuthProvider,
  type User,
} from "firebase/auth";

import ConnectWalletItem from "./ConnectWalletItem";

class AppleAuthProvider extends OAuthProvider {
  constructor() {
    super("apple.com");
  }
}

export type AuthModalProps = {
  cancellable?: boolean;
  logo: React.ReactNode;
  onSignIn(user: User): Promise<z.infer<typeof safeAuthUserSchema>>;
} & React.ComponentProps<typeof Dialog>;

type AuthConnector = {
  name: string;
  icon: React.ElementType;
  provider:
    | typeof FacebookAuthProvider
    | typeof GoogleAuthProvider
    | typeof AppleAuthProvider
    | typeof FacebookAuthProvider
    | typeof TwitterAuthProvider
    | typeof GithubAuthProvider;
};

export default function AuthModal({
  logo,
  onSignIn,
  cancellable,
  ...props
}: AuthModalProps) {
  const { wallets } = useWallet();
  const auth = useMemo(() => getAuth(), []);
  const [cookies, setCookie] = useCookies<"email", { email: string }>([
    "email",
  ]);
  const authConnectors: AuthConnector[] = useMemo(
    () => [
      {
        name: "Google",
        icon: FcGoogle,
        provider: GoogleAuthProvider,
      },
      {
        name: "Apple",
        icon: BsApple,
        provider: AppleAuthProvider,
      },
      {
        name: "Facebook",
        icon: (props: React.ComponentProps<typeof BsFacebook>) => (
          <BsFacebook
            {...props}
            color="#1877F2"
          />
        ),
        provider: FacebookAuthProvider,
      },
      {
        name: "X",
        icon: BsXSquareFill,
        provider: TwitterAuthProvider,
      },
    ],
    [],
  );

  return (
    <Dialog
      {...props}
      className={clsx(props.className, "relative z-100")}
    >
      <div className="fixed flex flex-col inset-0">
        <DialogBackdrop className="absolute inset-0 bg-black/50 backdrop-blur-sm -z-10" />
        <DialogPanel className="m-auto flex flex-col space-y-8 bg-dark p-4 rounded-2xl z-10 lt-sm:min-w-xs sm:w-sm">
          <header className="flex flex-col">
            {cancellable && (
              <button
                type="button"
                className="self-end"
                onClick={() => props.onClose(false)}
              >
                <MdClose size={18} />
              </button>
            )}
            <div className="self-center flex flex-col space-y-2">
              {logo}
              <p className="text-center">Log in or create account</p>
            </div>
          </header>
          <div className="flex flex-col space-y-4">
            <Formik
              validationSchema={object({
                email: string().email().required(),
              })}
              initialValues={{
                email: cookies.email,
              }}
              onSubmit={async (values) => {
                const actionCodeSettings: ActionCodeSettings = {
                  url: window.location.href,
                  handleCodeInApp: true,
                  linkDomain: "auth.rhiva.fun",
                };

                setCookie("email", values.email);
                return sendSignInLinkToEmail(
                  auth,
                  values.email,
                  actionCodeSettings,
                )
                  .then(() => {
                    props.onClose?.(false);
                    toast.success(
                      format("🎉 Login email sent to %s.", values.email),
                    );
                  })
                  .catch(() =>
                    toast.error("Oops! An unexpected error occured."),
                  );
              }}
            >
              {({ errors, isSubmitting }) => (
                <Form className="flex flex-col space-y-1">
                  <div
                    className={clsx(
                      "flex items-center space-x-4 bg-black/25 px-2 border  rounded-md",
                      errors.email
                        ? "border-red-500"
                        : "border-white/10 focus-within:border-primary",
                    )}
                  >
                    <Field
                      name="email"
                      placeholder="Enter email address"
                      className="flex-1 p-3"
                    />
                    <button
                      type="submit"
                      className="flex items-center justify-center size-8 bg-primary rounded-full"
                    >
                      {isSubmitting ? (
                        <div className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MdArrowForward
                          className="m-auto text-black"
                          size={24}
                        />
                      )}
                    </button>
                  </div>
                  <small className="text-red-500 first-letter:uppercase">
                    {errors.email}
                  </small>
                </Form>
              )}
            </Formik>
            <div className="grid grid-cols-1 gap-2">
              <div className="grid grid-cols-2 gap-2">
                {authConnectors.map((authConnector) => (
                  <button
                    key={authConnector.name}
                    type="button"
                    className="flex items-center justify-center space-x-2 border border-white/10 p-2 rounded-md"
                    onClick={async () => {
                      const provider = new authConnector.provider();
                      provider.addScope("email");
                      provider.addScope("name");

                      return signInWithPopup(auth, provider).then(({ user }) =>
                        onSignIn(user),
                      );
                    }}
                  >
                    <authConnector.icon size={24} />
                    <span className="text-start capitalize hidden">
                      {authConnector.name}
                    </span>
                  </button>
                ))}
              </div>
              {wallets.map((wallet) => (
                <ConnectWalletItem
                  key={wallet.adapter.name}
                  wallet={wallet}
                />
              ))}
            </div>
          </div>
          <div className="text-xs text-white/75 text-center">
            <span>By continuing, you agree to our</span>&nbsp;
            <a
              href="?show_legal_dialog=true"
              className="text-primary"
            >
              Terms&nbsp;
            </a>
            <span>and </span>
            <a
              href="?show_legal_dialog=true"
              className="text-primary"
            >
              Privacy <br /> Policy
            </a>
            .
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
