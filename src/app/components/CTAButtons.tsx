import Link from "next/link";

type Props = {
  href: string;
  label: string;
  className?: string;
};

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path
        d="M4.25 10h10.5m0 0-4.25-4.25M14.75 10l-4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PrimaryCTAButton({ href, label, className = "" }: Props) {
  return (
    <Link href={href} className={`button-base button-primary ${className}`}>
      <span>{label}</span>
      <ArrowIcon />
    </Link>
  );
}

export function SecondaryCTAButton({ href, label, className = "" }: Props) {
  return (
    <Link href={href} className={`button-base button-secondary ${className}`}>
      <span>{label}</span>
      <ArrowIcon />
    </Link>
  );
}

export function QuietCTAButton({ href, label, className = "" }: Props) {
  return (
    <Link href={href} className={`button-base button-quiet ${className}`}>
      <span>{label}</span>
      <ArrowIcon />
    </Link>
  );
}
