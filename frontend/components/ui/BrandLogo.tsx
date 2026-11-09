import Image from "next/image";

type BrandLogoProps = {
  compact?: boolean;
  onDark?: boolean;
  subtitle?: string;
};

export default function BrandLogo({
  compact = false,
  onDark = false,
  subtitle = "Care together",
}: BrandLogoProps) {
  if (!compact) {
    return (
      <span
        className={`mc-logo mc-logo--full ${onDark ? "mc-logo--on-dark" : ""}`}
        role="img"
        aria-label="MaatruCare — Care together"
      >
        {/* Original logo for light mode */}
        <Image
          src="/maatru-care-logo.webp"
          alt=""
          aria-hidden="true"
          width={320}
          height={102}
          sizes="250px"
          priority
          className="mc-logo-full-image mc-logo-light"
        />

        {/* Transparent logo for dark mode */}
        <Image
          src="/maatru-care-logo-dark.png"
          alt=""
          aria-hidden="true"
          width={320}
          height={102}
          sizes="250px"
          className="mc-logo-full-image mc-logo-dark"
        />
      </span>
    );
  }

  return (
    <span
      className={`mc-logo mc-logo--compact ${
        onDark ? "mc-logo--on-dark" : ""
      }`}
    >
      <Image
        src="/maatru-care-mark.webp"
        alt=""
        aria-hidden="true"
        width={36}
        height={36}
        sizes="36px"
        priority
        className="mc-logo-symbol"
      />

      <span className="mc-logo-copy">
        <span className="mc-logo-wordmark">
          Maatru<span>Care</span>
        </span>

        {subtitle && (
          <span className="mc-logo-subtitle">{subtitle}</span>
        )}
      </span>
    </span>
  );
}