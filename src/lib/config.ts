import { Networks } from "@stellar/stellar-sdk";

const config = {
  stellarRpcUrl: process.env.STELLAR_RPC_URL!,
  contractId: process.env.NOVA_EVENTS_CONTRACT_ID!,
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET,
  port: Number(process.env.PORT ?? 3001),
} as const;

export default config;
