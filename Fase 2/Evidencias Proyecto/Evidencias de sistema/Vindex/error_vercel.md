19:14:13.103 Running build in Washington, D.C., USA (East) – iad1
19:14:13.104 Build machine configuration: 2 cores, 8 GB
19:14:13.234 Cloning github.com/vindex-mkt/mrb_capstone (Branch: main, Commit: 81a6c0f)
19:14:13.235 Previous build caches not available.
19:14:14.144 Cloning completed: 909.000ms
19:14:14.583 Running "vercel build"
19:14:14.595 Vercel CLI 64.0.2
19:14:14.909 Installing dependencies...
19:14:15.460 npm warn Unknown env config "cache-dir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
19:14:29.444 
19:14:29.444 added 523 packages in 14s
19:14:29.444 
19:14:29.444 146 packages are looking for funding
19:14:29.444   run `npm fund` for details
19:14:29.499 Detected Next.js version: 16.3.4
19:14:29.501 Running "next build"
19:14:29.877 ▲ Next.js 16.3.4 (Turbopack)
19:14:29.944   Applying modifyConfig from Vercel
19:14:29.945 ✓ Running next.config.js took 71ms
19:14:29.998 Attention: Next.js now collects completely anonymous telemetry regarding usage.
19:14:29.998 This information is used to shape Next.js' roadmap and prioritize features.
19:14:29.998 You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
19:14:29.999 https://nextjs.org/telemetry
19:14:29.999 
19:14:30.020 
19:14:30.059   Creating an optimized production build ...
19:14:40.017 
19:14:40.017 > Build error occurred
19:14:40.021 Error: Turbopack build failed with 2 errors:
19:14:40.023 ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts:1:1
19:14:40.023 Error: Module not found: Can't resolve 'zustand'
19:14:40.024 > 1 | import { create } from "zustand";
19:14:40.024     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
19:14:40.024   2 | import { createJSONStorage, persist } from "zustand/middleware";
19:14:40.024   3 |
19:14:40.024   4 | export type CartItem = {
19:14:40.024 
19:14:40.024 
19:14:40.024 
19:14:40.024 Import traces:
19:14:40.025   Client Component Browser:
19:14:40.025     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts [Client Component Browser]
19:14:40.025     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Client Component Browser]
19:14:40.025     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Server Component]
19:14:40.026 
19:14:40.026   Client Component SSR:
19:14:40.026     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts [Client Component SSR]
19:14:40.026     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Client Component SSR]
19:14:40.026     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Server Component]
19:14:40.026 
19:14:40.026 https://nextjs.org/docs/messages/module-not-found
19:14:40.026 
19:14:40.026 
19:14:40.026 ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts:2:1
19:14:40.027 Error: Module not found: Can't resolve 'zustand/middleware'
19:14:40.027   1 | import { create } from "zustand";
19:14:40.027 > 2 | import { createJSONStorage, persist } from "zustand/middleware";
19:14:40.027     | ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
19:14:40.027   3 |
19:14:40.027   4 | export type CartItem = {
19:14:40.027   5 |   id: number;
19:14:40.027 
19:14:40.027 
19:14:40.027 
19:14:40.027 Import traces:
19:14:40.027   Client Component Browser:
19:14:40.027     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts [Client Component Browser]
19:14:40.027     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Client Component Browser]
19:14:40.027     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Server Component]
19:14:40.027 
19:14:40.027   Client Component SSR:
19:14:40.028     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts [Client Component SSR]
19:14:40.028     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Client Component SSR]
19:14:40.028     ./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/app/cart/page.tsx [Server Component]
19:14:40.028 
19:14:40.028 https://nextjs.org/docs/messages/module-not-found
19:14:40.028 
19:14:40.028 
19:14:40.028     at <unknown> (./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts:1:1)
19:14:40.028     at <unknown> (https://nextjs.org/docs/messages/module-not-found)
19:14:40.028     at <unknown> (./Fase 2/Evidencias Proyecto/Evidencias de Sistema/Vindex/apps/web/lib/store/useCartStore.ts:2:1)
19:14:40.028     at <unknown> (https://nextjs.org/docs/messages/module-not-found)
19:14:40.118 Error: [BUILD_UTILS_SPAWN_1] Command "next build" exited with 1