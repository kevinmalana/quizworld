import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent } from "undici";
import ipaddr from "ipaddr.js";

export type ResolvedAddress = { address: string; family: number };
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const LOCAL_HOSTS = new Set(["localhost", "localhost.", "ip6-localhost"]);

export class UnsafeImportUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeImportUrlError";
  }
}

function normalizeAddress(address: string) {
  return address.toLowerCase().replace(/^\[|\]$/g, "");
}

// Only globally-routable unicast addresses may be reached. ipaddr.js handles
// IPv4-mapped/compatible IPv6 and special-use CIDRs without a fragile denylist.
export function isBlockedImportAddress(address: string) {
  const normalized = normalizeAddress(address);
  if (!isIP(normalized)) return true;

  const embeddedIpv4 = normalized.match(/^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (embeddedIpv4) {
    const high = Number.parseInt(embeddedIpv4[1], 16);
    const low = Number.parseInt(embeddedIpv4[2], 16);
    return isBlockedImportAddress(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }

  try {
    const parsed = ipaddr.process(normalized);
    if (parsed.kind() === "ipv6") {
      const firstHextet = Number.parseInt(parsed.toNormalizedString().split(":")[0], 16);
      if (firstHextet < 0x2000 || firstHextet > 0x3fff) return true;
    }
    return parsed.range() !== "unicast";
  } catch {
    return true;
  }
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return LOCAL_HOSTS.has(normalized) || normalized.endsWith(".local") || normalized.endsWith(".localhost");
}

const defaultResolver: AddressResolver = async (hostname) => lookup(hostname, { all: true, verbatim: true });

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string, family: number) => void;

export function createPinnedLookup(resolveAddresses: AddressResolver): (hostname: string, options: unknown, callback: LookupCallback) => void {
  return (hostname, _options, callback) => {
    void resolveAddresses(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some(({ address }) => isBlockedImportAddress(address))) {
          callback(new UnsafeImportUrlError("This URL resolves to a private or reserved network address."), "", 0);
          return;
        }

        const [address] = addresses;
        callback(null, address.address, address.family);
      },
      () => callback(new UnsafeImportUrlError("This URL hostname could not be resolved."), "", 0),
    );
  };
}

// Connections use this lookup callback, so the address validated by policy is the
// address actually dialled; a second DNS resolution cannot turn into DNS rebinding.
const safeDispatcher = new Agent({ connect: { lookup: createPinnedLookup(defaultResolver) } });

export async function assertSafeImportUrl(url: URL, resolveAddresses: AddressResolver = defaultResolver) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeImportUrlError("Only http and https URLs are supported.");
  }

  const hostname = normalizeAddress(url.hostname);
  if (isBlockedHostname(hostname) || (isIP(hostname) !== 0 && isBlockedImportAddress(hostname))) {
    throw new UnsafeImportUrlError("Private or local network URLs cannot be imported.");
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolveAddresses(hostname);
  } catch {
    throw new UnsafeImportUrlError("This URL hostname could not be resolved.");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => isBlockedImportAddress(address))) {
    throw new UnsafeImportUrlError("This URL resolves to a private or reserved network address.");
  }
}

type ImportFetcher = (input: URL | string, init?: RequestInit) => Promise<Response>;

type SafeFetchOptions = {
  fetcher?: ImportFetcher;
  resolveAddresses?: AddressResolver;
  signal?: AbortSignal;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 3;

export async function fetchSafeImportUrl(initialUrl: URL, options: SafeFetchOptions = {}) {
  const fetcher = options.fetcher ?? fetch;
  const resolveAddresses = options.resolveAddresses ?? defaultResolver;
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    await assertSafeImportUrl(currentUrl, resolveAddresses);
    const response = await fetcher(currentUrl, {
      headers: {
        "User-Agent": "QuizWorldImporter/1.0",
        Accept: "text/html, text/plain;q=0.9, */*;q=0.1",
      },
      signal: options.signal,
      redirect: "manual",
      ...(options.fetcher ? {} : { dispatcher: safeDispatcher }),
    } as RequestInit);

    if (!REDIRECT_STATUSES.has(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new UnsafeImportUrlError("This URL returned an invalid redirect.");
    if (redirectCount === MAX_REDIRECTS) throw new UnsafeImportUrlError("This URL redirected too many times.");

    try {
      currentUrl = new URL(location, currentUrl);
    } catch {
      throw new UnsafeImportUrlError("This URL returned an invalid redirect.");
    }
  }

  throw new UnsafeImportUrlError("This URL redirected too many times.");
}
