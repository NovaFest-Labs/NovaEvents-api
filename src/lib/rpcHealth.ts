import { rpc as SorobanRpc } from "@stellar/stellar-sdk";

/** Confirms the configured Soroban RPC is reachable, bounded by a timeout so a dead RPC never hangs the check. */
export async function checkRpcHealth(
  server: SorobanRpc.Server,
  timeoutMs: number
): Promise<boolean> {
  try {
    await withTimeout(server.getHealth(), timeoutMs);
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("RPC health check timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
