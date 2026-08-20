import assert from "node:assert/strict";

import { parseExpoPort, resolveTailscaleEndpoint } from "./tailscale-dev";

const endpoint = resolveTailscaleEndpoint({
  BackendState: "Running",
  TailscaleIPs: ["100.124.15.26", "fd7a:115c:a1e0::2835:f1a"],
  Self: {
    DNSName: "ubuntu-4gb-hel1-1.tail02545f.ts.net.",
  },
});

assert.deepEqual(endpoint, {
  dnsName: "ubuntu-4gb-hel1-1.tail02545f.ts.net",
  ipv4: "100.124.15.26",
});
assert.equal(parseExpoPort([]), 8081);
assert.equal(parseExpoPort(["--clear"]), 8081);
assert.equal(parseExpoPort(["--port", "8092"]), 8092);
assert.equal(parseExpoPort(["--port=8093"]), 8093);
assert.throws(
  () =>
    resolveTailscaleEndpoint({
      BackendState: "Stopped",
      TailscaleIPs: [],
      Self: { DNSName: "" },
    }),
  /Tailscale is not running/,
);
assert.throws(() => parseExpoPort(["--port", "70000"]), /Invalid Expo port/);
assert.throws(() => parseExpoPort(["--port"]), /Missing value after --port/);

console.log("tailscale dev tests: ok");
