const { execSync } = require('child_process');

const pairs = [
  ['ethereum-sepolia','arbitrum-sepolia'],
  ['arbitrum-sepolia','ethereum-sepolia'],
  ['ethereum-sepolia','optimism-sepolia'],
  ['optimism-sepolia','ethereum-sepolia'],
  ['base-sepolia','arbitrum-sepolia'],
  ['arbitrum-sepolia','base-sepolia'],
  ['ethereum-sepolia','base-sepolia'],
  ['base-sepolia','ethereum-sepolia'],
  ['arbitrum-sepolia','optimism-sepolia'],
  ['optimism-sepolia','arbitrum-sepolia'],
  ['base-sepolia','optimism-sepolia'],
  ['optimism-sepolia','base-sepolia']
];

for (const [src, dst] of pairs) {
  console.log(`\n=== ${src} -> ${dst} ===`);
  execSync(`SRC_CHAIN_KEY=${src} DST_CHAIN_KEY=${dst} npm run -s e2e:v2`, { stdio: 'inherit' });
}
