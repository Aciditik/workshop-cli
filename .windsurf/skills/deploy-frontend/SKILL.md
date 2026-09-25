---
description: Build the Next.js frontend in standalone mode and package it into ~/Desktop/frontend-build.tar.gz. Run this after any frontend change when asked to deploy/package.
---

# Deploy Frontend — workshop-cli

After a frontend change, run these steps **in order** from the repo root
(`/home/mathieu/Desktop/MDS/workshop-cli`). Stop and report if a step fails —
do not continue past a failing build.

1. Pull latest changes:

   ```
   git pull
   ```

2. Build the production bundle (standalone output):

   ```
   NEXT_PUBLIC_API_URL=https://api.terraformingmars.fr npm run build
   ```

3. Copy static assets into the standalone output (required — the standalone
   server does not include them):

   ```
   cp -r .next/static .next/standalone/.next/static
   cp -r public .next/standalone/public
   ```

4. Package the standalone folder into a tarball on the Desktop
   (equivalent to `cd .next/standalone && tar -czf ...`):

   ```
   tar -czf ~/Desktop/frontend-build.tar.gz -C .next/standalone .
   ```

5. Show the resulting archive size:

   ```
   ls -lh ~/Desktop/frontend-build.tar.gz
   ```

Notes:
- `NEXT_PUBLIC_API_URL` is baked at build time — always set it to the prod API.
- The tarball contains the contents of `.next/standalone` (server.js, node_modules,
  static assets, public files) ready to be uploaded/extracted on the host.
