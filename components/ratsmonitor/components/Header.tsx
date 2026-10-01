import { usePathname } from "next/navigation";
import { THEMEN } from "../lib/constants";
import { monthLabel } from "../lib/text";
import { useData } from "../state/data";
import { useAppNav } from "../state/nav";
import { useSearch, useSearchResults } from "../state/search";
import { AccountMenu } from "./AccountMenu";
import { FilterSelect } from "./FilterSelect";
import { GeoFilter } from "./GeoFilter";
import { SearchBox } from "./SearchBox";
import { Brand } from "./Brand";

export function Header() {

  const search = useSearch();
  const { themaCounts, monatCounts } = useSearchResults();
  const { view, goOverview } = useAppNav();
  const location = {pathname:usePathname()};
  const kontoPage = location.pathname.startsWith("/konto/") ? location.pathname.split("/")[2] : "";
  const months = Object.keys(monatCounts).sort().reverse();

  const leave = () => {
    if (view !== "overview") goOverview();
  };

  return (
    <header className="relative top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur-[8px] backdrop-saturate-[1.8] sm:sticky">
      <div className="mx-auto grid max-w-page grid-cols-[1fr_auto] items-center gap-x-4 gap-y-3 px-4 py-2.5 [grid-template-areas:'brand_account'_'toolbar_toolbar'] sm:px-5 sm:py-3 desk:min-h-[72px] desk:grid-cols-[auto_minmax(0,1fr)_auto] desk:gap-7 desk:px-6 desk:py-0 desk:[grid-template-areas:'brand_toolbar_account']">
        <Brand onClick={leave} />
        <div role="search" className="flex min-w-0 flex-wrap items-center gap-2 [grid-area:toolbar] desk:flex-nowrap">
          <SearchBox />
          <GeoFilter />
          <FilterSelect
            id="f-thema"
            label="Thema"
            allLabel="Alle Themen"
            value={search.state.thema}
            options={THEMEN.map((t) => ({ value: t, label: t }))}
            counts={themaCounts}
            onChange={(v) => {
              search.setThema(v);
              leave();
            }}
            className="flex-[1_1_calc(50%-4px)] sm:flex-[1_1_180px] desk:flex-none"
          />
          <FilterSelect
            id="f-monat"
            label="Zeitraum"
            allLabel="Alle Zeiträume"
            value={search.state.monat}
            options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
            counts={monatCounts}
            onChange={(v) => {
              search.setMonat(v);
              leave();
            }}
            className="flex-[1_1_calc(50%-4px)] sm:flex-[1_1_180px] desk:flex-none"
          />
        </div>
        <AccountMenu currentPage={kontoPage} />
      </div>
    </header>
  );
}
