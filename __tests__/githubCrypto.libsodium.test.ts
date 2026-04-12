jest.mock("libsodium-wrappers-sumo", () => ({
  __esModule: true,
  default: {
    ready: Promise.resolve(),
    crypto_box_seal: jest.fn((message: Uint8Array, key: Uint8Array) =>
      Uint8Array.from([...message, ...key.slice(0, 2)]),
    ),
  },
}));

import sodium from "libsodium-wrappers-sumo";
import { encryptSecret } from "../infra/github/crypto";

describe("infra/github/crypto libsodium migration", () => {
  it("encrypts GitHub secret payloads via libsodium crypto_box_seal", async () => {
    const secret = await encryptSecret(Buffer.from("public-key").toString("base64"), "hello");
    expect(secret).toBe(Buffer.from("hellopu").toString("base64"));
    expect(sodium.crypto_box_seal).toHaveBeenCalledTimes(1);
  });
});
