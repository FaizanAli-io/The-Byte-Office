import BackgroundEffect from "../components/BackgroundEffect";
import SectionHeading from "../components/SectionHeading";
import { PrimaryCTAButton, SecondaryCTAButton } from "../components/CTAButtons";
import {
  company,
  processSteps,
  services,
  siteUrl,
  techGroups,
} from "../data/site";
import { createMetadata, jsonLd } from "../lib/seo";

export const metadata = createMetadata({
  title: "Custom Software, AI, Automation, and SaaS Development Services",
  description:
    "Explore The Byte Office services: custom software development, full-stack web applications, SaaS platforms, AI agents, RAG systems, backend APIs, cloud systems, and automation solutions.",
  path: "/services",
});

export default function ServicesPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.title,
        description: service.summary,
        provider: {
          "@type": "Organization",
          name: company.name,
          url: siteUrl,
        },
      },
    })),
  };

  return (
    <div className="page-shell">
      {jsonLd(serviceSchema)}
      <BackgroundEffect />
      <section className="container-page pt-32">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
          <div>
            <p className="eyebrow">Services</p>
            <h1 className="display mt-6 text-balance">
              Software services for launch, scale, and smarter operations.
            </h1>
          </div>
          <p className="lead">
            {company.name} helps teams build full-stack products, automate
            workflows, connect business systems, and turn AI into practical
            software. Every service is focused on business outcomes, not a wall
            of buzzwords.
          </p>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid gap-6">
          {services.map((service, index) => (
            <article
              key={service.title}
              className="surface-card grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.75fr_1.25fr]"
            >
              <div>
                <span className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-950 text-sm font-black text-white">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="heading-lg mt-6">{service.title}</h2>
                <p className="body-copy mt-4">{service.summary}</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="muted-panel p-5">
                  <h3 className="text-base font-extrabold text-slate-100">
                    Business value
                  </h3>
                  <p className="body-copy mt-3 text-sm">{service.outcome}</p>
                </div>
                <div className="muted-panel p-5">
                  <h3 className="text-base font-extrabold text-slate-100">
                    Capabilities
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {service.capabilities.map((capability) => (
                      <span key={capability} className="chip">
                        {capability}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section bg-slate-950 text-white">
        <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow border-white/10 bg-white/10 text-blue-100">
              Delivery model
            </p>
            <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white md:text-5xl">
              Structured enough to be predictable. Flexible enough for real
              projects.
            </h2>
            <p className="mt-5 text-slate-300">
              The work moves from clarity to architecture to implementation,
              with testing and launch readiness built into the process.
            </p>
          </div>
          <div className="grid gap-4">
            {processSteps.map((step, index) => (
              <div
                key={step.title}
                className="rounded-md border border-white/10 bg-white/[0.04] p-5"
              >
                <p className="text-sm font-bold text-blue-200">
                  Step {index + 1}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page section">
        <SectionHeading
          eyebrow="Technology stack"
          title="Tools selected for dependable software delivery."
          subtitle="The stack stays focused on modern frameworks, reliable backend systems, AI infrastructure, databases, and integrations already reflected in the project work."
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {techGroups.map((group) => (
            <article key={group.title} className="surface-card p-6">
              <h2 className="heading-md">{group.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container-page section-tight">
        <div className="surface-card grid gap-6 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="heading-lg">
              Need a product, AI workflow, or automation scoped?
            </h2>
            <p className="body-copy mt-3">
              Share the business goal and current constraints. The next step is
              a practical technical conversation.
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
