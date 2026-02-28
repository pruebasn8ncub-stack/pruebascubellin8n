import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Services } from "@/components/Services";
import { Team } from "@/components/Team";
import { Reviews } from "@/components/Reviews";
import { Location } from "@/components/Location";
import { FAQ } from "@/components/FAQ";
import { BookingForm } from "@/components/BookingForm";
import { Footer } from "@/components/Footer";
import { FloatingWhatsApp } from "@/components/FloatingWhatsApp";

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
      <FloatingWhatsApp />
    </div>
  );
}
