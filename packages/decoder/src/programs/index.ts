import { collectionToMap } from "@rhiva-ag/shared";

import DLMM from "./idls/meteora.json";
import AmmV2 from "./idls/raydium.json";
import WhirlPool from "./idls/orca.json";
import Jupiter from "./idls/jupiter.json";
import SplToken from "./idls/spl-token.json";
import type { ProgramError } from "../types";
import SplToken2022 from "./idls/spl-token-2022.json";
import SystemProgram from "./idls/system-program.json";
import AssociatedTokenAccount from "./idls/spl-token-2022.json";

export const ErrorsByProgramId = {
  [DLMM.address]: collectionToMap(DLMM.errors, (error) => error.code),
  [DLMM.address]: collectionToMap(DLMM.errors, (error) => error.code),
  [AmmV2.address]: collectionToMap(AmmV2.errors, (error) => error.code),
  [Jupiter.address]: collectionToMap(Jupiter.errors, (error) => error.code),
  [SplToken.address]: collectionToMap(SplToken.errors, (error) => error.code),
  [WhirlPool.address]: collectionToMap(WhirlPool.errors, (error) => error.code),
  [SystemProgram.address]: collectionToMap(
    SystemProgram.errors,
    (error) => error.code,
  ),
  [SplToken2022.address]: collectionToMap(
    SplToken2022.errors,
    (error) => error.code,
  ),
  [AssociatedTokenAccount.address]: collectionToMap(
    AssociatedTokenAccount.errors,
    (error) => error.code,
  ),
};

export const getProgramErrorMessage = ({
  programId,
  errorCode,
}: ProgramError) => {
  const errors = ErrorsByProgramId[programId];

  if (errors) {
    const error = errors.get(errorCode);
    if (error) return error.msg;
  }
};
