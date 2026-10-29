/** @type {import('next').NextConfig} */
const nextConfig={
 poweredByHeader:false,
 async headers(){
  return [{source:"/:path*",headers:[
   {key:"X-Content-Type-Options",value:"nosniff"},
   {key:"X-Frame-Options",value:"DENY"},
   {key:"Referrer-Policy",value:"no-referrer"},
   {key:"Content-Security-Policy",value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'"},
   {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"}
  ]}];
 }
};
export default nextConfig;
