type BrandLogoProps = {
  alt?: string;
  className?: string;
  imageClassName?: string;
  loading?: "eager" | "lazy";
};

export function BrandLogo({
  alt = "DarkMoney",
  className = "",
  imageClassName = "",
  loading = "lazy",
}: BrandLogoProps) {
  return (
    <img alt={alt} className={`object-cover ${className} ${imageClassName}`} decoding="async" loading={loading} src="/darkmoney-wallet-icon.png" />
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
    <div aria-label={alt} className={`flex items-center justify-center gap-5 overflow-hidden rounded-[28px] border border-white/10 bg-[#1b1b1d] px-6 shadow-[0_24px_60px_rgba(0,0,0,0.3)] ${className}`} role="img">
      <img alt="" aria-hidden="true" className={`h-20 w-20 shrink-0 rounded-2xl object-cover sm:h-24 sm:w-24 ${imageClassName}`} decoding="async" src="/darkmoney-wallet-icon.png" />
      <span aria-hidden="true" className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">DarkMoney</span>
    </div>
  );
}
