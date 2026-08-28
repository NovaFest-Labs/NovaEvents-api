import { describe, it, expect, vi, beforeEach } from "vitest";
import { simulateContractCall } from "../lib/stellar";
import { getAdmin } from "./adminService";

vi.mock("../lib/stellar", () => ({
  simulateContractCall: vi.fn(),
}));

describe("getAdmin", () => {
  beforeEach(() => {
    vi.mocked(simulateContractCall).mockReset();
  });

  it("returns the admin address from the contract", async () => {
    vi.mocked(simulateContractCall).mockResolvedValue(
      "GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234"
    );

    const result = await getAdmin();

    expect(result).toBe("GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234");
    expect(simulateContractCall).toHaveBeenCalledWith("get_admin");
  });

  it("rethrows unrelated errors instead of swallowing them", async () => {
    const rpcFailure = new Error("RPC request timed out");
    vi.mocked(simulateContractCall).mockRejectedValue(rpcFailure);

    await expect(getAdmin()).rejects.toBe(rpcFailure);
  });
});
