/**
 * Utility for dynamically importing components with automatic retry and
 * deployment version skew protection (automatic recovery from chunk loading errors).
 */
export function lazyWithRetry<T>(
  componentImport: () => Promise<T>,
  retries = 2,
  interval = 800
): Promise<T> {
  return new Promise((resolve, reject) => {
    componentImport()
      .then((module) => {
        // Clear any stored reload flag on successful load
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem(`chunk_reload_${window.location.pathname}`);
        }
        resolve(module);
      })
      .catch((error) => {
        const errorMsg = String(error?.message || '');
        const isChunkError =
          error?.name === 'ChunkLoadError' ||
          /loading chunk/i.test(errorMsg) ||
          /failed to fetch dynamically imported module/i.test(errorMsg) ||
          /dynamically imported module/i.test(errorMsg);

        if (retries <= 0) {
          // If all retries failed and it's a chunk mismatch (due to a new build or deployment),
          // automatically reload the window once to fetch the latest HTML and bundle hashes.
          if (isChunkError && typeof window !== 'undefined') {
            const reloadKey = `chunk_reload_${window.location.pathname}`;
            const alreadyReloaded = sessionStorage.getItem(reloadKey);
            if (!alreadyReloaded) {
              sessionStorage.setItem(reloadKey, String(Date.now()));
              window.location.reload();
              return;
            }
          }
          reject(error);
          return;
        }

        setTimeout(() => {
          lazyWithRetry(componentImport, retries - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
}
