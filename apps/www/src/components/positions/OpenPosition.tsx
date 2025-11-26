import type { Pair } from "@rhiva-ag/dex-api";

import OrcaOpenPosition from "./orca";
import RaydiumOpenPosition from "./raydium";
import MeteoraOpenPosition from "./meteora";

type OpenPositionProps = {
  open: boolean;
  pool: Pair;
  dex: "meteora" | "orca" | "saros-dlmm" | "raydium-clmm";
  onClose: React.Dispatch<React.SetStateAction<boolean>>;
} & Pick<React.ComponentProps<"div">, "className">;

export default function OpenPosition({ dex, ...props }: OpenPositionProps) {
  if (dex === "orca") return <OrcaOpenPosition {...props} />;
  if (dex === "raydium-clmm") return <RaydiumOpenPosition {...props} />;
  if (dex === "meteora") return <MeteoraOpenPosition {...props} />;
}
