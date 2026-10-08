import type { Example } from "./content";
/* Beispiele mit Verlauf je Anwendergruppe (Stand 08.10.26). Reihenfolge = Reihenfolge der Chips „Auch im Blick“. href = Artikel in der Startseiten-Suche. */
export const BEISPIELE: Record<string, Example[]> = {
  immobilien: [
    {
      href: "/beschluss/de-12054000-vo-2008221",
      place: "Stadt Potsdam",
      committee: "Stadtverordnetenversammlung der Landeshauptstadt Potsdam",
      status: "wait",
      statusId: "postponed",
      statusText: "Vertagt",
      datum: [
        "1",
        "JUL",
        "26"
      ],
      title: "Anwendung der Leitlinie für Grundstücksverkäufe auf die ProPotsdam (Fraktion Die Linke)",
      steps: [
        {
          d: "2026-06-24",
          c: "Hauptausschuss",
          s: "postponed"
        },
        {
          d: "2026-07-01",
          c: "Stadtverordnetenversammlung der Landeshauptstadt Potsdam",
          s: "postponed"
        }
      ]
    },
    {
      href: "/beschluss/nds-03359010-vo-1002269",
      place: "Stadt Buxtehude",
      committee: "Rat",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "5",
        "OKT",
        "26"
      ],
      title: "Nachhaltiges Gewerbeflächenentwicklungskonzept - weiteres Vorgehen",
      steps: [
        {
          d: "2026-09-02",
          c: "Ausschuss für Wirtschaft, Tourismus und Gewerbeflächenmanagement",
          s: "recommended"
        },
        {
          d: "2026-10-05",
          c: "Rat",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/nds-03154028-vo-9262",
      place: "Stadt Helmstedt",
      committee: "Rat",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Parkraumkonzept: überlange Pkw und Bewohnerparkplätze",
      steps: [
        {
          d: "2026-09-08",
          c: "Ausschuss für öffentliche Sicherheit und Ordnung (ASO)",
          s: "unknown"
        },
        {
          d: "2026-10-08",
          c: "Rat",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05117000-vo-1002382",
      place: "Stadt Mülheim an der Ruhr",
      committee: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "29",
        "SEP",
        "26"
      ],
      title: "Rückblick auf zehn Jahre Innenstadtentwicklung | Vorstellung der Internetseite",
      steps: [
        {
          d: "2026-09-15",
          c: "Bezirksvertretung 1",
          s: "unknown"
        },
        {
          d: "2026-09-29",
          c: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/de-06436007-vo-1000977",
      place: "Stadt Hofheim am Taunus",
      committee: "Stadtverordnetenversammlung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "30",
        "SEP",
        "26"
      ],
      title: "Bauleitplanung der Stadt Hofheim am Taunus Bebauungsplan Nr. 132 „Jungehag“, Ergänzendes Verfahren Teile der Flur 1, Gemarkung Wildsachsen Änderung der Vereinbarung über Ausgleichsmaßnahmen gem. § 11 BauGB",
      steps: [
        {
          d: "2026-09-22",
          c: "Ausschuss für Planen, Bauen und Verkehr",
          s: "recommended"
        },
        {
          d: "2026-09-30",
          c: "Stadtverordnetenversammlung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nds-03241017-vo-20210303100574",
      place: "Stadt Springe",
      committee: "Rat",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Antrag der Fraktion Zukunft für Springe Antrag zum Auftrag einer Straßenzustandserfassung mit der Aufstellung eines Straßensanierungsprogramms",
      steps: [
        {
          d: "2026-04-23",
          c: "Rat",
          s: "unknown"
        },
        {
          d: "2026-06-25",
          c: "Rat",
          s: "unknown"
        },
        {
          d: "2026-09-01",
          c: "BauA 66 - Ausschuss für Bauen, Technik und Betriebshof",
          s: "unknown"
        }
      ]
    }
  ],
  versorgung: [
    {
      href: "/beschluss/de-01056043-vo-6530",
      place: "Gemeinde Rellingen",
      committee: "Gemeindevertretung",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Kommunale Wärmeplanung - Beschluss des Wärmeplans",
      steps: [
        {
          d: "2026-09-08",
          c: "Ausschuss für Verkehr",
          s: "unknown"
        },
        {
          d: "2026-10-08",
          c: "Gemeindevertretung",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05570004-oparl-4cd6566e9641dc1df4c3",
      place: "Stadt Ahlen",
      committee: "Rat der Stadt Ahlen",
      status: "wait",
      statusId: "approved",
      statusText: "Beschlossen",
      datum: [
        "5",
        "OKT",
        "26"
      ],
      title: "Neuabschluss der Konzessionsverträge für Elektrizität und Gas sowie Verlängerung der Konzessionsverträge für Wasser und Wärme zwischen der Stadt Ahlen und der Stadtwerke Ahlen GmbH zum 01.01.2027",
      steps: [
        {
          d: "2026-10-01",
          c: "Finanz- und Personalausschuss",
          s: "recommended"
        },
        {
          d: "2026-10-05",
          c: "Rat der Stadt Ahlen",
          s: "approved"
        },
        {
          d: "2026-10-05",
          c: "Hauptausschuss",
          s: "unknown"
        }
      ]
    },
    {
      place: "Stadt Heidelberg",
      committee: "Haupt- und Finanzausschuss",
      status: "wait",
      statusId: "info",
      statusText: "Zur Kenntnis",
      datum: [
        "30",
        "SEP",
        "26"
      ],
      title: "Eigenbetrieb Städtische Beteiligungen Heidelberger Dienste gGmbH - Tätigkeitsbericht 2025",
      steps: [
        {
          d: "2026-09-17",
          c: "Ausschuss für Soziales und Chancengleichheit",
          s: "info"
        },
        {
          d: "2026-09-30",
          c: "Haupt- und Finanzausschuss",
          s: "info"
        }
      ]
    },
    {
      href: "/beschluss/de-06433009-vo-202670110100016",
      place: "Gemeinde Nauheim",
      committee: "Gemeindevertretung",
      status: "wait",
      statusId: "info",
      statusText: "Zur Kenntnis",
      datum: [
        "1",
        "OKT",
        "26"
      ],
      title: "Anfrage der SPD-Fraktion betreffend Einrichtung von E-Ladeparkflächen und zum Ausbau der Ladeinfrastruktur im Bereich des Atriums bzw. der Sparkasse",
      steps: [
        {
          d: "2026-08-27",
          c: "Gemeindevertretung",
          s: "unknown"
        },
        {
          d: "2026-10-01",
          c: "Gemeindevertretung",
          s: "info"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05554004-vo-7471",
      place: "Stadt Ahaus",
      committee: "Rat",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "29",
        "SEP",
        "26"
      ],
      title: "Fortschreibung des Abfallwirtschaftskonzeptes des Kreises Borken für den Zeitraum 2027-2031",
      steps: [
        {
          d: "2026-09-23",
          c: "Ausschuss für Verkehr, Umwelt und Klimaschutz",
          s: "unknown"
        },
        {
          d: "2026-09-29",
          c: "Rat",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nds-033555406-vo-1001956",
      place: "Samtgemeinde Ostheide",
      committee: "Rat der Samtgemeinde Ostheide",
      status: "wait",
      statusId: "approved",
      statusText: "Beschlossen",
      datum: [
        "22",
        "SEP",
        "26"
      ],
      title: "Änderung der Benutzungs- und Gebührensatzungen der Samtgemeinde Ostheide für die \"Nachschulischen Betreuungen\" an den Grundschulen Barendorf, Neetze und Wendisch Evern",
      steps: [
        {
          d: "2026-08-11",
          c: "Ausschuss für Bildung und Jugend der Samtgemeinde Ostheide",
          s: "recommended"
        },
        {
          d: "2026-09-22",
          c: "Rat der Samtgemeinde Ostheide",
          s: "approved"
        }
      ]
    }
  ],
  planung: [
    {
      href: "/beschluss/nrw-05370028-vo-19195",
      place: "Stadt Übach-Palenberg",
      committee: "Rat der Stadt Übach-Palenberg",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Beschluss des Klimaanpassungskonzepts",
      steps: [
        {
          d: "2026-09-29",
          c: "Ausschuss für Klima, Umwelt und Zukunft",
          s: "unknown"
        },
        {
          d: "2026-10-06",
          c: "Haupt- und Finanzausschuss",
          s: "consulting"
        },
        {
          d: "2026-10-08",
          c: "Rat der Stadt Übach-Palenberg",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05162024-oparl-432a79d6826c62d0cb26",
      place: "Stadt Neuss",
      committee: "Ausschuss für Anregungen, Beschwerden und Bürgerbeteiligung",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "6",
        "OKT",
        "26"
      ],
      title: "Anregung betr.: Verbesserung des Anwohner-, Kinder-, Verkehrs- und Immissionsschutzes im Bereich Normannenstraße in Neuss-Weißenberg",
      steps: [
        {
          d: "2026-10-06",
          c: "Ausschuss für Anregungen, Beschwerden und Bürgerbeteiligung",
          s: "consulting"
        },
        {
          d: "2026-10-06",
          c: "Gremium laut Originalquelle",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/de-06436007-vo-1000977",
      place: "Stadt Hofheim am Taunus",
      committee: "Stadtverordnetenversammlung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "30",
        "SEP",
        "26"
      ],
      title: "Bauleitplanung der Stadt Hofheim am Taunus Bebauungsplan Nr. 132 „Jungehag“, Ergänzendes Verfahren Teile der Flur 1, Gemarkung Wildsachsen Änderung der Vereinbarung über Ausgleichsmaßnahmen gem. § 11 BauGB",
      steps: [
        {
          d: "2026-09-22",
          c: "Ausschuss für Planen, Bauen und Verkehr",
          s: "recommended"
        },
        {
          d: "2026-09-30",
          c: "Stadtverordnetenversammlung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nds-03241017-vo-20210303100574",
      place: "Stadt Springe",
      committee: "Rat",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Antrag der Fraktion Zukunft für Springe Antrag zum Auftrag einer Straßenzustandserfassung mit der Aufstellung eines Straßensanierungsprogramms",
      steps: [
        {
          d: "2026-04-23",
          c: "Rat",
          s: "unknown"
        },
        {
          d: "2026-06-25",
          c: "Rat",
          s: "unknown"
        },
        {
          d: "2026-09-01",
          c: "BauA 66 - Ausschuss für Bauen, Technik und Betriebshof",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nds-03154028-vo-9262",
      place: "Stadt Helmstedt",
      committee: "Rat",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Parkraumkonzept: überlange Pkw und Bewohnerparkplätze",
      steps: [
        {
          d: "2026-09-08",
          c: "Ausschuss für öffentliche Sicherheit und Ordnung (ASO)",
          s: "unknown"
        },
        {
          d: "2026-10-08",
          c: "Rat",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/de-09184148-vo-20260110100119",
      place: "Gemeinde Unterhaching",
      committee: "Haupt- und Finanzausschuss",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Mobilität; Beschleunigung des ÖPNV in Unterhaching - Busbeschleunigung",
      steps: [
        {
          d: "2026-10-06",
          c: "Bau-, Umwelt- und Ortsentwicklungsausschuss",
          s: "consulting"
        },
        {
          d: "2026-10-08",
          c: "Haupt- und Finanzausschuss",
          s: "consulting"
        }
      ]
    }
  ],
  verbaende: [
    {
      href: "/beschluss/nds-03458014-rp-vo-2834514",
      place: "Stadt Wildeshausen",
      committee: "Rat der Stadt Wildeshausen",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Satzung über die Hebesätze für die Grund- und Gewerbesteuer in der Stadt Wildeshausen (Hebesatzsatzung); Antrag des Ratsmitglieds Schulze Temming-Hanhoff vom 05.08.2026",
      steps: [
        {
          d: "2026-09-17",
          c: "Finanzausschuss",
          s: "unknown"
        },
        {
          d: "2026-10-08",
          c: "Rat der Stadt Wildeshausen",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/nds-03359010-vo-1002269",
      place: "Stadt Buxtehude",
      committee: "Rat",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "5",
        "OKT",
        "26"
      ],
      title: "Nachhaltiges Gewerbeflächenentwicklungskonzept - weiteres Vorgehen",
      steps: [
        {
          d: "2026-09-02",
          c: "Ausschuss für Wirtschaft, Tourismus und Gewerbeflächenmanagement",
          s: "recommended"
        },
        {
          d: "2026-10-05",
          c: "Rat",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/de-12068320-oparl-0fb2046bd0580689225c",
      place: "Stadt Neuruppin",
      committee: "Bau-, Stadtentwicklungs-, Umwelt- und Wirtschaftsförderungsausschuss",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Haushalt 2026 Hier: Sanierung der Gehwege in dem Ortsteil Buskow Von: Ortsteil Buskow",
      steps: [
        {
          d: "2025-10-16",
          c: "Bau-, Stadtentwicklungs-, Umwelt- und Wirtschaftsförderungsausschuss",
          s: "unknown"
        },
        {
          d: "2026-09-21",
          c: "Klausurtagung",
          s: "unknown"
        },
        {
          d: "2026-10-08",
          c: "Bau-, Stadtentwicklungs-, Umwelt- und Wirtschaftsförderungsausschuss",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nds-033555406-vo-1001956",
      place: "Samtgemeinde Ostheide",
      committee: "Rat der Samtgemeinde Ostheide",
      status: "wait",
      statusId: "approved",
      statusText: "Beschlossen",
      datum: [
        "22",
        "SEP",
        "26"
      ],
      title: "Änderung der Benutzungs- und Gebührensatzungen der Samtgemeinde Ostheide für die \"Nachschulischen Betreuungen\" an den Grundschulen Barendorf, Neetze und Wendisch Evern",
      steps: [
        {
          d: "2026-08-11",
          c: "Ausschuss für Bildung und Jugend der Samtgemeinde Ostheide",
          s: "recommended"
        },
        {
          d: "2026-09-22",
          c: "Rat der Samtgemeinde Ostheide",
          s: "approved"
        }
      ]
    },
    {
      href: "/beschluss/de-01001000-vo-nr-rv-88-2026",
      place: "Stadt Flensburg",
      committee: "Ratsversammlung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "2",
        "JUL",
        "26"
      ],
      title: "Innenhafen – Hochwasserschutz und Neugestaltung: Fördergelder aus dem Bundesprogramm „Anpassung urbaner und ländlicher Räume an den Klimawandel“ Projektaufruf 2026",
      steps: [
        {
          d: "2026-06-23",
          c: "Ausschuss für Umwelt, Planung und Stadtentwicklung",
          s: "unknown"
        },
        {
          d: "2026-07-02",
          c: "Ratsversammlung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05117000-vo-1002382",
      place: "Stadt Mülheim an der Ruhr",
      committee: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "29",
        "SEP",
        "26"
      ],
      title: "Rückblick auf zehn Jahre Innenstadtentwicklung | Vorstellung der Internetseite",
      steps: [
        {
          d: "2026-09-15",
          c: "Bezirksvertretung 1",
          s: "unknown"
        },
        {
          d: "2026-09-29",
          c: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
          s: "unknown"
        }
      ]
    }
  ],
  oeffentlichkeit: [
    {
      href: "/beschluss/nrw-05315000-oparl-c9b4e51699fe4d9dbf36",
      place: "Stadt Köln",
      committee: "Gremium laut Originalquelle",
      status: "wait",
      statusId: "announced",
      statusText: "Angekündigt",
      datum: [
        "29",
        "SEP",
        "26"
      ],
      title: "Mitteilungen zu Personalien des Jugendhilfeausschusses",
      steps: [
        {
          d: "2026-09-29",
          c: "Jugendhilfeausschuss",
          s: "announced"
        },
        {
          d: "2026-09-29",
          c: "Gremium laut Originalquelle",
          s: "announced"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05117000-vo-1002382",
      place: "Stadt Mülheim an der Ruhr",
      committee: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "29",
        "SEP",
        "26"
      ],
      title: "Rückblick auf zehn Jahre Innenstadtentwicklung | Vorstellung der Internetseite",
      steps: [
        {
          d: "2026-09-15",
          c: "Bezirksvertretung 1",
          s: "unknown"
        },
        {
          d: "2026-09-29",
          c: "Ausschuss für Bauen, Wohnen und Stadtentwicklung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/de-01001000-vo-nr-rv-88-2026",
      place: "Stadt Flensburg",
      committee: "Ratsversammlung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "2",
        "JUL",
        "26"
      ],
      title: "Innenhafen – Hochwasserschutz und Neugestaltung: Fördergelder aus dem Bundesprogramm „Anpassung urbaner und ländlicher Räume an den Klimawandel“ Projektaufruf 2026",
      steps: [
        {
          d: "2026-06-23",
          c: "Ausschuss für Umwelt, Planung und Stadtentwicklung",
          s: "unknown"
        },
        {
          d: "2026-07-02",
          c: "Ratsversammlung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/de-09184148-vo-20260110100119",
      place: "Gemeinde Unterhaching",
      committee: "Haupt- und Finanzausschuss",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Mobilität; Beschleunigung des ÖPNV in Unterhaching - Busbeschleunigung",
      steps: [
        {
          d: "2026-10-06",
          c: "Bau-, Umwelt- und Ortsentwicklungsausschuss",
          s: "consulting"
        },
        {
          d: "2026-10-08",
          c: "Haupt- und Finanzausschuss",
          s: "consulting"
        }
      ]
    },
    {
      href: "/beschluss/de-06433009-vo-202650209100138",
      place: "Gemeinde Nauheim",
      committee: "Gemeindevertretung",
      status: "wait",
      statusId: "unknown",
      statusText: "Stand offen",
      datum: [
        "1",
        "OKT",
        "26"
      ],
      title: "Beschluss der Haushaltssatzung für das Jahr 2026 und des Investitionsprogrammes 2026 bis 2029",
      steps: [
        {
          d: "2026-09-28",
          c: "Haupt- und Finanzausschuss",
          s: "unknown"
        },
        {
          d: "2026-10-01",
          c: "Gemeindevertretung",
          s: "unknown"
        }
      ]
    },
    {
      href: "/beschluss/nrw-05370028-vo-19195",
      place: "Stadt Übach-Palenberg",
      committee: "Rat der Stadt Übach-Palenberg",
      status: "wait",
      statusId: "consulting",
      statusText: "In Beratung",
      datum: [
        "8",
        "OKT",
        "26"
      ],
      title: "Beschluss des Klimaanpassungskonzepts",
      steps: [
        {
          d: "2026-09-29",
          c: "Ausschuss für Klima, Umwelt und Zukunft",
          s: "unknown"
        },
        {
          d: "2026-10-06",
          c: "Haupt- und Finanzausschuss",
          s: "consulting"
        },
        {
          d: "2026-10-08",
          c: "Rat der Stadt Übach-Palenberg",
          s: "unknown"
        }
      ]
    }
  ],
};
