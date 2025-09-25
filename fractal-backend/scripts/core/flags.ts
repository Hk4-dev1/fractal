// Simple CLI flags parser (extendable)
// Currently supports: --dry-run
export const isDryRun: boolean = process.argv.includes('--dry-run');

export function requireNotDryRun(action: string){
  if(isDryRun) throw new Error(`Action '${action}' not allowed in --dry-run mode`);
}
