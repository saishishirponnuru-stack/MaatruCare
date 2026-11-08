import Image from "next/image";

/** Keep the original transparent emblem; render the wordmark as crisp text. */
export default function BrandLogo({compact=false, onDark=false, subtitle="Care together"}: {
  compact?: boolean; onDark?: boolean; subtitle?: string;
}) {
  return <span className={`mc-logo ${compact ? "mc-logo--compact" : ""} ${onDark ? "mc-logo--on-dark" : ""}`}>
    <Image src="/maatru-care-mark.webp" alt="" aria-hidden="true" width={44} height={44} sizes="44px" priority className="mc-logo-symbol" />
    <span className="mc-logo-copy"><span className="mc-logo-wordmark">Maatru<span>Care</span></span>{subtitle && <span className="mc-logo-subtitle">{subtitle}</span>}</span>
  </span>;
}
