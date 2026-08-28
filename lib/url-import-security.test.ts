import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeImportUrl,
  createPinnedLookup,
  fetchSafeImportUrl,
  isBlockedImportAddress,
  type AddressResolver,
} from "./url-import-security";

const resolvesPublic: AddressResolver = async () => [{ address: "93.184.216.34", family: 4 }];
const resolvesPrivate: AddressResolver = async () => [{ address: "169.254.169.254", family: 4 }];

test("URL import blocks private, link-local, and reserved IP destinations", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.0.2.1",
    "192.168.1.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "::",
    "::1",
    "::7f00:1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "64:ff9b::c0a8:1",
    "2002:c0a8:0101::",
    "4000::1",
    "fe00::1",
    "fe7f::1",
    "fc00::1",
    "fe80::1",
  ]) {
    assert.equal(isBlockedImportAddress(address), true, address);
  }

  assert.equal(isBlockedImportAddress("93.184.216.34"), false);
  assert.equal(isBlockedImportAddress("2606:2800:220:1:248:1893:25c8:1946"), false);
});

test("URL import permits a public HTTPS URL whose DNS addresses are public", async () => {
  await assert.doesNotReject(() => assertSafeImportUrl(new URL("https://example.com/article"), resolvesPublic));
});

test("URL import rejects a hostname that resolves to a private address", async () => {
  await assert.rejects(
    () => assertSafeImportUrl(new URL("https://public-looking.example/article"), resolvesPrivate),
    /private or reserved network address/i,
  );
});

test("URL import rejects non-web protocols and local hostnames before fetching", async () => {
  await assert.rejects(() => assertSafeImportUrl(new URL("file:///etc/passwd"), resolvesPublic), /http.*https/i);
  await assert.rejects(() => assertSafeImportUrl(new URL("https://localhost/article"), resolvesPublic), /private or local/i);
});

test("URL import validates every redirect target before requesting it", async () => {
  const requested: string[] = [];
  const fetcher = async (input: URL | string) => {
    requested.push(String(input));
    return new Response(null, {
      status: 302,
      headers: { location: "http://169.254.169.254/latest/meta-data" },
    });
  };

  await assert.rejects(
    () => fetchSafeImportUrl(new URL("https://example.com/article"), { fetcher, resolveAddresses: resolvesPublic }),
    /private or local/i,
  );
  assert.deepEqual(requested, ["https://example.com/article"]);
});

test("pinned DNS lookup returns the validated public address used by the connection", async () => {
  const lookup = createPinnedLookup(resolvesPublic);
  const result = await new Promise<{ address: string; family: number }>((resolve, reject) => {
    lookup("example.com", {}, (error: NodeJS.ErrnoException | null, address: string, family: number) => {
      if (error || !address || !family) return reject(error ?? new Error("missing lookup result"));
      resolve({ address, family });
    });
  });

  assert.deepEqual(result, { address: "93.184.216.34", family: 4 });
});
