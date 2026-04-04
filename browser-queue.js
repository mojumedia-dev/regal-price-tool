/**
 * Global browser queue — ensures only one Puppeteer browser runs at a time.
 * Railway containers have tight thread/process limits; running multiple Chrome
 * instances in parallel causes pthread_create failures and crashes.
 */

let _queue = Promise.resolve();

/**
 * Enqueue a browser task. The provided async function will only run after
 * all previously enqueued tasks have completed.
 *
 * @param {() => Promise<T>} fn  Async function that launches and uses a browser
 * @returns {Promise<T>}
 */
function enqueueBrowserTask(fn) {
  const result = _queue.then(() => fn());
  // Swallow errors on the queue chain so one failure doesn't block future tasks
  _queue = result.catch(() => {});
  return result;
}

module.exports = { enqueueBrowserTask };
