export class ProductOwner {
    constructor(cfg) {
        this.cfg = cfg;
    }

    work(cycle, backlog, cfg) {
        if (backlog.size() === 0) return;

        const windowSize = cfg.poWindowSize;
        const actions = cfg.poActionsPerCycle;

        for (let a = 0; a < actions; a++) {
            if (backlog.size() <= 1) break;

            // Look at the top N tasks
            const effectiveWindow = Math.min(windowSize, backlog.size());
            const window = backlog.tasks.slice(0, effectiveWindow);

            // Sort descending by value
            window.sort((a, b) => b.value - a.value);

            // Introduce PO error (misjudgment)
            if (Math.random() < cfg.poErrorProb) {
                const i = Math.floor(Math.random() * window.length);
                const j = Math.floor(Math.random() * window.length);
                [window[i], window[j]] = [window[j], window[i]];
            }

            // Write sorted (and maybe scrambled) window back
            for (let i = 0; i < effectiveWindow; i++) {
                backlog.tasks[i] = window[i];
            }
        }
    }
}
