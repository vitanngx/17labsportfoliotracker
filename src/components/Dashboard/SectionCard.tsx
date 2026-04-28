import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function SectionCard({
  title,
  actions,
  children,
  className = ""
}: SectionCardProps) {
  return (
    <section className={`surface-panel flex h-full flex-col rounded-[28px] p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-title text-mist">{title}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
