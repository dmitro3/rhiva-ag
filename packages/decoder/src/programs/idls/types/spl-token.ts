export type SPLToken = {
  address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  metadata: {
    name: "spl-token";
    version: "2.1.0";
    spec: "0.1.0";
  };
  errors: [
    {
      code: 0;
      name: "NotRentExempt";
      msg: "Lamport balance below rent-exempt threshold";
    },
    {
      code: 1;
      name: "InsufficientFunds";
      msg: "Insufficient funds";
    },
    {
      code: 2;
      name: "InvalidMint";
      msg: "Invalid Mint";
    },
    {
      code: 3;
      name: "MintMismatch";
      msg: "Account not associated with this Mint";
    },
    {
      code: 4;
      name: "OwnerMismatch";
      msg: "Owner does not match";
    },
    {
      code: 5;
      name: "FixedSupply";
      msg: "Fixed supply";
    },
    {
      code: 6;
      name: "AlreadyInUse";
      msg: "Already in use";
    },
    {
      code: 7;
      name: "InvalidNumberOfProvidedSigners";
      msg: "Invalid number of provided signers";
    },
    {
      code: 8;
      name: "InvalidNumberOfRequiredSigners";
      msg: "Invalid number of required signers";
    },
    {
      code: 9;
      name: "UninitializedState";
      msg: "State is uninitialized";
    },
    {
      code: 10;
      name: "NativeNotSupported";
      msg: "Instruction does not support native tokens";
    },
    {
      code: 11;
      name: "NonNativeHasBalance";
      msg: "Non-native account can only be closed if its balance is zero";
    },
    {
      code: 12;
      name: "InvalidInstruction";
      msg: "Invalid instruction";
    },
    {
      code: 13;
      name: "InvalidState";
      msg: "State is invalid for requested operation";
    },
    {
      code: 14;
      name: "Overflow";
      msg: "Operation overflowed";
    },
    {
      code: 15;
      name: "AuthorityTypeNotSupported";
      msg: "Account does not support specified authority type";
    },
    {
      code: 16;
      name: "MintCannotFreeze";
      msg: "This token mint cannot freeze accounts";
    },
    {
      code: 17;
      name: "AccountFrozen";
      msg: "Account is frozen";
    },
    {
      code: 18;
      name: "MintDecimalsMismatch";
      msg: "The provided decimals value different from the Mint decimals";
    },
    {
      code: 19;
      name: "NonNativeNotSupported";
      msg: "Instruction does not support non-native tokens";
    },
  ];
};
