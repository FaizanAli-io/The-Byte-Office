"use client";

import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton } from "../components/CTAButtons";
import BackgroundEffect from "../components/BackgroundEffect";

export default function Projects() {
  const projects = [
    {
      title: "Cyberlooper.ai",
      description:
        "A secure chat platform for AI agents — featuring session-based messaging, tool integrations, and LangGraph orchestration.",
      tech: ["Next.js", "LangChain", "FastAPI", "PostgreSQL"],
      category: "AI & Full-Stack",
      image: "🧠",
      link: "https://cyberlooper.ai/login"
    },
    {
      title: "Retail Sales Digital Dashboard",
      description:
        "Internal analytics and operations tool to track field service agents, record submissions, and geospatial activity.",
      tech: ["Next.js", "PostgreSQL", "Tailwind", "Google Maps API"],
      category: "Automation",
      image: "📡",
      link: "https://ptcl-data-tracking.vercel.app/"
    },
    {
      title: "Regenerative Aesthetics Web App",
      description:
        "A high-end aesthetic clinic frontend with booking, lead capture, and detailed service showcase built for conversions.",
      tech: ["Next.js", "Tailwind", "Framer Motion", "React Hook Form"],
      category: "Frontend & UI/UX",
      image: "💅",
      link: "https://regenerative-aesthetics-web-app.vercel.app/"
    },
    {
      title: "Sales Automation Pipeline (Pipedrive)",
      description:
        "An end-to-end pipeline that automates lead intake, qualification, and follow-ups using the Pipedrive CRM.",
      tech: ["Pipedrive API", "Node.js", "Google Apps Script", "Zapier"],
      category: "Automation",
      image: "🔁"
    },
    {
      title: "WhatsApp Bot for Multi-Site Deployment",
      description:
        "Custom-built WhatsApp automation bot that dynamically integrates into client websites for instant lead capture.",
      tech: ["Node.js", "Twilio API", "WebSockets", "Express.js"],
      category: "Chat Automation",
      image: "💬"
    },
    {
      title: "Skiing Analysis via Computer Vision",
      description:
        "A CV-based project analyzing skiing posture and movement using pose estimation and motion detection models.",
      tech: ["Python", "OpenCV", "MediaPipe", "NumPy"],
      category: "Computer Vision",
      image: "⛷️"
    },
    {
      title: "Legislative AI Assistant with RAG",
      description:
        "An AI-powered assistant that uses Retrieval-Augmented Generation to answer legal and policy-related queries based on legislative documents.",
      tech: ["Python", "LangChain", "Pinecone", "OpenAI API", "FastAPI"],
      category: "Legal AI / RAG",
      image: "📜"
    }
  ];

  return (
    <div className="relative bg-black min-h-screen overflow-hidden">
      <BackgroundEffect />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Our"
          highlight="Projects"
          subtitle={
            <>
              A curated selection of our most impactful work — blending AI, automation, and modern
              UI to solve{" "}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
                real problems
              </span>
              .
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {projects.map((project, index) => (
            <a
              key={index}
              href={project.link || "#"}
              target={project.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="group relative bg-white/5 backdrop-blur-md rounded-3xl p-8 border border-white/10 transition-all duration-500 hover:bg-white/10 hover:border-white/20 hover:scale-[1.02] hover:shadow-2xl"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-3xl"></div>

              <div className="relative z-10">
                <div className="text-5xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {project.image}
                </div>
                <span className="inline-block mb-4 bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                  {project.category}
                </span>
                <h3 className="text-2xl font-bold text-white mb-3 leading-snug">{project.title}</h3>
                <p className="text-gray-300 text-base leading-relaxed mb-6">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.tech.map((tech, idx) => (
                    <span
                      key={idx}
                      className="bg-gray-800/50 text-gray-300 px-3 py-1 rounded-full text-sm"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="text-center mt-24">
          <h2 className="text-4xl font-bold text-white mb-6">Have a bold idea?</h2>
          <p className="text-xl text-gray-300 mb-10 max-w-xl mx-auto leading-relaxed">
            Whether it’s building from scratch or enhancing your tech stack, we’re here to bring
            your vision to life.
          </p>
          <PrimaryCTAButton href="/contact" label="Start Your Project" />
        </div>
      </div>
    </div>
  );
}
