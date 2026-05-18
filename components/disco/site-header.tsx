import { FaGithub } from "react-icons/fa";

interface SiteHeaderProps {
  githubUrl?: string;
}

export function SiteHeader({ githubUrl = "https://github.com/ktgcreative/discologos" }: SiteHeaderProps) {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-4 pt-3 sm:px-6 sm:pt-4">
      <span className="pointer-events-auto text-sm font-semibold tracking-tight text-white/90">
        DiscoLogos
      </span>
      <a
        href={githubUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-xl transition hover:bg-black/75"
      >
        <FaGithub size={14} />
        <span className="hidden sm:inline">GitHub</span>
      </a>
    </header>
  );
}
