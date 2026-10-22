/* plenara.X: Rechenfunktionen je Art (Schlüssel wie in xCached der Routen). Eine Liste für den Worker-Thread
 * (server/node/x-worker.mjs) und für den Rückfall im Hauptprozess; jede Funktion liest nur (db, REGIONS, params). */
import {news} from './analytics-news.mjs';
import {trends,trendList,trendSpread} from './analytics-trends.mjs';
import {network,networkList} from './analytics-network.mjs';
import {factions,factionList} from './analytics-factions.mjs';
import {knowledgeGraph,graphList} from './analytics-graph.mjs';
import {compare,compareList} from './analytics-compare.mjs';
import {decisions,decisionList} from './analytics-decisions.mjs';
import {diffusion,diffusionList} from './analytics-diffusion.mjs';
import {xQuery} from './plenara-x-query.mjs';
import {xSignals} from './plenara-x-signals.mjs';

export const X_FUNCTIONS={
 news,
 trends,'trends-list':trendList,'trends-spread':trendSpread,
 network,'network-list':networkList,
 fraktionen:factions,'fraktionen-list':factionList,
 graph:knowledgeGraph,'graph-list':graphList,
 compare,'compare-list':compareList,
 decisions,'decisions-list':decisionList,
 diffusion,'diffusion-list':diffusionList,
 'x-v7':xQuery,
 'x-signale-v9':xSignals,
};
