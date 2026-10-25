/**
 * Resolves the Express `trust proxy` setting from the TRUST_PROXY env var.
 *
 * Express's req.ip ignores X-Forwarded-For unless trust proxy is set, which
 * is the safe default against a client spoofing its own IP. But it also
 * means that, with no configuration, every request arriving through a
 * reverse proxy or load balancer (the only way this API is meant to be
 * deployed — see the Docker section of the README) resolves to the proxy's
 * own address. express-rate-limit then keys every client under that one
 * address, so one busy client exhausts the limit for everyone behind the
 * same proxy.
 *
 * Defaults to "1": trust exactly the first hop in front of Express, the
 * right value for a single reverse proxy or load balancer, which is the
 * common case this API is deployed behind. Set TRUST_PROXY to a higher
 * number of hops, "false"/"0" to disable (direct exposure, no proxy), or
 * any other value Express's trust proxy setting accepts (e.g. "loopback",
 * a specific IP/CIDR) for other topologies.
 */
export function resolveTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw === "") return 1;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^\d+$/.test(raw)) return Number(raw);
  return raw;
}
