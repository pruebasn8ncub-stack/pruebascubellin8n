/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'svtbqdpulegufprcnppi.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/api/v1/:path*',
                destination: 'https://api-agenda-web.wfrhms.easypanel.host/api/v1/:path*',
            },
        ];
    },
};

export default nextConfig;
