import Link from 'next/link';

export function CTAButton({
  href,
  label,
  variant = 'primary',
}: {
  href: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'quiet';
}) {
  return (
    <Link href={href} className={`button-base button-${variant}`}>
      <span>{label}</span>
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 20 20" fill="none">
        <path
          d="M4.25 10h10.5m0 0-4.25-4.25M14.75 10l-4.25 4.25"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}

// The closing "start a project" panel at the foot of the site pages.
export function CTAPanel({
  title,
  text,
  secondary,
  dark = false,
}: {
  title: string;
  text: string;
  secondary: { href: string; label: string };
  dark?: boolean;
}) {
  return (
    <section className="container-page section-tight">
      <div
        className={`${dark ? 'dark-panel' : 'surface-card'} grid gap-6 p-8 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center`}
      >
        <div>
          <h2 className={dark ? 'text-3xl font-extrabold leading-tight text-white md:text-4xl' : 'heading-lg'}>
            {title}
          </h2>
          <p className={dark ? 'mt-4 max-w-2xl text-slate-300' : 'body-copy mt-3'}>{text}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CTAButton href="/contact" label="Start a Project" />
          <CTAButton {...secondary} variant="secondary" />
        </div>
      </div>
    </section>
  );
}
