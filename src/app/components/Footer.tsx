import Link from "next/link";
import { company, navItems, services } from "../data/site";

export default function Footer() {
  return (
    <footer
      data-public-footer
      className="border-t border-slate-900/10 bg-slate-950 text-white"
    >
      <div className="container-page py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-sm font-black text-slate-950"
              >
                BO
              </span>
              <span className="text-lg font-extrabold">{company.name}</span>
            </Link>
            <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
              {company.summary}
            </p>
            <a
              href={`mailto:${company.email}`}
              className="mt-6 inline-flex text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              {company.email}
            </a>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Navigation
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-white">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Services
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {services.slice(0, 4).map((service) => (
                <li key={service.title}>
                  <Link href="/services" className="hover:text-white">
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
              Contact
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              <li>{company.responseTime}</li>
              <li>{company.workingHours}</li>
              <li>
                <Link href="/contact" className="font-semibold text-white">
                  Book a discovery call
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} {company.name}. All rights
            reserved.
          </p>
          <div className="flex gap-4">
            <Link href="/llms.txt" className="hover:text-white">
              llms.txt
            </Link>
            <Link href="/sitemap.xml" className="hover:text-white">
              Sitemap
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
