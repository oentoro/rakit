import type { NextConfig } from 'next';
const config:NextConfig={serverExternalPackages:['node:sqlite'],turbopack:{root:process.cwd()},allowedDevOrigins:['127.0.0.1']};
export default config;
