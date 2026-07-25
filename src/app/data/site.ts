export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://thebyteoffice.com";

export const company = {
  name: "The Byte Office",
  email: "thebyteoffice@gmail.com",
  summary:
    "The Byte Office designs and builds production-grade software, AI applications, automations, and full-stack web platforms for businesses that need reliable delivery.",
  workingHours: "Mon - Fri: 9 AM - 6 PM (PKT)",
  responseTime: "Within 24 hours",
};

export const navItems = [
  { name: "Services", href: "/services" },
  { name: "Work", href: "/projects" },
  { name: "About", href: "/about" },
  { name: "Process", href: "/#process" },
  { name: "Contact", href: "/contact" },
];

export const services = [
  {
    title: "Full-Stack Web Development",
    summary:
      "Plan, design, and build web applications that are fast, secure, maintainable, and ready for real users.",
    outcome:
      "Launch SaaS platforms, dashboards, portals, and internal tools without rebuilding the foundation later.",
    capabilities: [
      "React and Next.js applications",
      "Backend systems and APIs",
      "Database design",
      "Responsive UI engineering",
    ],
  },
  {
    title: "AI and LLM Applications",
    summary:
      "Build practical AI products that connect language models to your data, workflows, and users.",
    outcome:
      "Turn AI experiments into useful assistants, copilots, and agentic workflows with guardrails and observability.",
    capabilities: [
      "AI agents",
      "RAG systems",
      "LangChain and LangGraph",
      "OpenAI API integrations",
    ],
  },
  {
    title: "Automation Solutions",
    summary:
      "Replace repetitive manual work with reliable workflows, integrations, and operational systems.",
    outcome:
      "Reduce handoffs, improve response time, and keep business data moving between the tools your team already uses.",
    capabilities: [
      "CRM automation",
      "Lead capture workflows",
      "API integrations",
      "Business process optimization",
    ],
  },
  {
    title: "Cloud, Backend, and Data Systems",
    summary:
      "Design the server-side pieces that keep modern products dependable as usage grows.",
    outcome:
      "Ship systems with cleaner APIs, safer data flows, and deployment practices that support long-term maintenance.",
    capabilities: [
      "FastAPI and Node.js",
      "PostgreSQL and MongoDB",
      "Cloud deployment",
      "Data pipelines",
    ],
  },
];

export const projects = [
  {
    title: "Cyberlooper.ai",
    category: "AI and Full-Stack",
    industry: "AI agent platform",
    problem:
      "Teams needed a secure chat experience for AI agents with session-based messaging and connected tools.",
    solution:
      "Built a platform experience with LangGraph orchestration, backend APIs, and a modern Next.js interface.",
    impact:
      "Created a focused foundation for agent conversations, tool integrations, and secure user workflows.",
    tech: ["Next.js", "LangChain", "FastAPI", "PostgreSQL"],
    link: "https://cyberlooper.ai/login",
  },
  {
    title: "Retail Sales Digital Dashboard",
    category: "Automation",
    industry: "Retail operations",
    problem:
      "Field activity and submissions needed to be tracked in one operational view with location context.",
    solution:
      "Delivered an internal analytics dashboard for agents, submissions, and geospatial activity.",
    impact:
      "Helped operations teams monitor field work and centralize activity records in a structured system.",
    tech: ["Next.js", "PostgreSQL", "Tailwind", "Google Maps API"],
    link: "https://ptcl-data-tracking.vercel.app/",
  },
  {
    title: "Regenerative Aesthetics Web App",
    category: "Frontend and UI/UX",
    industry: "Healthcare and aesthetics",
    problem:
      "A premium clinic needed a conversion-focused web experience for services, booking, and lead capture.",
    solution:
      "Designed and built a high-end frontend with service detail pages, motion, and structured contact paths.",
    impact:
      "Improved the clinic's digital presentation with a polished service showcase built around inquiries.",
    tech: ["Next.js", "Tailwind", "Framer Motion", "React Hook Form"],
    link: "https://regenerative-aesthetics-web-app.vercel.app/",
  },
  {
    title: "Sales Automation Pipeline",
    category: "Automation",
    industry: "Sales operations",
    problem:
      "Lead intake, qualification, and follow-ups were spread across manual steps in the sales process.",
    solution:
      "Connected Pipedrive with supporting automation scripts and handoff logic for a cleaner pipeline.",
    impact:
      "Reduced repetitive CRM work and made follow-up activity more consistent across incoming leads.",
    tech: ["Pipedrive API", "Node.js", "Google Apps Script", "Zapier"],
  },
  {
    title: "WhatsApp Bot for Multi-Site Deployment",
    category: "Chat automation",
    industry: "Lead capture",
    problem:
      "Client websites needed faster visitor response without manually monitoring every inquiry channel.",
    solution:
      "Built a reusable WhatsApp automation bot that can integrate into multiple client sites.",
    impact:
      "Gave businesses an instant conversational entry point for capturing and routing leads.",
    tech: ["Node.js", "Twilio API", "WebSockets", "Express.js"],
  },
  {
    title: "Skiing Analysis via Computer Vision",
    category: "Computer Vision",
    industry: "Sports analytics",
    problem:
      "Movement and posture analysis required a repeatable computer vision workflow instead of manual review.",
    solution:
      "Created a pose-estimation prototype to analyze skiing posture and motion patterns.",
    impact:
      "Demonstrated how computer vision can turn video into structured movement feedback.",
    tech: ["Python", "OpenCV", "MediaPipe", "NumPy"],
  },
  {
    title: "Legislative AI Assistant with RAG",
    category: "Legal AI and RAG",
    industry: "Legal and policy research",
    problem:
      "Users needed clearer access to answers grounded in legislative documents and policy material.",
    solution:
      "Built an AI assistant using retrieval-augmented generation to answer questions from document context.",
    impact:
      "Made complex legal and policy content easier to query while keeping answers tied to source material.",
    tech: ["Python", "LangChain", "Pinecone", "OpenAI API", "FastAPI"],
  },
];

