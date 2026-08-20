import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

type TailscaleStatus = {
  BackendState?: string;
  TailscaleIPs?: string[];
  Self?: {
    DNSName?: string;
  };
};

export type TailscaleEndpoint = {
  dnsName: string;
  ipv4: string;
};

export function resolveTailscaleEndpoint(
  status: TailscaleStatus,
): TailscaleEndpoint {
  if (status.BackendState !== "Running") {
    throw new Error(
      "Tailscale is not running on this VPS. Start it before using web:tailscale.",
    );
  }

  const ipv4 = status.TailscaleIPs?.find((address) =>
    /^100\.(?:\d{1,3}\.){2}\d{1,3}$/.test(address),
  );
  if (!ipv4) {
    throw new Error("Tailscale did not report an IPv4 address for this VPS.");
  }

  const dnsName = status.Self?.DNSName?.replace(/\.$/, "");
  if (!dnsName) {
    throw new Error(
      "Tailscale MagicDNS is unavailable. Enable MagicDNS for this tailnet.",
    );
  }

  return { dnsName, ipv4 };
}

export function parseExpoPort(args: string[]): number {
  const equalsArg = args.find((arg) => arg.startsWith("--port="));
  const portArgIndex = args.indexOf("--port");
  if (portArgIndex !== -1 && args[portArgIndex + 1] === undefined) {
    throw new Error("Missing value after --port.");
  }

  const rawPort =
    equalsArg?.slice("--port=".length) ??
    (portArgIndex === -1 ? undefined : args[portArgIndex + 1]) ??
    "8081";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid Expo port: ${rawPort}`);
  }

  return port;
}

function readTailscaleStatus(): TailscaleStatus {
  const result = spawnSync("tailscale", ["status", "--json"], {
    encoding: "utf8",
  });

  if (result.error) {
    throw new Error(`Could not run tailscale: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "tailscale status failed");
  }

  try {
    return JSON.parse(result.stdout) as TailscaleStatus;
  } catch {
    throw new Error("tailscale status returned invalid JSON");
  }
}

function rejectConflictingHostArgs(args: string[]): void {
  const conflicting = args.find(
    (arg) =>
      arg === "--localhost" ||
      arg === "--lan" ||
      arg === "--tunnel" ||
      arg === "--host" ||
      arg.startsWith("--host="),
  );

  if (conflicting) {
    throw new Error(
      `web:tailscale owns the Expo connection mode. Remove ${conflicting}.`,
    );
  }
}

function run(): void {
  const userArgs = process.argv.slice(2);
  rejectConflictingHostArgs(userArgs);

  const port = parseExpoPort(userArgs);
  const endpoint = resolveTailscaleEndpoint(readTailscaleStatus());
  const dnsUrl = `http://${endpoint.dnsName}:${port}`;
  const ipUrl = `http://${endpoint.ipv4}:${port}`;
  const hasPortArg = userArgs.some(
    (arg) => arg === "--port" || arg.startsWith("--port="),
  );
  const expoArgs = [
    "start",
    "--web",
    "--host",
    "lan",
    ...(hasPortArg ? [] : ["--port", String(port)]),
    ...userArgs,
  ];

  console.log("So, When? over Tailscale");
  console.log(`Mac URL: ${dnsUrl}`);
  console.log(`IP fallback: ${ipUrl}`);
  console.log(
    "Expo may also print localhost below. Remote devices should use the Mac URL.\n",
  );

  const expoBin = fileURLToPath(
    new URL("../node_modules/.bin/expo", import.meta.url),
  );
  const child = spawn(expoBin, expoArgs, {
    env: {
      ...process.env,
      EXPO_PACKAGER_PROXY_URL: dnsUrl,
      REACT_NATIVE_PACKAGER_HOSTNAME: endpoint.ipv4,
    },
    stdio: "inherit",
  });

  child.on("error", (error) => {
    console.error(`Could not start Expo: ${error.message}`);
    process.exitCode = 1;
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
