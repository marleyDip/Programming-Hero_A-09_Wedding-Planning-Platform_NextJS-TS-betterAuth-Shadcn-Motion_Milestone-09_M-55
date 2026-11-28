import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,

  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  images: {
    remotePatterns: [
      // This allows HTTPS images from any hostname.
      {
        protocol: "https",
        hostname: "**",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "i.pravatar.cc",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },

      {
        protocol: "https",
        hostname: "i.ibb.co",
        // pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
