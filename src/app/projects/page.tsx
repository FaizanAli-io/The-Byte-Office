import BackgroundEffect from "../components/BackgroundEffect";
import { PrimaryCTAButton, SecondaryCTAButton } from "../components/CTAButtons";
import { company, projects, siteUrl } from "../data/site";
import { createMetadata, jsonLd } from "../lib/seo";

export const metadata = createMetadata({
  title: "Projects and Case Studies",
  description:
    "Explore The Byte Office projects across AI agents, RAG systems, automation, full-stack dashboards, healthcare web apps, chat automation, and computer vision.",
  path: "/projects",
});

export default function ProjectsPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Projects and Case Studies",
    url: `${siteUrl}/projects`,
    description:
      "A curated portfolio of software development, AI, automation, and web application projects by The Byte Office.",
    mainEntity: projects.map((project) => ({
      "@type": "CreativeWork",
      name: project.title,
      genre: project.category,
      description: project.solution,
      creator: {
        "@type": "Organization",
        name: company.name,
      },
    })),
  };

  return (
    <div className="page-shell">
      {jsonLd(schema)}
      <BackgroundEffect />

      <section className="container-page pt-32">
        <div className="max-w-4xl">
          <p className="eyebrow">Work</p>
          <h1 className="display mt-6 text-balance">
            Applied software work across AI, automation, and full-stack
            platforms.
          </h1>
          <p className="lead mt-7">
            Each project below keeps the factual source material intact while
            presenting the work as a clearer case study: problem, solution,
            impact, and technologies.
          </p>
        </div>
      </section>

      <section className="container-page section">
        <div className="grid gap-6">
          {projects.map((project, index) => {
            return (
              <article
                key={project.title}
                className="surface-card overflow-hidden transition hover:-translate-y-1 hover:shadow-md"
              >
                <div className="grid gap-0 lg:grid-cols-[0.42fr_0.58fr]">
                  <div className="flex min-h-72 flex-col justify-between bg-slate-950 p-6 text-white sm:p-8">
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase text-slate-300">
                          {project.category}
                        </span>
                        <span className="text-sm font-bold text-slate-400">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>
                      <h2 className="mt-7 text-3xl font-extrabold leading-tight md:text-4xl">
                        {project.title}
                      </h2>
                      <p className="mt-4 text-sm font-semibold text-blue-100">
                        {project.industry}
                      </p>
                    </div>
                    <div className="mt-8">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                        Core stack
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {project.tech.slice(0, 4).map((tech) => (
                          <span
                            key={tech}
                            className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-slate-200"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 sm:p-8">
                    <dl className="grid gap-6 md:grid-cols-3">
                      <div>
                        <dt className="text-sm font-extrabold text-slate-100">
                          Problem
                        </dt>
                        <dd className="mt-2 text-sm leading-6 text-slate-400">
                          {project.problem}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-extrabold text-slate-100">
                          Solution
                        </dt>
                        <dd className="mt-2 text-sm leading-6 text-slate-400">
                          {project.solution}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-extrabold text-slate-100">
                          Impact
                        </dt>
                        <dd className="mt-2 text-sm leading-6 text-slate-400">
                          {project.impact}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="container-page section-tight">
        <div className="dark-panel grid gap-6 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight text-white md:text-4xl">
              Have a project that needs this level of ownership?
            </h2>
            <p className="mt-4 max-w-2xl text-slate-300">
              Bring the idea, workflow, product brief, or legacy system. The
              goal is to turn it into a clear technical path.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <PrimaryCTAButton
              href="/contact"
              label="Start a Project"
              className="bg-slate-900 text-slate-100 hover:bg-slate-800"
            />
            <SecondaryCTAButton
              href="/services"
              label="Explore Services"
              className="border-white/25 bg-white/10 text-white hover:bg-white/10 hover:text-slate-100"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
