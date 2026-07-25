import BackgroundEffect from "./components/BackgroundEffect";
import SectionHeading from "./components/SectionHeading";
import {
  PrimaryCTAButton,
  QuietCTAButton,
  SecondaryCTAButton,
} from "./components/CTAButtons";
import {
  company,
  faqs,
  processSteps,
  projects,
  services,
  siteUrl,
  techGroups,
  whyChooseUs,
} from "./data/site";
import { createMetadata, jsonLd } from "./lib/seo";

export const metadata = createMetadata({
  title: "Software Development and AI Solutions Company",
  description:
    "The Byte Office builds custom software, SaaS platforms, AI agents, RAG systems, automation workflows, backend APIs, and full-stack web applications.",
});

function HeroVisual() {
  return (
    <div className="dark-panel relative overflow-hidden p-5 sm:p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.28),transparent_18rem)]" />
      <div className="relative">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">
              Delivery workspace
            </p>
            <p className="mt-1 text-lg font-bold text-white">
              AI product sprint
            </p>
          </div>
          <span className="rounded-full bg-emerald-400/12 px-3 py-1 text-xs font-bold text-emerald-200">
            In progress
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {[
            ["Discovery", "Business workflows mapped", "100%"],
            ["Architecture", "RAG pipeline and API plan", "Ready"],
            ["Build", "Interface, backend, automations", "Active"],
          ].map(([title, text, status]) => (
            <div
              key={title}
              className="rounded-md border border-white/10 bg-white/[0.04] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">{title}</h2>
                  <p className="mt-1 text-sm text-slate-300">{text}</p>
                </div>
                <span className="text-xs font-semibold text-blue-200">
                  {status}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-md bg-white p-4 text-slate-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Outcome focus
              </p>
              <p className="mt-1 text-base font-extrabold">
                Software that ships cleanly and keeps working.
              </p>
            </div>
            <div className="hidden h-14 w-14 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white sm:flex">
              BO
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ service, index }: { service: (typeof services)[number]; index: number }) {
  return (
    <article className="surface-card reveal p-6" style={{ animationDelay: `${index * 80}ms` }}>
      <span className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white">
        {String(index + 1).padStart(2, "0")}
      </span>
      <h3 className="heading-md">{service.title}</h3>
      <p className="body-copy mt-3">{service.summary}</p>
      <p className="mt-5 border-l-2 border-blue-700 pl-4 text-sm font-semibold leading-6 text-slate-800">
        {service.outcome}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {service.capabilities.slice(0, 3).map((capability) => (
          <span key={capability} className="chip">
            {capability}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProjectCard({
  project,
  featured = false,
}: {
  project: (typeof projects)[number];
  featured?: boolean;
}) {
  const content = (
    <article
      className={`group h-full overflow-hidden rounded-lg border border-slate-900/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md ${
        featured ? "lg:grid lg:grid-cols-[0.9fr_1.1fr]" : ""
      }`}
    >
      <div className="flex min-h-56 flex-col justify-between bg-slate-950 p-6 text-white">
        <div>
          <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase text-slate-300">
            {project.category}
          </span>
          <h3 className="mt-6 text-2xl font-extrabold leading-tight">
            {project.title}
          </h3>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2">
          <span className="h-16 rounded-md bg-white/10" />
          <span className="h-16 rounded-md bg-blue-400/20" />
          <span className="h-16 rounded-md bg-teal-400/20" />
        </div>
      </div>
      <div className="p-6">
        <p className="text-sm font-bold uppercase text-blue-800">
          {project.industry}
        </p>
        <dl className="mt-5 space-y-4">
          <div>
            <dt className="text-sm font-bold text-slate-950">Problem</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-600">
              {project.problem}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-slate-950">Solution</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-600">
              {project.solution}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold text-slate-950">Impact</dt>
            <dd className="mt-1 text-sm leading-6 text-slate-600">
              {project.impact}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          {project.tech.map((tech) => (
            <span key={tech} className="chip">
              {tech}
            </span>
          ))}
        </div>
      </div>
    </article>
  );

  if (project.link) {
    return (
      <a href={project.link} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return content;
}

export default function Home() {
  const featuredProjects = projects.slice(0, 3);
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "The Byte Office",
    url: siteUrl,
    description: company.summary,
    mainEntity: services.map((service) => ({
      "@type": "Service",
      name: service.title,
      description: service.summary,
      provider: {
        "@type": "Organization",
        name: company.name,
      },
    })),
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <div className="page-shell">
      {jsonLd(schema)}
      {jsonLd(faqSchema)}
      <BackgroundEffect />

      <section className="container-page grid min-h-[92vh] items-center gap-12 pb-16 pt-32 lg:grid-cols-[1.05fr_0.95fr] lg:pt-36">
        <div className="reveal">
          <p className="eyebrow">Software development and AI solutions</p>
          <h1 className="display mt-6 text-balance">
            Build reliable software for the work your business actually runs on.
          </h1>
          <p className="lead mt-7 max-w-2xl">
            {company.name} helps businesses launch full-stack products, AI
            agents, RAG systems, automations, APIs, and cloud-ready software
            with the discipline of a production engineering team.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <PrimaryCTAButton href="/contact" label="Start a Project" />
            <SecondaryCTAButton href="/projects" label="View Our Work" />
          </div>
        </div>
        <HeroVisual />
      </section>

      <section className="container-page section-tight">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Production-minded", "Built around reliability, maintenance, and clear handoff."],
            ["AI-capable", "Experience with agents, RAG, LLM apps, and automation."],
            ["Full-stack delivery", "Frontend, backend, data, integrations, and deployment."],
          ].map(([title, text]) => (
            <div key={title} className="muted-panel p-5">
              <h2 className="text-base font-extrabold text-slate-950">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="container-page section">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Services"
            title="Practical engineering for products, AI, and operations."
            subtitle="The Byte Office focuses on software that improves workflows, launches products faster, and gives teams systems they can depend on."
          />
          <QuietCTAButton href="/services" label="Explore services" />
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {services.map((service, index) => (
            <ServiceCard key={service.title} service={service} index={index} />
          ))}
        </div>
      </section>

      <section id="work" className="section bg-slate-950 text-white">
        <div className="container-page">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow border-white/10 bg-white/10 text-blue-100">
                Featured work
              </p>
              <h2 className="mt-5 text-balance text-4xl font-extrabold leading-tight text-white md:text-6xl">
                Case-study style work across AI, automation, and web platforms.
              </h2>
            </div>
            <SecondaryCTAButton
              href="/projects"
              label="See all projects"
              className="border-white/25 bg-white/10 text-white hover:bg-white hover:text-slate-950"
            />
          </div>
          <div className="mt-12 grid gap-5">
            <ProjectCard project={featuredProjects[0]} featured />
            <div className="grid gap-5 lg:grid-cols-2">
              {featuredProjects.slice(1).map((project) => (
                <ProjectCard key={project.title} project={project} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="container-page section">
        <SectionHeading
          eyebrow="Why choose us"
          title="A technical partner for teams that care about outcomes."
          subtitle="Good software is not just code. It is product judgment, architecture, communication, testing, and the ability to keep moving when requirements get real."
          align="center"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {whyChooseUs.map((item) => (
            <article key={item.title} className="surface-card p-6">
              <h3 className="heading-md text-xl">{item.title}</h3>
              <p className="body-copy mt-3 text-sm">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="process" className="container-page section">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            eyebrow="Process"
            title="A clear path from idea to production."
            subtitle="The process is designed to make delivery predictable without hiding the technical tradeoffs that matter."
          />
          <div className="grid gap-4">
            {processSteps.map((step, index) => (
              <article
                key={step.title}
                className="surface-card grid gap-4 p-5 sm:grid-cols-[4rem_1fr]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="heading-md text-xl">{step.title}</h3>
                  <p className="body-copy mt-2">{step.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section-tight">
        <div className="dark-panel grid gap-10 p-6 sm:p-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div>
            <p className="eyebrow border-white/10 bg-white/10 text-blue-100">
              Technology
            </p>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white md:text-5xl">
              Modern stack, grouped by purpose.
            </h2>
            <p className="mt-5 text-slate-300">
              The stack is chosen for the product, not for decoration. These
              are technologies already reflected in the existing work.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {techGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-md border border-white/10 bg-white/[0.04] p-5"
              >
                <h3 className="font-extrabold text-white">{group.title}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <SectionHeading
            eyebrow="About"
            title="A focused software company for serious builds."
            subtitle="The Byte Office combines full-stack development, AI engineering, automation, and cloud-ready architecture to help businesses move from idea to dependable software."
          />
          <div className="surface-card p-6 sm:p-8">
            <p className="body-copy">
              The company works across custom business software, SaaS
              platforms, backend systems, APIs, AI and LLM applications, RAG
              systems, data pipelines, automations, and polished web
              experiences. The approach is straightforward: understand the
              business problem, design the technical path, build with care, and
              leave clients with software that is easier to operate and improve.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {["Reliable delivery", "Modern engineering", "Business automation", "AI-enabled workflows"].map(
                (item) => (
                  <div key={item} className="rounded-md bg-slate-50 p-4">
                    <p className="font-bold text-slate-950">{item}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page section-tight">
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((faq) => (
            <article key={faq.question} className="surface-card p-6">
              <h2 className="text-lg font-extrabold text-slate-950">
                {faq.question}
              </h2>
              <p className="body-copy mt-3 text-sm">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page section">
        <div className="dark-panel overflow-hidden p-8 text-center sm:p-12">
          <p className="eyebrow mx-auto border-white/10 bg-white/10 text-blue-100">
            Start the conversation
          </p>
          <h2 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold leading-tight text-white md:text-6xl">
            Have a product, AI workflow, or automation that needs to be built
            properly?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-slate-300">
            Share the goal, constraints, and timeline. You will get a practical
            next step instead of a generic sales pitch.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <PrimaryCTAButton
              href="/contact"
              label="Book a Discovery Call"
              className="bg-white text-slate-950 hover:bg-slate-100"
            />
            <SecondaryCTAButton
              href={`mailto:${company.email}`}
              label="Email The Byte Office"
              className="border-white/25 bg-white/10 text-white hover:bg-white hover:text-slate-950"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
