import type {NextConfig} from 'next';
const config: NextConfig = {poweredByHeader:false, turbopack:{root:process.cwd()}, outputFileTracingIncludes:{'/api/waitlist':['./certs/supabase-ca.crt']}};
export default config;
