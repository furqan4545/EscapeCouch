import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  metadataBase:new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')),
  title:'EscapeCouch — Get lean by playing a game.',
  description:'Push-ups, high scores, and friendly competition. Join the EscapeCouch waitlist for iPhone and Android.',
  openGraph:{title:'Your next high score is a workout.',description:'Meet EscapeCouch. Join the waitlist for the push-up game you can play with friends.',type:'website',images:[{url:'/assets/social-preview.jpg',width:1200,height:630}]},
  twitter:{card:'summary_large_image'},icons:{icon:'/assets/app-icon.png'},
};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>;}
