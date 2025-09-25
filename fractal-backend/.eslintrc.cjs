module.exports = {
  root: true,
  env: { es2023: true, node: true, mocha: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { project: false, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  overrides: [
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  ignorePatterns: [
    'artifacts/**',
    'cache/**',
    'coverage/**',
    'typechain/**'
  ],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'prefer-const': 'off',
    'no-useless-escape': 'off',
  'no-empty': 'off',
  '@typescript-eslint/no-var-requires': 'off',
  'no-constant-condition': 'off'
  }
};
