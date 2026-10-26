/** Linien-Symbole der Adminseiten (24er Raster, Strichstärke 1,75, Farbe vom Text). Nur Bilder: die Beschriftung steht daneben. */
const PATHS:Record<string,string>={
 report:'M7 3h7l5 5v13H7z M14 3v5h5 M10 12h6 M10 16h6',
 download:'M12 4v11 M7 10l5 5 5-5 M5 20h14',
 scale:'M12 4v16 M5 20h14 M4 8h16 M7 8l-3 6a3 3 0 0 0 6 0z M17 8l-3 6a3 3 0 0 0 6 0z',
 text:'M5 6h14 M5 10h14 M5 14h10 M5 18h8',
 scan:'M4 8V5a1 1 0 0 1 1-1h3 M16 4h3a1 1 0 0 1 1 1v3 M20 16v3a1 1 0 0 1-1 1h-3 M8 20H5a1 1 0 0 1-1-1v-3 M8 10h8 M8 14h5',
 summary:'M6 4h12v16H6z M9 8h6 M9 12h6 M9 16h3',
 facts:'M5 20V10 M10 20V4 M15 20v-7 M20 20v-4',
 gauge:'M4 16a8 8 0 1 1 16 0 M12 16l4-5 M4 20h16',
 moon:'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
 shield:'M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z M9 12l2 2 4-4',
 search:'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
 file:'M7 3h7l5 5v13H7z M14 3v5h5 M12 11v6 M9.5 14.5L12 17l2.5-2.5',
 inbox:'M4 13l2.5-8h11L20 13v6H4z M4 13h5l1 2h4l1-2h5',
 database:'M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3z M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
 archive:'M4 4h16v4H4z M5 8v12h14V8 M10 12h4',
 box:'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
 cpu:'M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
 drive:'M4 14l2-9h12l2 9 M4 14h16v5H4z M16 16.5h.01',
 clock:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
 stop:'M7 7h10v10H7z',
 play:'M8 5l11 7-11 7z',
 alert:'M12 4l9 16H3z M12 10v4 M12 17h.01',
 check:'M5 12l5 5 9-10',
 server:'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01',
 map:'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z M9 4v14 M15 6v14',
 chart:'M4 20h16 M5 16l4-5 4 3 6-8',
 checklist:'M11 6h9 M11 12h9 M11 18h9 M4 6l1.5 1.5L8 5 M4 12l1.5 1.5L8 11 M4 18l1.5 1.5L8 17',
 tags:'M3 12V4h8l9 9-8 8z M7.5 7.5h.01',
 sliders:'M4 6h9 M17 6h3 M4 12h3 M11 12h9 M4 18h11 M19 18h1 M15 4v4 M9 10v4 M17 16v4',
 users:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M2 21v-1a7 7 0 0 1 14 0v1 M16 3.5a4 4 0 0 1 0 7.5 M22 21v-1a7 7 0 0 0-4-6.3',
 megaphone:'M4 10v4h3l8 4V6l-8 4z M18 9a3 3 0 0 1 0 6 M7 14l1 5h2',
 calculator:'M6 3h12v18H6z M9 7h6 M9 11h.01 M12 11h.01 M15 11h.01 M9 15h.01 M12 15h.01 M15 15h.01 M9 18h.01 M12 18h.01 M15 18h.01',
};
export type IconName=keyof typeof PATHS;
export function Icon({name,size=20,className=''}:{name:string;size?:number;className?:string}){
 return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={'shrink-0 '+className}>
  {(PATHS[name]||PATHS.report).split(' M').map((d,i)=><path key={i} d={(i?'M':'')+d}/>)}
 </svg>;
}
