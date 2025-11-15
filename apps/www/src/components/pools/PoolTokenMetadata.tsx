import clsx from "clsx";
import { format } from "util";
import { useRouter } from "next/navigation";
import { useAuth } from "@rhiva-ag/auth-ui/client";

import Image from "../Image";
import CopyButton from "../CopyButton";
import IcDex from "@/assets/icons/ic_dex";
import IcAiIcon from "@/assets/icons/ic_ai";

type PoolTokenMetadata = {
  id: string;
  name: string;
  image: {
    base: {
      src: string;
      alt: string;
    };
    quote: {
      src: string;
      alt: string;
    };
  };
  dex: "meteora" | "saros-dlmm" | "orca" | "raydium-clmm";
} & React.ComponentProps<"div">;

export default function PoolTokenMetadata({
  id,
  name,
  image,
  dex,
  ...props
}: PoolTokenMetadata) {
  const router = useRouter();
  const { isAuthenticated, signIn } = useAuth();

  return (
    <div
      {...props}
      className={clsx("flex items-center space-x-8", props.className)}
    >
      <div className="flex items-center space-x-2 lt-sm:flex-1">
        <div className="flex w-12 relative lt-sm:w-10">
          <Image
            src={image.base.src}
            width={32}
            height={32}
            alt={image.base.alt}
            className="rounded-full z-10 lt-sm:size-6"
          />
          <Image
            src={image.quote.src}
            width={32}
            height={32}
            alt={image.quote.alt}
            className="absolute right-0 rounded-full z-0 lt-sm:size-6"
          />
        </div>
        <h1 className="text-base font-medium sm:text-xl sm:font-bold">
          {name}
        </h1>
        <CopyButton
          content={id}
          className="text-gray"
        />
        <IcDex
          dex={dex}
          width={16}
          height={16}
          className="rounded-full"
        />
      </div>
      <button
        type="button"
        className="flex items-center space-x-2 bg-primary/10 px-2 py-1 border border-primary/50 text-primary fill-primary rounded"
        onClick={() => {
          if (isAuthenticated)
            router.push(format("/ai?prompt=Analyse this pool %s", id));
          else signIn();
        }}
      >
        <IcAiIcon
          width={18}
          height={18}
        />
        <span>Ask Ai</span>
      </button>
    </div>
  );
}
