import { useEffect, useState } from 'react';
import { ethers } from 'ethers';
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
        for (const e of WIRING_ENTRIES) {
          const envRpc = (import.meta as any).env?.[e.rpcEnv] as string | undefined;
          const rpc = envRpc && envRpc.trim().length > 0 ? envRpc : (e as any).defaultRpc;
          const provider = new ethers.JsonRpcProvider(rpc);
          const routerAbi = ["function endpoint() view returns (address)", "function peers(uint64) view returns (bytes32)"];
          const escrowAbi = ["function router() view returns (address)"];
          const router = new ethers.Contract(e.router, routerAbi, provider);
          const endpoint = await router.endpoint();
          const endpointOk = endpoint.toLowerCase() === LZV2_ENDPOINT.toLowerCase();
          let escrowRouterOk: boolean | undefined = undefined;
          try {
            const escrow = new ethers.Contract(e.escrow, escrowAbi, provider);
            const cur = await escrow.router();
            escrowRouterOk = cur.toLowerCase() === e.router.toLowerCase();
          } catch {}
          out.push({ name: e.name, router: e.router, endpointOk, escrowRouterOk });
        }
      } catch (err: any) {
        console.error(err);
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
