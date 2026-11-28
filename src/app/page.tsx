import Categories from "@/components/home/categories";
// import Categories from "@/components/home/categories/index";
import Destinations from "@/components/home/destinations";
import FeaturedServices from "@/components/home/featured-services";
import Hero3D from "@/components/home/hero-3d";
import HowItWorks from "@/components/home/how-it-works";
import PlanningTips from "@/components/home/planning-tips";
import Testimonials from "@/components/home/testimonials";
import WhyChoose from "@/components/home/why-choose";

export default function Home() {
  return (
    <>
      <Hero3D />

      <FeaturedServices />

      <Categories />

      <WhyChoose />

      <HowItWorks />

      <Destinations />

      <Testimonials />

      <PlanningTips />
    </>
  );
}

/* export default function Home() {
  return (
    <main className="min-h-[200vh]">
      <section className="h-screen flex items-center justify-center">
        First Section
      </section>

      <section className="h-screen flex items-center justify-center">
        Second Section
      </section>
    </main>
  );
} */
