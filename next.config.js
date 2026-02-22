/** @type {import('next').NextConfig} */
const nextConfig = {
    compiler: {
        // Remove all console.log in production, but keep console.error and console.warn
        removeConsole: process.env.NODE_ENV === 'production' ? {
            exclude: ['error', 'warn'],
        } : false,
    },
    // Other config options can go here
};

export default nextConfig;
