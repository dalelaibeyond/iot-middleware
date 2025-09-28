const { Worker } = require('worker_threads');
const path = require('path');
const logger = require('../../utils/logger');
const eventBus = require('./eventBus');

class WorkerPool {
    constructor(size) {
        this.size = size;
        this.workers = [];
        this.taskQueue = [];
        this.initialize();
    }

    initialize() {
        for (let i = 0; i < this.size; i++) {
            const worker = new Worker(path.join(__dirname, 'messageWorker.js'));
            
            worker.on('message', (result) => {
                this.handleWorkerMessage(worker, result);
            });

            worker.on('error', (error) => {
                logger.error('Worker error:', error);
                // Replace the failed worker
                const index = this.workers.indexOf(worker);
                if (index > -1) {
                    this.workers.splice(index, 1);
                    this.initialize();
                }
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    logger.error(`Worker stopped with exit code ${code}`);
                }
            });

            this.workers.push({
                worker,
                busy: false
            });
        }
    }

    handleWorkerMessage(worker, result) {
        // Find the worker in our pool
        const workerObj = this.workers.find(w => w.worker === worker);
        if (workerObj) {
            workerObj.busy = false;
            
            // Process result
            if (result.error) {
                eventBus.publish('message.error', result.error);
            } else {
                eventBus.publish('message.processed', result.data);
            }

            // Process next task if available
            this.processNextTask();
        }
    }

    async processMessage(message, context) {
        return new Promise((resolve, reject) => {
            const task = { message, context, resolve, reject };
            this.taskQueue.push(task);
            this.processNextTask();
        });
    }

    processNextTask() {
        // Find available worker
        const availableWorker = this.workers.find(w => !w.busy);
        
        if (availableWorker && this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            availableWorker.busy = true;
            
            availableWorker.worker.postMessage({
                message: task.message,
                context: task.context
            });

            // Monitor worker health
            this.monitorWorkerHealth(availableWorker.worker);
        }
    }

    monitorWorkerHealth(worker) {
        const timeout = setTimeout(() => {
            if (worker.threadId) { // Check if worker still exists
                logger.warn(`Worker ${worker.threadId} seems stuck, restarting...`);
                worker.terminate();
                this.initialize();
            }
        }, 30000); // 30 seconds timeout

        worker.once('message', () => clearTimeout(timeout));
    }

    shutdown() {
        return Promise.all(this.workers.map(w => w.worker.terminate()));
    }
}

// Export singleton instance
module.exports = new WorkerPool(require('os').cpus().length);
