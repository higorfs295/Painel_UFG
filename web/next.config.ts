import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // o monorepo tem lockfiles em vários níveis; sem isto o Next escolhe a raiz errada
  outputFileTracingRoot: __dirname,
  // imagem Docker enxuta: o build gera um server.js com só as dependências usadas
  output: "standalone",
  // A API é um serviço à parte (Fastify). Em desenvolvimento o navegador fala direto com ela
  // via NEXT_PUBLIC_API_URL; o CORS do backend já libera esta origem.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // pacotes só usados no cliente ganham import otimizado
    optimizePackageImports: ["framer-motion", "react-hot-toast"],
  },
};

export default nextConfig;