export const processSteps = [
  {
    title: "Discovery",
    text: "Clarify the business goal, users, constraints, risks, and what success should look like.",
  },
  {
    title: "Strategy and Planning",
    text: "Turn the idea into a practical roadmap, technical approach, and delivery plan.",
  },
  {
    title: "Design and Architecture",
    text: "Shape the user experience, data model, integrations, and system boundaries before heavy build work.",
  },
  {
    title: "Development",
    text: "Build in focused iterations with clear communication and working software at each stage.",
  },
  {
    title: "Testing and Launch",
    text: "Validate behavior, responsiveness, accessibility, performance, and production readiness.",
  },
  {
    title: "Ongoing Support",
    text: "Improve, maintain, and extend the product as real users and business needs evolve.",
  },
];

export const techGroups = [
  {
    title: "Frontend",
    items: ["Next.js", "React", "Tailwind CSS", "Framer Motion"],
  },
  {
    title: "Backend",
    items: ["Node.js", "FastAPI", "Express.js", "REST APIs"],
  },
  {
    title: "AI and Data",
    items: ["OpenAI API", "LangChain", "LangGraph", "RAG", "OpenCV"],
  },
  {
    title: "Databases",
    items: ["PostgreSQL", "MongoDB", "Pinecone"],
  },
  {
    title: "Cloud and Integrations",
    items: ["Vercel", "Google Maps API", "Twilio", "Pipedrive", "Zapier"],
  },
];

export const whyChooseUs = [
  {
    title: "Product-minded engineering",
    text: "Technical decisions are connected to the customer journey, operational workflow, and long-term business goal.",
  },
  {
    title: "Clear communication",
    text: "You get practical updates, visible progress, and fewer surprises throughout the build.",
  },
  {
    title: "AI expertise with restraint",
    text: "AI is used where it creates business value, with attention to reliability, data flow, and user trust.",
  },
  {
    title: "Maintainable foundations",
    text: "Systems are built so future features, integrations, and scale do not require starting over.",
  },
];

export const faqs = [
  {
    question: "What does The Byte Office build?",
    answer:
      "The Byte Office builds custom software, SaaS platforms, web applications, backend APIs, AI agents, RAG systems, automation workflows, and business software.",
  },
  {
    question: "Can you improve an existing product?",
    answer:
      "Yes. The Byte Office can modernize existing interfaces, add AI or automation features, improve backend systems, and prepare products for launch or scale.",
  },
  {
    question: "How do projects usually begin?",
    answer:
      "Most projects begin with a discovery conversation to understand goals, constraints, users, timeline, and the best technical path.",
  },
];
