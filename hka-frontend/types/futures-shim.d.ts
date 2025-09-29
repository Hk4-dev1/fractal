/* eslint-disable @typescript-eslint/no-explicit-any */
// Temporary shim to skip typechecking the futures module while focusing on AMM and Cross-chain swap.
declare module './components/PerpetualFutures' {
  export const PerpetualFutures: any;
  const _default: any;
  export default _default;
}

declare module '../components/PerpetualFutures' {
  export const PerpetualFutures: any;
  const _default: any;
  export default _default;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
