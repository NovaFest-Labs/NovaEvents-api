import { simulateContractCall } from "../lib/stellar";

export async function getAdmin(): Promise<string> {
  return (await simulateContractCall("get_admin")) as string;
}
