"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import BackgroundEffect from "./components/BackgroundEffect";

interface MousePosition {
  x: number;
  y: number;
}

interface Service {
  title: string;
  description: string;
  icon: string;
  gradient: string;
}

export default function Home() {
  const [mousePosition, setMousePosition] = useState<MousePosition>({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

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
      <BackgroundEffect mousePosition={mousePosition} />

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 pt-24">
          <div className="text-center max-w-6xl mx-auto">
            {/* Animated Title */}
            <div className="mb-8 overflow-hidden">
              <h1 className="text-6xl md:text-8xl font-black text-white mb-4 leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                  Digital Future
                </span>
              </h1>
            </div>

            <div className="mb-12 overflow-hidden">
              <p className="text-xl md:text-2xl text-gray-300 leading-relaxed max-w-4xl mx-auto">
                We're <span className="text-blue-400 font-semibold">The Byte Office</span> -
                crafting tomorrow's technology today with
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                  {" "}
                  AI-powered solutions
                </span>
                , intelligent automation, and cutting-edge development.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <Link
                href="/contact"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/25"
              >
                <span className="relative z-10">Start Your Project</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>
              </Link>

              <Link
                href="/projects"
                className="group relative px-8 py-4 border-2 border-white/20 rounded-full text-white font-semibold text-lg backdrop-blur-sm transition-all duration-300 hover:bg-white/10 hover:border-white/40 hover:scale-105"
              >
                <span className="relative z-10">View Our Work</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"></div>
              </Link>
            </div>

            {/* Scroll Indicator */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
              <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
                <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Floating Elements */}
          <div className="absolute top-1/4 left-[10%] w-20 h-20 bg-gradient-to-br from-blue-500/30 to-cyan-500/30 rounded-full animate-pulse blur-sm"></div>
          <div
            className="absolute top-1/3 right-[15%] w-16 h-16 bg-gradient-to-br from-purple-500/30 to-pink-500/30 rounded-full animate-pulse blur-sm"
            style={{ animationDelay: "1s" }}
          ></div>
          <div
            className="absolute bottom-1/4 left-[20%] w-12 h-12 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-full animate-pulse blur-sm"
            style={{ animationDelay: "2s" }}
          ></div>
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
                    animationDelay: `${index * 0.2}s`
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
            <Link
              href="/contact"
              className="group relative px-12 py-5 text-xl font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/25 overflow-hidden"
            >
              <span className="relative z-10">Start Your Journey</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-full blur opacity-25 group-hover:opacity-50 transition-opacity duration-300"></div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
