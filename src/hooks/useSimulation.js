// src/hooks/useSimulation.js
import { useCallback, useEffect, useRef, useState } from "react";

function createWorker() {
  return new Worker(new URL("../workers/simWorker.js", import.meta.url), {
    type: "module",
  });
}

export function useSimulation() {
  const workerRef = useRef(null);
  const runIdRef = useRef(0);
  const timeoutRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [result, setResult] = useState(null);
  const [sweep1DResult, setSweep1DResult] = useState(null);
  const [sweep2DResult, setSweep2DResult] = useState(null);

  const clearWatchdog = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const w = createWorker();

    w.onmessage = (evt) => {
      const msg = evt?.data;
      if (!msg || typeof msg !== "object") return;

      // Ignore stale responses (critical for refresh/autorun + StrictMode)
      if (typeof msg.runId === "number" && msg.runId !== runIdRef.current) {
        return;
      }

      clearWatchdog();

      if (msg.type === "error") {
        setError(typeof msg.payload === "string" ? msg.payload : "Worker error");
        setRunning(false);
        return;
      }

      if (msg.type === "singleResult") {
        setResult(msg.payload);
        setRunning(false);
        return;
      }

      if (msg.type === "sweep1DResult") {
        setSweep1DResult(msg.payload);
        setRunning(false);
        return;
      }

      if (msg.type === "sweep2DResult") {
        setSweep2DResult(msg.payload);
        setRunning(false);
        return;
      }

      // Unknown message => fail closed
      setError(`Unknown worker response type: ${String(msg.type)}`);
      setRunning(false);
    };

    w.onerror = (e) => {
      clearWatchdog();
      setError(
        e?.message ||
          "Worker crashed/failed to load. Check console for simWorker.js errors."
      );
      setRunning(false);

      try {
        w.terminate();
      } catch {}
      workerRef.current = null;
    };

    w.onmessageerror = () => {
      clearWatchdog();
      setError("Worker message error (payload could not be cloned/deserialized).");
      setRunning(false);

      try {
        w.terminate();
      } catch {}
      workerRef.current = null;
    };

    workerRef.current = w;
    return w;
  }, []);

  useEffect(() => {
    return () => {
      clearWatchdog();
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {}
        workerRef.current = null;
      }
    };
  }, []);

  const post = useCallback(
    (type, payload, { timeoutMs = 60000 } = {}) => {
      setError(null);
      setRunning(true);

      runIdRef.current += 1;
      const runId = runIdRef.current;

      const w = ensureWorker();

      // Watchdog: never allow "running forever" silently
      clearWatchdog();
      timeoutRef.current = setTimeout(() => {
        setError(
          `Worker timed out after ${Math.round(timeoutMs / 1000)}s (no response).`
        );
        setRunning(false);

        try {
          w.terminate();
        } catch {}
        workerRef.current = null;
      }, timeoutMs);

      try {
        w.postMessage({ type, payload, runId });
      } catch (err) {
        clearWatchdog();
        setError(err?.message || String(err));
        setRunning(false);

        try {
          w.terminate();
        } catch {}
        workerRef.current = null;
      }
    },
    [ensureWorker]
  );

  const runSingle = useCallback(
    (config, presetSelections) => {
      post("runSingle", { config, presetSelections }, { timeoutMs: 60000 });
    },
    [post]
  );

  const runSweep1D = useCallback(
    (req) => {
      post("runSweep1D", req, { timeoutMs: 120000 });
    },
    [post]
  );

  const runSweep2D = useCallback(
    (req) => {
      post("runSweep2D", req, { timeoutMs: 180000 });
    },
    [post]
  );

  return {
    running,
    error,

    result,
    sweep1DResult,
    sweep2DResult,

    runSingle,
    runSweep1D,
    runSweep2D,
  };
}
