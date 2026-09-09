type BrandLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
};

export function BrandLogo({
  alt = "DarkMoney",
  className = "",
}: BrandLogoProps) {
  return (
    <div
      aria-label={alt}
      className={`flex items-center justify-center overflow-hidden bg-[#0c0b0a] ${className}`}
      role="img"
    >
      <svg
        aria-hidden="true"
        className="h-full w-full"
        viewBox="0 0 1024 1024"
      >
        <rect
          fill="#86ce96"
          height="140"
          rx="18"
          width="336"
          x="344"
          y="276"
        />
        <path
          d="M228 396h568a28 28 0 0 1 28 28v324a28 28 0 0 1-28 28H228a28 28 0 0 1-28-28V424a28 28 0 0 1 28-28Z"
          fill="#f4f1ec"
        />
        <rect
          fill="#0c0b0a"
          height="124"
          rx="20"
          width="196"
          x="628"
          y="524"
        />
        <rect
          fill="#f4f1ec"
          height="68"
          rx="14"
          width="156"
          x="668"
          y="552"
        />
      </svg>
    </div>
  );
}

type BrandBannerProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
};

export function BrandBanner({
  alt = "DarkMoney banner",
  className = "",
  imageClassName = "",
}: BrandBannerProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(160deg,rgba(10,15,23,0.98),rgba(7,10,16,0.96))] shadow-[0_24px_60px_rgba(3,7,12,0.5),0_0_0_1px_rgba(255,255,255,0.03)] ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,5,9,0.05),rgba(2,5,9,0.34))]" />
      <img
        alt={alt}
        className={`relative h-full w-full object-cover object-center ${imageClassName}`}
        loading="eager"
        src="/banner-darkmoney.png"
      />
    </div>
  );
}
