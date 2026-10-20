import type { NextConfig } from "next";

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (base local) carga un .wasm desde node_modules; react-pdf usa módulos nativos de Node.
  serverExternalPackages: ["@electric-sql/pglite", "@react-pdf/renderer"],
  // Los PDF leen los logos institucionales desde public/marca con fs: hay que incluirlos
  // en las funciones que se despliegan (public/ no viaja con ellas por defecto).
  outputFileTracingIncludes: {
    "/admin/exportar/pdf": ["./public/marca/*.png"],
    "/admin/qr/pdf": ["./public/marca/*.png"],
  },
  experimental: {
    // Fotos de las obras: el navegador las achica antes de subirlas. Vercel corta en 4,5 MB.
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns: supabase
      ? [{ protocol: "https", hostname: supabase.hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
