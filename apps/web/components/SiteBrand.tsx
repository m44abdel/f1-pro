import Image from "next/image";
import Link from "next/link";

interface SiteBrandProps {
  href?: string;
  subtitle?: string;
  className?: string;
}

export function SiteBrand({
  href = "/",
  subtitle = "Telemetry Hub",
  className = "",
}: SiteBrandProps) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg border border-f1-gray/30 bg-f1-dark/60 hover:border-f1-red/70 hover:bg-f1-dark/80 transition ${className}`}
    >
      <span className="relative flex h-10 w-16 items-center justify-center rounded-md bg-f1-dark/60 border border-f1-gray/30 group-hover:border-f1-red/70 transition overflow-hidden">
        <Image
          src="/images/image.svg"
          alt="F1 Pro logo"
          fill
          sizes="64px"
          className="object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
          priority
        />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm text-f1-light uppercase tracking-[0.18em] group-hover:text-f1-white transition">
          {subtitle}
        </span>
        <span className='text-2xl font-black tracking-[0.08em] text-f1-white group-hover:text-f1-red transition font-["Titillium Web",sans-serif]'>
          F1<span className="text-f1-red group-hover:text-f1-white transition-colors">Pro</span>
        </span>
      </div>
    </Link>
  );
}
