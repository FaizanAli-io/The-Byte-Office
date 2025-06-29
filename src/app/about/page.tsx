"use client";

import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton } from "../components/CTAButtons";
import BackgroundEffect from "../components/BackgroundEffect";

export default function About() {
  const features = [
    {
      icon: "⚡",
      title: "Rapid Delivery",
      description: "Fast turnaround times without compromising on quality or attention to detail."
    },
    {
      icon: "🎨",
      title: "Custom Solutions",
      description: "Tailored approaches that fit your unique business requirements and goals."
    },
    {
      icon: "🔧",
      title: "Latest Technologies",
      description: "We stay current with emerging tech to provide cutting-edge solutions."
    },
    {
      icon: "🤝",
      title: "Collaborative Approach",
      description: "We work closely with you throughout the entire development process."
    },
    {
      icon: "📈",
      title: "Proven Results",
      description: "Track record of delivering projects that drive measurable business impact."
    },
    {
      icon: "🛡️",
      title: "Quality Assurance",
      description: "Rigorous testing and quality control ensure reliable, robust solutions."
    }
  ];

  return (
    <div className="relative bg-black min-h-screen overflow-hidden">
      <BackgroundEffect />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="About"
          highlight="The Byte Office"
          subtitle={
            <>
              We're passionate technologists dedicated to transforming businesses through{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                innovative AI, automation, and development solutions
              </span>
              .
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <h2 className="text-4xl font-bold text-white mb-6">Our Mission</h2>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              At The Byte Office, we believe that every business deserves access to cutting-edge
              technology. Our mission is to democratize AI and automation, making these powerful
              tools accessible to organizations of all sizes.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              We combine deep technical expertise with a passion for innovation to deliver solutions
              that don't just meet requirements — they exceed expectations and drive real business
              transformation.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-10 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-xl">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
            <p className="text-gray-300">
              To be the leading freelance agency that bridges the gap between emerging technologies
              and practical business solutions, empowering organizations to thrive in the digital
              age.
            </p>
          </div>
        </div>

        <div className="mb-24">
          <h2 className="text-4xl font-bold text-white text-center mb-12">Why Choose Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-center hover:bg-white/10 hover:border-white/20 transition-all duration-300 shadow-xl"
              >
                <div className="text-4xl mb-4">
                  <span>{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA Section */}
        <div className="text-center py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20 rounded-3xl backdrop-blur-sm">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to{" "}
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Get Started
            </span>
            ?
          </h2>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Let's discuss how we can help transform your business with innovative technology
            solutions.
          </p>
          <PrimaryCTAButton href="/contact" label="Start Your Project" />
        </div>
      </div>
    </div>
  );
}
