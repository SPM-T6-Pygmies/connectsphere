import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables `forbidden()` and `forbidden.tsx`, which staff pages use to show
    // the access-denied screen with a 403 (SPM-16). Experimental in Next 16.
    authInterrupts: true,
  },
};

export default nextConfig;
