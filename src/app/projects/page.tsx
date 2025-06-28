import Link from "next/link";

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
      title: "PTCL Data Tracking Dashboard",
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
    }
  ];

  return (
    <div className="bg-gradient-to-br from-black via-gray-900 to-blue-900 min-h-screen pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold text-center text-white mb-6">
            Our{" "}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Projects
            </span>
          </h1>

          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Showcasing our diverse experience across AI, automation, and custom web solutions —
            tailored to deliver real-world impact.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project, index) => (
            <a
              key={index}
              href={project.link || "#"}
              target={project.link ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="glass-effect rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 group block"
            >
              <div className="p-8">
                <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="emoji">{project.image}</span>
                </div>
                <div className="mb-4">
                  <span className="inline-block bg-blue-600/20 text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                    {project.category}
                  </span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">{project.title}</h3>
                <p className="text-gray-300 mb-6 leading-relaxed">{project.description}</p>
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

        <div className="text-center mt-16">
          <p className="text-xl text-gray-300 mb-8">
            Have an idea in mind? Let's turn it into reality.
          </p>
          <Link
            href="/contact"
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-12 py-4 rounded-full text-xl font-semibold hover:scale-105 transition-all duration-300 pulse-glow inline-block"
          >
            Start Your Project
          </Link>
        </div>
      </div>
    </div>
  );
}
