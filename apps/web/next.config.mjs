/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for better serverless deployment
  output: "standalone",
  
  // Disable ESLint during builds (handle separately)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during builds (handle separately)  
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
