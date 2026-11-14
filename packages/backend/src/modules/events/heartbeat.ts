/** Schedule the next check only after the current one finishes; cancellation also covers in-flight checks. */
export function startHeartbeat(
  check: () => Promise<boolean>,
  write: () => boolean,
  close: () => void,
  intervalMs: number,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };
  const run = async () => {
    try {
      const allowed = await check();
      if (stopped) return;
      if (!allowed || !write()) {
        stop();
        close();
        return;
      }
      timer = setTimeout(() => void run(), intervalMs);
    } catch {
      if (stopped) return;
      stop();
      close();
    }
  };
  timer = setTimeout(() => void run(), intervalMs);
  return stop;
}
