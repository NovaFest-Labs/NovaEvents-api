import {
  Account,
  BASE_FEE,
  Contract,
  Networks,
  TransactionBuilder,
  scValToNative,
  xdr,
  rpc as SorobanRpc,
} from "@stellar/stellar-sdk";
import config from "./config";

export const rpcServer = new SorobanRpc.Server(config.stellarRpcUrl);
const contract = new Contract(config.contractId);

// Dummy source — simulation does not require a funded account.
const DUMMY_SOURCE = new Account(
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  "0"
);

export async function simulateContractCall(
  funcName: string,
  ...args: xdr.ScVal[]
): Promise<unknown> {
  const tx = new TransactionBuilder(DUMMY_SOURCE, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(funcName, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpcServer.simulateTransaction(tx);

  if (!SorobanRpc.Api.isSimulationSuccess(sim)) {
    throw new Error(
      `Contract call failed: ${(sim as SorobanRpc.Api.SimulateTransactionErrorResponse).error}`
    );
  }

  return scValToNative(sim.result!.retval);
}
