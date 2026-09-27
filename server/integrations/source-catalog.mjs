import discovered from './nrw-sources.json' with {type:'json'};
import nearby from './nearby-sources.json' with {type:'json'};
import expanded from './expanded-sources.json' with {type:'json'};
// Explicitly verified municipal sources survive rebuilding the OParl directory.
export const NRW_SOURCES = [...new Map([...discovered,...nearby,...expanded].map(s=>[s.id,s])).values()];
