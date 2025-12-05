import { KMSSecret, loadWallet } from "@rhiva-ag/shared";
import { secret } from "../src/instances";
import { getEnv } from "../src/env";

const $wallet = {
  id: "5TXB5cNcqkVSNAhem5vp3Uj4nBkqL8T7gShzXLjqVdEQ",
  key: "IXZq3SJhR5JD2dtLnMY5LdrKf5+0VnObeYilcI30QpFkFkO1w8mh3pcvNfVi1dQwhfgfju+9fAVx7+PvB/MmINjdtjTWY8UcJle2dhgxYp990g4j3tzsTSUHwsir7edK+JQL9q8SslxHceUra2hxjxnXEt/0ZQ==",
  wrappedDek:
    "AQIDAHjz9RewFXd0OYPQcZ9gYkXssrywkmOFR2ne+R7/whyQJAHYCfbKlDZejYGWuLUiJ0/zAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMlPlwC3RQSVYtakNZAgEQgDudQXqKXY80VMVIu1VIVGVVOa0yk9emoAdkhS+EsjVhIjvguuNvV6D/NJEtw411mpl/4bsn2sd/OMofjQ==",
  external: false,
  primary: true,
  user: "1aae5586-8fa7-4957-b265-d1c0f12d473a",
  createdAt: "2025-12-05T05:51:13.842Z",
};

const wallet = await loadWallet($wallet, secret);
console.log(wallet.publicKey.toBase58());
