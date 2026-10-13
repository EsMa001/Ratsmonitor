/** Höchstens `max` Abrufe gleichzeitig (Kontoseiten: je gespeicherter Suche oder gespeichertem Artikel einer, bei Pro bis zu
 *  100). Weitere warten in der Reihe; ein abgebrochener Auftrag, der noch wartet, startet gar nicht erst. */
export function queue(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  const next = () => {
    if (active >= max) return;
    const run = waiting.shift();
    if (run) run();
  };
  return function run<T>(job: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      waiting.push(() => {
        if (signal?.aborted) {
          reject(new DOMException("Abgebrochen", "AbortError"));
          next();
          return;
        }
        active++;
        job().then(resolve, reject).finally(() => {
          active--;
          next();
        });
      });
      next();
    });
  };
}
