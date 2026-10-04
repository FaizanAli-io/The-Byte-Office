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
