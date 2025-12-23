// src/hooks/useSimulation.js
import { useCallback, useEffect, useRef, useState } from "react";

function createWorker() {
  return new Worker(new URL("../workers/simWorker.js", import.meta.url), {
    type: "module",
  });
}

export function useSimulation() {
  const workerRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const [result, setResult] = useState(null);
  const [sweep1DResult, setSweep1DResult] = useState(null);
  const [sweep2DResult, setSweep2DResult] = useState(null);
  const [scatterResult, setScatterResult] = useState(null);
  const [scatterProgress, setScatterProgress] = useState(null);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;

    const w = createWorker();

    w.onmessage = (evt) => {
      const msg = evt?.data;
      if (!msg || typeof msg !== "object") return;

      if (msg.type === "error") {
        setError(typeof msg.payload === "string" ? msg.payload : "Worker error");
        setScatterProgress(null);
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

      if (msg.type === "scatterResult") {
        setScatterResult(msg.payload);
        setScatterProgress(null);
        setRunning(false);
        return;
      }

      if (msg.type === "scatterProgress") {
        setScatterProgress(msg.payload || null);
        return;
      }

      setError(`Unknown worker response type: ${String(msg.type)}`);
      setRunning(false);
    };

    w.onerror = (e) => {
      const message =
        e?.message ||
        "Worker failed (check src/workers/simWorker.js path and runtime errors).";
      setError(message);
      setScatterProgress(null);
      setRunning(false);
      try {
        w.terminate();
      } catch {}
      workerRef.current = null;
    };

    w.onmessageerror = () => {
      setError("Worker message error (failed to deserialize payload).");
      setScatterProgress(null);
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
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {}
        workerRef.current = null;
      }
    };
  }, []);

  const post = useCallback(
    (type, payload) => {
      setError(null);
      setRunning(true);
      setScatterProgress(null);

      const w = ensureWorker();
      try {
        w.postMessage({ type, payload });
      } catch (err) {
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
      post("runSingle", { config, presetSelections });
    },
    [post]
  );

  const runSweep1D = useCallback(
    (req) => {
      post("runSweep1D", req);
    },
    [post]
  );

  const runSweep2D = useCallback(
    (req) => {
      post("runSweep2D", req);
    },
    [post]
  );

  const runScatter = useCallback(
    (req) => {
      // req: { baseConfig, presetSelections, nOverride?, xMetricSpec, yMetricSpec }
      post("runScatter", req);
    },
    [post]
  );

  return {
    running,
    error,

    result,
    sweep1DResult,
    sweep2DResult,
    scatterResult,
    scatterProgress,

    runSingle,
    runSweep1D,
    runSweep2D,
    runScatter,
  };
}
