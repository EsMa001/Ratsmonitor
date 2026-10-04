import discovered from './nrw-sources.json' with {type:'json'};
import nearby from './nearby-sources.json' with {type:'json'};
import expanded from './expanded-sources.json' with {type:'json'};
import statewide from './statewide-sources.json' with {type:'json'};
import nds from './nds-sources.json' with {type:'json'};
// Explicitly verified municipal sources survive rebuilding the OParl directory.
// statewide-sources.json (NRW) and nds-sources.json (Niedersachsen) hold the sources found and verified by
// scripts/source-discovery/. The name NRW_SOURCES stays for its many users; it covers all connected states.
export const NRW_SOURCES = [...new Map([...statewide,...nds,...discovered,...nearby,...expanded].map(s=>[s.id,s])).values()];
