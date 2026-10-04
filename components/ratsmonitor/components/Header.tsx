import { usePathname } from "next/navigation";
import { MainMenu } from "../menu/MainMenu";
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
    <header className="relative top-0 z-[1100] border-b border-slate-200 bg-white sm:sticky">
      <div className="flex h-[72px] items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-[14px]">
          <MainMenu />
          <Brand onClick={leave} />
        </div>
        <div className="flex items-center gap-3">
          <DevTierSwitcher />
          <AccountMenu currentPage={kontoPage} />
        </div>
      </div>
    </header>
  );
}
