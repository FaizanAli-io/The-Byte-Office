import BackgroundEffect from "../components/BackgroundEffect";
import ContactForm from "./ContactForm";
import { company, processSteps, siteUrl } from "../data/site";
import { createMetadata, jsonLd } from "../lib/seo";

export const metadata = createMetadata({
  title: "Contact",
  description:
    "Contact The Byte Office to discuss custom software development, AI agents, RAG systems, automation solutions, SaaS platforms, APIs, backend systems, and full-stack web applications.",
  path: "/contact",
});

export default function ContactPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact The Byte Office",
    url: `${siteUrl}/contact`,
    description:
      "Contact The Byte Office for software development, AI development, automation, and full-stack web application projects.",
    mainEntity: {
      "@type": "Organization",
      name: company.name,
      email: company.email,
      contactPoint: {
        "@type": "ContactPoint",
        email: company.email,
        contactType: "sales",
      },
    },
  };

  return (
    <div className="page-shell">
      {jsonLd(schema)}
      <BackgroundEffect />

      <section className="container-page pt-32">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div>
            <p className="eyebrow">Contact</p>
            <h1 className="display mt-6 text-balance">
              Tell us what you need to build next.
            </h1>
          </div>
          <p className="lead">
            Bring the product idea, automation problem, AI workflow, backend
            requirement, or existing system that needs improvement. The first
            conversation is about clarity and the most practical next step.
          </p>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card p-6 sm:p-8">
            <h2 className="heading-lg">Start a project inquiry</h2>
            <p className="body-copy mt-3">
              This form preserves the current local confirmation behavior. Use
              the email draft option to send the inquiry directly to The Byte
              Office.
            </p>
            <div className="mt-8">
              <ContactForm />
            </div>
          </div>

          <aside className="space-y-5">
            <div className="dark-panel p-6">
              <h2 className="text-2xl font-extrabold text-white">
                Contact details
              </h2>
              <dl className="mt-6 space-y-5">
                <div>
                  <dt className="text-sm font-bold uppercase text-slate-400">
                    Email
                  </dt>
                  <dd className="mt-1">
                    <a
                      href={`mailto:${company.email}`}
                      className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
                    >
                      {company.email}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold uppercase text-slate-400">
                    Response time
                  </dt>
                  <dd className="mt-1 text-slate-200">
                    {company.responseTime}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-bold uppercase text-slate-400">
                    Working hours
                  </dt>
                  <dd className="mt-1 text-slate-200">
                    {company.workingHours}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="surface-card p-6">
              <h2 className="heading-md">What happens next?</h2>
              <div className="mt-5 space-y-4">
                {processSteps.slice(0, 3).map((step, index) => (
                  <div key={step.title} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-950">
                        {step.title}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {step.text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
