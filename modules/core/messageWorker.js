const { parentPort } = require('worker_threads');
const { normalize } = require('../normalizers');

parentPort.on('message', async ({ message, context }) => {
    try {
        // Message normalization
        const normalized = normalize(message.topic, message.payload, context);
        
        if (!normalized) {
            throw new Error('Message normalization failed');
        }

        // Send back processed message
        parentPort.postMessage({ data: normalized });
    } catch (error) {
        parentPort.postMessage({ error: error.message });
    }
});
