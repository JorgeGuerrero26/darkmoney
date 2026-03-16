type BrandLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({
  alt = "DarkMoney",
  className = "",
  imageClassName = "",
}: BrandLogoProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(160deg,rgba(13,19,27,0.96),rgba(9,12,18,0.88))] shadow-[0_24px_54px_rgba(4,8,14,0.48),0_0_0_1px_rgba(255,255,255,0.03)] ${className}`}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(108,241,196,0.12),transparent_34%),radial-gradient(circle_at_82%_24%,rgba(245,176,76,0.08),transparent_28%)]" />
      <img
        alt={alt}
        className={`relative h-full w-full object-cover object-center ${imageClassName}`}
        loading="eager"
        src="/logo-darkmoney.png"
      />
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
