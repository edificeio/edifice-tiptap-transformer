/**
 * Polls a URL until it responds (any non-network-error status) or a timeout
 * elapses. Used to wait for the transformer container to be up before
 * running tests against it (docker-compose's distroless production image
 * has no shell, so this can't be a Docker-native HEALTHCHECK — it's run
 * from a container/host that does have Node).
 *
 * Usage: tsx scripts/wait-for-http.ts <url> [timeoutMs]
 */
const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 30000);

if (!url) {
  console.error('Usage: tsx scripts/wait-for-http.ts <url> [timeoutMs]');
  process.exit(1);
}

async function main() {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(`ready: ${url} (after ${Date.now() - start}ms)`);
        return;
      }
    } catch {
      // not up yet, keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  console.error(`timed out waiting for ${url} after ${timeoutMs}ms`);
  process.exit(1);
}

main();
