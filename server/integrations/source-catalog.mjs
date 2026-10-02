import discovered from './nrw-sources.json' with {type:'json'};
import nearby from './nearby-sources.json' with {type:'json'};
import expanded from './expanded-sources.json' with {type:'json'};
import statewide from './statewide-sources.json' with {type:'json'};
// Explicitly verified municipal sources survive rebuilding the OParl directory.
// statewide-sources.json holds the sources found and verified by scripts/source-discovery/.
export const NRW_SOURCES = [...new Map([...statewide,...discovered,...nearby,...expanded].map(s=>[s.id,s])).values()];
