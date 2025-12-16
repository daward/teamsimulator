// src/hooks/useSimulation.js
import { useEffect, useMemo, useRef, useState } from "react";

export function useSimulation() {
  const workerRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] = useState(null);
  const [sweep1DResult, setSweep1DResult] = useState(null);
  const [sweep2DResult, setSweep2DResult] = useState(null);

  useEffect(() => {
    const w = new Worker(new URL("../workers/simWorker.js", import.meta.url), {
      type: "module",
    });
    workerRef.current = w;

    w.onmessage = (evt) => {
      const { type, payload } = evt.data || {};

      if (type === "error") {
        setError(payload || "Unknown error");
        setRunning(false);
        return;
      }

      if (type === "singleResult") {
        setResult(payload);
        setRunning(false);
        setError("");
        return;
      }

      if (type === "sweep1DResult") {
        setSweep1DResult(payload);
        setRunning(false);
        setError("");
        return;
      }

      if (type === "sweep2DResult") {
        setSweep2DResult(payload);
        setRunning(false);
        setError("");
        return;
      }

      // ignore unknown responses
    };

    w.onerror = (e) => {
      setError(e?.message || "Worker error");
      setRunning(false);
    };

    return () => {
      w.terminate();
      workerRef.current = null;
    };
  }, []);

  const runSingle = (config, presetSelections) => {
    setRunning(true);
    setError("");
    setResult(null);

    workerRef.current?.postMessage({
      type: "runSingle",
      payload: { config, presetSelections },
    });
  };

  const runSweep1D = ({ baseConfig, presetSelections, paramName, values }) => {
    setRunning(true);
    setError("");
    setSweep1DResult(null);

    workerRef.current?.postMessage({
      type: "runSweep1D",
      payload: { baseConfig, presetSelections, paramName, values },
    });
  };

  const runSweep2D = ({
    baseConfig,
    presetSelections,
    xParam,
    xValues,
    seriesParam,
    seriesValues,
  }) => {
    setRunning(true);
    setError("");
    setSweep2DResult(null);

    workerRef.current?.postMessage({
      type: "runSweep2D",
      payload: {
        baseConfig,
        presetSelections,
        xParam,
        xValues,
        seriesParam,
        seriesValues,
      },
    });
  };

  return {
    result,
    sweep1DResult,
    sweep2DResult,
    error,
    running,
    runSingle,
    runSweep1D,
    runSweep2D,
  };
}
