"use client";

import SectionHeading from "./components/SectionHeading";
import BackgroundEffect from "./components/BackgroundEffect";
import { PrimaryCTAButton, SecondaryCTAButton } from "./components/CTAButtons";

interface Service {
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

export default function Home() {
  const services: Service[] = [
    {
      title: "AI Development",
      description:
        "Custom AI solutions, machine learning models, and intelligent systems that adapt to your business needs.",
      icon: "🤖",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      title: "Automation",
      description:
        "Streamline workflows, reduce manual tasks, and boost productivity with smart automation solutions.",
      icon: "⚙️",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      title: "Full-Stack Development",
      description:
        "End-to-end web applications, APIs, and scalable systems built with modern technologies.",
      icon: "💻",
      gradient: "from-emerald-500 to-teal-500"
    }
  ];

  return (
    <div className="relative bg-black min-h-screen overflow-hidden">
      <BackgroundEffect />

      {/* Content */}
      <div className="relative z-10">
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-6xl mx-auto">
            <SectionHeading
              title="Transform Your"
              highlight="Digital Future"
              subtitle={
                <>
                  We're <span className="text-blue-400 font-semibold">The Byte Office</span> —
                  crafting tomorrow's technology today with{" "}
                  <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                    AI-powered solutions
                  </span>
                  , intelligent automation, and cutting-edge development.
                </>
              }
            />

            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <PrimaryCTAButton href="/contact" label="Start Your Project" />
              <SecondaryCTAButton href="/projects" label="View Our Work" />
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20">
              <h2 className="text-5xl md:text-6xl font-bold text-white mb-6">
                Our{" "}
                <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Expertise
                </span>
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
                Cutting-edge solutions that push boundaries and deliver extraordinary results
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="group relative bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:scale-105 hover:shadow-2xl"
                  style={{
                    animation: "fadeInUp 0.6s ease forwards",
                    animationDelay: `${index * 0.1}s`,
                    opacity: 0
                  }}
                >
                  {/* Gradient Background */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl`}
                  ></div>

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                      {service.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-200 group-hover:bg-clip-text transition-all duration-300">
                      {service.title}
                    </h3>
                    <p className="text-gray-300 leading-relaxed group-hover:text-gray-200 transition-colors duration-300">
                      {service.description}
                    </p>
                  </div>

                  {/* Hover Effect Border */}
                  <div
                    className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${service.gradient} p-[1px]`}
                  >
                    <div className="w-full h-full bg-black/90 rounded-3xl"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20"></div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-8">
              Ready to{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Innovate
              </span>
              ?
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Transform your vision into reality with cutting-edge AI, automation, and development
              solutions. Let's build the future together.
            </p>
            <PrimaryCTAButton href="/contact" label="Start Your Journey" />
          </div>
        </section>
      </div>
    </div>
  );
}
