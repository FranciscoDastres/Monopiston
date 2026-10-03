// Development scripts expose the API entry point during the full audit.
// Production mode needs it explicitly because development scripts are skipped.
const production = process.argv.includes('--production');

export default {
  ignoreBinaries: ['ngrok'], // Installed on the developer's machine.
  tags: production ? ['-testonly'] : [],
  workspaces: {
    'apps/backend': {
      entry: ['src/scripts/*.ts!', ...(production ? ['src/server.ts!'] : [])],
      project: ['src/**/*.ts!', 'test/**/*.ts'],
    },
    'apps/frontend': {
      project: ['src/**/*.{ts,tsx,css}!', '!src/test/**!'],
    },
    'packages/database': {
      entry: ['scripts/*.mjs!'],
      project: [
        'src/**/*.ts!',
        'scripts/*.mjs!',
        'prisma/**/*.{ts,prisma}!',
        'test/**/*.ts',
      ],
      // Required by the generated Prisma client, which is excluded from Git.
      ignoreDependencies: ['@prisma/client'],
    },
    'packages/contracts': {
      project: ['src/**/*.ts!', 'test/**/*.ts'],
    },
  },
};
