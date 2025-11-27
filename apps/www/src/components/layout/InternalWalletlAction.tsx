import { IoIosSend } from "react-icons/io";
import { AiOutlineSwap } from "react-icons/ai";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { MdLogout, MdInbox } from "react-icons/md";
import { useInternalWallet } from "@/providers/InternalWalletProvider";

export default function InternalWalletAction() {
  const { signOut } = useAuth();
  const { send, receive, swap } = useInternalWallet();

  return (
    <>
      <button
        type="button"
        onClick={send}
      >
        <IoIosSend size={18} />
        <span>Send</span>
      </button>
      <button
        type="button"
        onClick={receive}
      >
        <MdInbox size={18} />
        <span>Receive</span>
      </button>
      <button
        type="button"
        onClick={swap}
      >
        <AiOutlineSwap size={18} />
        <span>Swap</span>
      </button>
      <button
        type="button"
        onClick={signOut}
      >
        <MdLogout size={18} />
        <span>Logout</span>
      </button>
    </>
  );
}
