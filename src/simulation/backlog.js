export class Backlog {
    constructor(initialSize = 0) {
        this.tasks = [];
    }

    size() {
        return this.tasks.length;
    }

    addTask(task) {
        this.tasks.push(task);
    }

    /**
     * Take highest-value task (PO ensures ordering)
     */
    takeTask() {
        if (this.tasks.length === 0) return null;
        return this.tasks.shift();
    }

    /**
     * Remove and return the lowest-value task.
     * PO does not manage this, simulation enforces max size.
     */
    evictLowestValue() {
        if (this.tasks.length === 0) return null;

        let idx = 0;
        let minValue = this.tasks[0].value;

        for (let i = 1; i < this.tasks.length; i++) {
            if (this.tasks[i].value < minValue) {
                minValue = this.tasks[i].value;
                idx = i;
            }
        }

        return this.tasks.splice(idx, 1)[0];
    }
}
