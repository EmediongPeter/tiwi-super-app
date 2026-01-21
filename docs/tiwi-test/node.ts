import { createSmartWalletClient } from "@account-kit/wallet-client";
import { alchemy, arbitrumSepolia, bsc } from "@account-kit/infra";
import { LocalAccountSigner } from "@aa-sdk/core";
import { useSmartWalletClient } from "@account-kit/react";
const signer = LocalAccountSigner.privateKeyToAccountSigner("0x1b3787e263f22ce7ce2cca0af9b4b367985c50e185b22329f5d7e261662e5e52");
console.log("🚀 ~ signer:", signer)
const transport = alchemy({
    apiKey: 'WLJoFMJfcDSAUbsnhlyCl', // use your Alchemy app api key here!
  });

const client = createSmartWalletClient({
    transport,
    chain: bsc, // use any chain imported from @account-kit/infra here!
    signer,
  });
console.log("🚀 ~ client:", client)

