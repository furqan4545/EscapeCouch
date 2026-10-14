import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase:new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')),
  title:'EscapeCouch · Get lean by playing a game.',
  description:'Push-ups, high scores, and friendly competition. Preorder for $9.30/year with a locked annual price and a 7-day refund guarantee after activation.',
  openGraph:{title:'Your next high score is a workout.',description:'Burn calories by playing a game. Get the $9.30/year founder price before launch.',type:'website',images:[{url:'/assets/social-preview.jpg',width:1200,height:630}]},
  twitter:{card:'summary_large_image'},icons:{icon:'/assets/app-icon.png'},
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>;}
