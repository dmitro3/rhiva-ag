import type crypto from "crypto";
import {
  KMSClient,
  DecryptCommand,
  GenerateDataKeyCommand,
  type DataKeySpec,
} from "@aws-sdk/client-kms";

import { Secret } from "./secret";

type EncryptOptions = {
  KeySpec: DataKeySpec;
};

type DecryptOptions = {
  wrappedDek: string;
};

export class EncryptionError extends Error {}
export class DecryptionError extends Error {}

export class KMSSecret {
  private readonly kmsClient: KMSClient;
  private readonly options: {
    ivLength: number;
    algorithm: crypto.CipherGCMTypes;
  };

  constructor(
    private readonly kmsKeyId: string,
    region: string,
    options?: {
      ivLength: number;
      algorithm: crypto.CipherGCMTypes;
    },
    credentials?: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
    },
  ) {
    this.options = {
      ivLength: 12,
      algorithm: "aes-256-gcm",
      ...options,
    };

    this.kmsClient = new KMSClient({
      region,
      credentials,
    });
  }

  async encrypt<T extends object | string>(
    data: T,
    opts?: Partial<EncryptOptions>,
  ) {
    const options: EncryptOptions = {
      KeySpec: "AES_256",
      ...opts,
    };

    const { Plaintext: dek, CiphertextBlob: wrappedDek } =
      await this.kmsClient.send(
        new GenerateDataKeyCommand({
          KeyId: this.kmsKeyId,
          ...options,
        }),
      );

    if (dek && wrappedDek) {
      const secret = new Secret(dek, this.options);

      return {
        wrappedDek: wrappedDek.toBase64(),
        encryptedText: secret.encrypt(data),
      };
    }

    throw new EncryptionError("failed to generate data key from KMS");
  }

  async decrypt<T extends object | string>(
    encryptedText: string,
    opts: DecryptOptions,
  ) {
    const { Plaintext: dek } = await this.kmsClient.send(
      new DecryptCommand({
        KeyId: this.kmsKeyId,
        CiphertextBlob: Buffer.from(opts.wrappedDek, "base64"),
      }),
    );

    if (dek) {
      const secret = new Secret(dek, this.options);
      const decipher = secret.decrypt<T>(encryptedText);
      return decipher;
    }

    throw new DecryptionError("Failed to unwrap DEK");
  }

  async rewrap() {
    throw Error("Not implemented");
  }
}
