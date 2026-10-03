import { usePathname } from "next/navigation";
import { useAppNav } from "../state/nav";
import { AccountMenu } from "./AccountMenu";
import { Brand } from "./Brand";
import { DevTierSwitcher } from "./DevTierSwitcher";

export function Header() {
  const { view, goOverview } = useAppNav();
  const pathname = usePathname();
  const kontoPage = pathname.startsWith("/konto/") ? pathname.split("/")[2] : "";

  const leave = () => {
    if (view !== "overview") goOverview();
  };

  return (
    <header className="relative top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur-[8px] backdrop-saturate-[1.8] sm:sticky">
      <div className="mx-auto flex min-h-[60px] max-w-page items-center justify-between gap-4 py-2">
        <Brand onClick={leave} />
        <div className="flex items-center gap-3">
          <DevTierSwitcher />
          <AccountMenu currentPage={kontoPage} />
        </div>
      </div>
    </header>
  );
}
