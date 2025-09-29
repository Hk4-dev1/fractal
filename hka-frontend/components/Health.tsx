import { useEffect, useState } from 'react';
import { createPublicClient, http } from 'viem';
import { WIRING_ENTRIES, LZV2_ENDPOINT } from '../services/wiring-config';

type Row = {
  name: string;
  router: string;
  endpointOk: boolean;
  escrowRouterOk?: boolean;
  peersOk?: boolean;
  error?: string;
};

export function Health() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const out: Row[] = [];
      try {
        // Minimal viem ABIs for the two read calls we need.
        const routerAbi = [
          { name: 'endpoint', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
        ] as const;
        const escrowAbi = [
          { name: 'router', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }
        ] as const;

    for (const e of WIRING_ENTRIES) {
          try {
      const envAny = import.meta as unknown as { env?: Record<string, string | undefined> };
      const envRpc = envAny.env?.[e.rpcEnv] as string | undefined;
      const rpc = envRpc && envRpc.trim().length > 0 ? envRpc : e.defaultRpc;
            // Create an ephemeral public client per RPC (fast & lightweight for a few calls).
            const client = createPublicClient({ transport: http(rpc) });
            const endpoint = await client.readContract({
              address: e.router as `0x${string}`,
              abi: routerAbi,
              functionName: 'endpoint'
            });
            const endpointOk = endpoint.toLowerCase() === LZV2_ENDPOINT.toLowerCase();
            let escrowRouterOk: boolean | undefined = undefined;
            try {
              const cur = await client.readContract({
                address: e.escrow as `0x${string}`,
                abi: escrowAbi,
                functionName: 'router'
              });
              escrowRouterOk = cur.toLowerCase() === e.router.toLowerCase();
            } catch {
              // missing escrow or read error
            }
            out.push({ name: e.name, router: e.router, endpointOk, escrowRouterOk });
          } catch (innerErr) {
            const msg = innerErr instanceof Error ? innerErr.message : String(innerErr);
            out.push({ name: e.name, router: e.router, endpointOk: false, error: msg });
          }
        }
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
      } finally {
        if (!cancelled) {
          setRows(out);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Network Health</h2>
      {loading ? (
        <div>Checking…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <div className="font-medium">{r.name}</div>
              <div className="text-xs break-all text-muted-foreground">{r.router}</div>
              <div className="mt-2 text-sm">
                <div>
                  Endpoint: <span className={r.endpointOk ? 'text-green-600' : 'text-red-600'}>{r.endpointOk ? 'OK' : 'Mismatch'}</span>
                </div>
                {r.escrowRouterOk !== undefined && (
                  <div>
                    Escrow.router: <span className={r.escrowRouterOk ? 'text-green-600' : 'text-red-600'}>{r.escrowRouterOk ? 'OK' : 'Mismatch'}</span>
                  </div>
                )}
                {r.error && (
                  <div className="text-red-600">{r.error}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">Uses read-only RPCs from VITE_RPC_* envs.</div>
    </div>
  );
}

export default Health;
