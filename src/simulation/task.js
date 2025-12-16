export class Task {
    constructor(type, infoTime, implTime, value, valueRetention) {
        this.type = type;
        this.infoTime = infoTime;
        this.implTime = implTime;
        this.value = value;
        this.valueRetention = valueRetention; // used for recurring value
        this.initialInfoTime = infoTime;      // for stats/debug
    }

    static random(cfg) {
        const type = Math.floor(Math.random() * cfg.numTaskTypes);

        const infoTime = Math.max(1, Math.round(
            cfg.avgInfoTime * (0.5 + Math.random())
        ));

        const implTime = Math.max(1, Math.round(
            cfg.avgImplTime * (0.5 + Math.random())
        ));

        const value = Math.max(1, Math.round(
            cfg.avgValue * (0.5 + Math.random())
        ));

        // Per-task randomized retention factor
        const valueRetention =
            cfg.taskRetentionMin +
            Math.random() * (cfg.taskRetentionMax - cfg.taskRetentionMin);

        return new Task(type, infoTime, implTime, value, valueRetention);
    }
}
