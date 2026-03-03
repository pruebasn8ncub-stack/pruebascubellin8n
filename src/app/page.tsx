import dynamic from 'next/dynamic';
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";

// Lazy load below-the-fold components to drastically improve TTI
const About = dynamic(() => import('@/components/About').then(mod => mod.About));
const Services = dynamic(() => import('@/components/Services').then(mod => mod.Services));
const Team = dynamic(() => import('@/components/Team').then(mod => mod.Team));
const Reviews = dynamic(() => import('@/components/Reviews').then(mod => mod.Reviews));
const Location = dynamic(() => import('@/components/Location').then(mod => mod.Location));
const FAQ = dynamic(() => import('@/components/FAQ').then(mod => mod.FAQ));
const BookingForm = dynamic(() => import('@/components/BookingForm').then(mod => mod.BookingForm));
const Footer = dynamic(() => import('@/components/Footer').then(mod => mod.Footer));
const ChatWidget = dynamic(() => import('@/components/ChatWidget').then(mod => mod.ChatWidget));

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <About />
        <Services />
        <Team />
        <Reviews />
        <Location />
        <FAQ />
        <BookingForm />
      </main>
      <Footer />
      <ChatWidget />
    </div>
  );
}
