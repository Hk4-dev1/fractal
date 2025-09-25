export function logStep(label: string, data?: any){
  const ts = new Date().toISOString();
  if(data!==undefined) console.log(`[${ts}] ${label}:`, data); else console.log(`[${ts}] ${label}`);
}

export async function time<T>(label: string, fn: ()=>Promise<T>): Promise<T>{
  const start = Date.now();
  try { return await fn(); } finally { console.log(`${label} took ${Date.now()-start}ms`); }
}
