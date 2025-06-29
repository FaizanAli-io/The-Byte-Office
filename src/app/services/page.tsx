"use client";

import Link from "next/link";
import { useState } from "react";
import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton } from "../components/CTAButtons";
import BackgroundEffect from "../components/BackgroundEffect";

interface Service {
  title: string;
  description: string;
  features: string[];
  icon: string;
  gradient: string;
  color: string;
}

export default function Services() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  const services: Service[] = [
    {
      title: "AI & Machine Learning",
      description: "Custom AI solutions tailored to your business needs",
      features: [
        "Natural Language Processing",
        "Computer Vision",
        "Predictive Analytics",
        "Recommendation Systems",
        "Chatbots & Virtual Assistants"
      ],
      icon: "🧠",
      gradient: "from-blue-500 to-cyan-500",
      color: "blue"
    },
    {
      title: "Automation Solutions",
      description: "Streamline operations and boost productivity",
      features: [
        "Workflow Automation",
        "Data Processing",
        "API Integration",
        "Task Scheduling",
        "Business Process Optimization"
      ],
      icon: "🔄",
      gradient: "from-purple-500 to-pink-500",
      color: "purple"
    },
    {
      title: "Full-Stack Development",
      description: "Complete web applications from concept to deployment",
      features: [
        "React/Next.js Applications",
        "Node.js Backend Development",
        "Database Design & Management",
        "Cloud Infrastructure",
        "Mobile-Responsive Design"
      ],
      icon: "🚀",
      gradient: "from-emerald-500 to-teal-500",
      color: "emerald"
    },
    {
      title: "Cloud & DevOps",
      description: "Scalable infrastructure and deployment solutions",
      features: [
        "AWS/Azure/GCP Setup",
        "CI/CD Pipelines",
        "Container Orchestration",
        "Performance Optimization",
        "Security Implementation"
      ],
      icon: "☁️",
      gradient: "from-indigo-500 to-purple-500",
      color: "indigo"
    }
  ];

  return (
    <div className="relative bg-black min-h-screen overflow-hidden">
      <BackgroundEffect />

      {/* Content */}
      <div className="relative z-10">
        <SectionHeading
          title="Our"
          highlight="Services"
          subtitle={
            <>
              Comprehensive technology solutions designed to accelerate your business growth and
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                {" "}
                digital transformation
              </span>
            </>
          }
        />

        {/* Services Grid */}
        <section className="pb-32 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="group relative bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl"
                  onMouseEnter={() => setHoveredCard(index)}
                  onMouseLeave={() => setHoveredCard(null)}
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

                  {/* Hover Effect Border */}
                  <div
                    className={`absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r ${service.gradient} p-[1px]`}
                  >
                    <div className="w-full h-full bg-black/90 rounded-3xl"></div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    {/* Header */}
                    <div className="flex items-center mb-6">
                      <div className="text-5xl mr-4 group-hover:scale-110 transition-transform duration-300">
                        {service.icon}
                      </div>
                      <h2 className="text-3xl font-bold text-white group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-gray-200 group-hover:bg-clip-text transition-all duration-300">
                        {service.title}
                      </h2>
                    </div>

                    {/* Description */}
                    <p className="text-gray-300 text-lg mb-8 group-hover:text-gray-200 transition-colors duration-300 leading-relaxed">
                      {service.description}
                    </p>

                    {/* Features List */}
                    <div className="space-y-4">
                      {service.features.map((feature, idx) => (
                        <div
                          key={idx}
                          className="flex items-center text-gray-300 group-hover:text-gray-200 transition-all duration-300"
                          style={{
                            transitionDelay: `${idx * 50}ms`
                          }}
                        >
                          <div
                            className={`w-2 h-2 rounded-full bg-gradient-to-r ${service.gradient} mr-4 group-hover:scale-125 transition-transform duration-300`}
                          ></div>
                          <span className="group-hover:translate-x-1 transition-transform duration-300">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Service-specific CTA */}
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <Link
                        href="/contact"
                        className={`inline-flex items-center text-sm font-semibold bg-gradient-to-r ${service.gradient} bg-clip-text text-transparent hover:scale-105 transition-transform duration-300`}
                      >
                        Learn More About {service.title}
                        <svg
                          className="ml-2 w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 8l4 4m0 0l-4 4m4-4H3"
                          />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action Section */}
        <section className="py-32 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/20 via-purple-900/20 to-pink-900/20"></div>
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-5xl md:text-6xl font-bold text-white mb-8">
              Ready to Transform Your{" "}
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Business
              </span>
              ?
            </h2>
            <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              Let's discuss how our comprehensive technology solutions can accelerate your growth
              and drive innovation in your industry.
            </p>
            <PrimaryCTAButton href="/contact" label="Discuss your Project" />
          </div>
        </section>
      </div>
    </div>
  );
}
