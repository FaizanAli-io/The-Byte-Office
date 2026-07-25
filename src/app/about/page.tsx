import BackgroundEffect from "../components/BackgroundEffect";
import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton, SecondaryCTAButton } from "../components/CTAButtons";
import { company, processSteps, services, whyChooseUs } from "../data/site";
import { createMetadata, jsonLd } from "../lib/seo";

export const metadata = createMetadata({
  title: "About",
  description:
    "Learn about The Byte Office, a software development and AI solutions company focused on reliable full-stack products, automation, AI agents, RAG systems, APIs, and cloud-ready business software.",
  path: "/about",
});

export default function AboutPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About The Byte Office",
    description: company.summary,
  };

  return (
    <div className="page-shell">
      {jsonLd(schema)}
      <BackgroundEffect />

      <section className="container-page pt-32">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <p className="eyebrow">About The Byte Office</p>
            <h1 className="display mt-6 text-balance">
              Product-minded engineering for modern business software.
            </h1>
          </div>
          <p className="lead">
            {company.name} is a software development and AI solutions company
            focused on custom web applications, SaaS platforms, backend systems,
            AI agents, RAG systems, automation, and cloud-ready business tools.
          </p>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="dark-panel p-8">
            <p className="eyebrow border-white/10 bg-white/10 text-blue-100">
              Mission
            </p>
            <h2 className="mt-5 text-4xl font-extrabold leading-tight text-white">
              Make advanced software practical, reliable, and useful.
            </h2>
            <p className="mt-5 text-slate-300">
              The mission is to help businesses use modern engineering and AI
              without turning projects into experiments. The work should create
              usable systems, cleaner operations, and products that can keep
              improving after launch.
            </p>
          </div>

          <div className="surface-card p-8">
            <h2 className="heading-lg">How the company works</h2>
            <p className="body-copy mt-5">
              The Byte Office starts by understanding the business problem
              behind the requested feature. From there, the work becomes a
              practical technical plan: interface, data, backend, AI or
              automation logic, integrations, testing, and deployment.
            </p>
            <p className="body-copy mt-4">
              The result is software that is easier for clients to trust:
              clearer user journeys, maintainable architecture, and less manual
              work hidden inside daily operations.
            </p>
          </div>
        </div>
      </section>

      <section className="container-page section-tight">
        <SectionHeading
          eyebrow="Strengths"
          title="Built around the parts that make software succeed."
          subtitle="The value is not only implementation speed. It is knowing which technical choices support the business goal and which ones create future drag."
          align="center"
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {whyChooseUs.map((item) => (
            <article key={item.title} className="surface-card p-6">
              <h2 className="heading-md text-xl">{item.title}</h2>
              <p className="body-copy mt-3 text-sm">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section bg-slate-950 text-white">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow border-white/10 bg-white/10 text-blue-100">
              Capability map
            </p>
            <h2 className="mt-5 text-4xl font-extrabold leading-tight text-white md:text-6xl">
              From product frontends to AI workflows and backend systems.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.title}
                className="rounded-md border border-white/10 bg-white/[0.04] p-5"
              >
                <h3 className="text-xl font-extrabold text-white">
                  {service.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  {service.summary}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section">
        <SectionHeading
          eyebrow="Process"
          title="A simple client journey with technical clarity at every step."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <article key={step.title} className="surface-card p-6">
              <span className="text-sm font-black text-blue-800">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h2 className="heading-md mt-4">{step.title}</h2>
              <p className="body-copy mt-3 text-sm">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page section-tight">
        <div className="surface-card grid gap-6 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="heading-lg">Want to talk through a build?</h2>
            <p className="body-copy mt-3">
              Share what you are trying to automate, launch, rebuild, or
              connect. The first step is a clear conversation.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryCTAButton href="/contact" label="Start a Project" />
            <SecondaryCTAButton href="/projects" label="View Work" />
          </div>
        </div>
      </section>
    </div>
  );
}
