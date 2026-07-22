import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Défaut Next.js = 1 Mo, insuffisant pour une photo de téléphone ou un
      // scan de document (casier judiciaire, diplôme...).
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
