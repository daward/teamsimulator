export class Task {
  constructor({ type, infoTime, implTime, value, valueRetention }) {
    this.type = type; // integer 0..numTaskTypes-1
    this.infoTime = infoTime;
    this.implTime = implTime;
    this.value = value;
    this.valueRetention = valueRetention;

    this.initialInfoTime = infoTime;
    this.initialImplTime = implTime;
  }

  static clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  /**
   * Map a [0,1) coordinate to an integer topic id.
   */
  static topicFromCoord(topicCoord, numTaskTypes) {
    const n = Math.max(1, Math.floor(numTaskTypes ?? 1));
    const x = Math.min(Math.max(topicCoord ?? 0, 0), 1 - 1e-12);
    return Math.floor(x * n);
  }

  /**
   * Exponential-ish sampler around a mean, returning positive int >= 1.
   * Mean is approximate.
   */
  static samplePositiveInt(mean) {
    const m = Math.max(0, mean ?? 0);
    if (m <= 0) return 1;

    // exponential with mean 1, scaled by m
    const u = Math.max(1e-12, Math.random());
    const exp01 = -Math.log(u); // mean 1
    const x = exp01 * m;

    return Math.max(1, Math.round(x));
  }

  static sampleUniform(a, b) {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return lo + (hi - lo) * Math.random();
  }

  /**
   * Supports two ways of specifying effort:
   *  A) traditional: cfg.avgInfoTime + cfg.avgImplTime
   *  B) ratio model: cfg.avgTotalEffort + cfg.avgInfoShare (0..1)
   */
  static sampleInfoImpl(cfg) {
    const avgInfoTime = cfg.avgInfoTime;
    const avgImplTime = cfg.avgImplTime;

    // Ratio model (optional)
    const avgTotalEffort = cfg.avgTotalEffort;
    const avgInfoShare = cfg.avgInfoShare;

    if (
      (avgInfoTime == null || avgImplTime == null) &&
      avgTotalEffort != null &&
      avgInfoShare != null
    ) {
      const share = Task.clamp01(avgInfoShare);
      const total = Math.max(1, avgTotalEffort);

      const infoMean = Math.max(1, total * share);
      const implMean = Math.max(1, total * (1 - share));

      return {
        infoTime: Task.samplePositiveInt(infoMean),
        implTime: Task.samplePositiveInt(implMean)
      };
    }

    // Default model
    return {
      infoTime: Task.samplePositiveInt(avgInfoTime ?? 10),
      implTime: Task.samplePositiveInt(avgImplTime ?? 2)
    };
  }

  static random(cfg) {
    // 1) topicCoord in [0,1) -> integer topic
    const topicCoord = Math.random();
    const type = Task.topicFromCoord(topicCoord, cfg.numTaskTypes);

    // 2) effort times
    const { infoTime, implTime } = Task.sampleInfoImpl(cfg);

    // 3) value
    const avgValue = cfg.avgValue ?? 10;
    // keep it positive-ish with some spread
    const value = Math.max(1, Task.samplePositiveInt(avgValue));

    // 4) retention
    const rMin = cfg.taskRetentionMin ?? 0.3;
    const rMax = cfg.taskRetentionMax ?? 0.7;
    const valueRetention = Task.sampleUniform(rMin, rMax);

    return new Task({ type, infoTime, implTime, value, valueRetention });
  }
}
