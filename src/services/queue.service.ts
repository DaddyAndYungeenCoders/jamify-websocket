import {Client, connect} from 'stompit';
import {Config} from "../models/interfaces/config.interface";
import {ConnectOptions} from "../models/interfaces/connect-options.interface";
import {ChatMessage} from "../models/interfaces/chat-message.interface";
import logger from "../config/logger";
import {WebSocketService} from "./websocket.service";
import {QueueHandler} from "../models/interfaces/queue-handler.interface";

/**
 * Service for managing the connection to ActiveMQ and handling message publishing and subscribing.
 */
export class QueueService {
    private publishClient: Client | null = null;
    private subscribeClient: Client | null = null;
    private readonly config: Config;
    private readonly wsService: WebSocketService;
    private isActiveMqAvailable: boolean = false; // Connection status flag
    private queueHandlers: Map<string, QueueHandler> = new Map();

    private static instance: QueueService;

    /**
     * Private constructor to enforce singleton pattern.
     * @param {Config} config - Configuration object.
     * @param {WebSocketService} webSocketService - WebSocket manager instance.
     */
    private constructor(config: Config, webSocketService: WebSocketService) {
        this.config = config;
        this.wsService = webSocketService;
    }

    /**
     * Returns the singleton instance of QueueService.
     * @param {Config} config - Configuration object.
     * @param {WebSocketService} webSocketService - WebSocket manager instance.
     * @returns {QueueService} The singleton instance of QueueService.
     */
    public static getInstance(config: Config, webSocketService: WebSocketService): QueueService {
        if (!QueueService.instance) {
            QueueService.instance = new QueueService(config, webSocketService);
        }
        return QueueService.instance;
    }

    /**
     * Connects to ActiveMQ with retry logic.
     * @param {number} [retries=5] - Number of retry attempts.
     * @param {number} [delayMs=3000] - Delay between retries in milliseconds.
     * @returns {Promise<void>} A promise that resolves when the connection is successful.
     */
    public async connect(retries: number = 5, delayMs: number = 3000): Promise<void> {
        const connectOptions: ConnectOptions = {
            host: this.config.activemq.host,
            port: this.config.activemq.port,
            connectHeaders: {
                host: '/',
                login: this.config.activemq.username,
                passcode: this.config.activemq.password
            }
        };

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                this.publishClient = await this.createClient(connectOptions);
                this.subscribeClient = await this.createClient(connectOptions);
                await this.setupConsumer();
                this.isActiveMqAvailable = true;
                logger.info('Successfully connected to ActiveMQ');
                return;
            } catch (error) {
                logger.error(`Failed to connect to ActiveMQ (attempt ${attempt} of ${retries}):`, error);
                if (attempt < retries) {
                    await this.delay(delayMs);
                } else {
                    this.isActiveMqAvailable = false;
                    throw error;
                }
            }
        }
    }

    /**
     * Delays execution for a specified number of milliseconds.
     * @param {number} ms - Number of milliseconds to delay.
     * @returns {Promise<void>} A promise that resolves after the specified delay.
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Creates a client connection to ActiveMQ.
     * @param {ConnectOptions} options - Connection options.
     * @returns {Promise<Client>} A promise that resolves with the client instance.
     */
    private createClient(options: ConnectOptions): Promise<Client> {
        return new Promise((resolve, reject) => {
            connect(options, (error: Error | null, client: Client) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(client);
                }
            });
        });
    }

    /**
     * Registers a handler for a specific queue.
     * @param {string} queueName - Name of the queue to subscribe to.
     * @param {(message: any) => Promise<void>} handler - Function to handle messages from this queue.
     */
    public registerQueueHandler(queueName: string, handler: (message: any) => Promise<void>) {
        this.queueHandlers.set(queueName, {
            queue: queueName,
            handler: handler
        });

        // If already connected, set up the subscription for this queue
        if (this.subscribeClient && this.isActiveMqAvailable) {
            this.subscribeToQueue(queueName, handler);
        }
    }

    /**
     * Subscribes to a specific queue and sets up the message handler.
     * @param {string} queueName - Name of the queue to subscribe to.
     * @param {(message: any) => Promise<void>} handler - Function to handle messages from this queue.
     * @returns {Promise<void>} A promise that resolves when the subscription is set up.
     * @throws {Error} If the subscriber is not connected.
     */
    private async subscribeToQueue(queueName: string, handler: (message: any) => Promise<void>): Promise<void> {
        if (!this.subscribeClient) {
            throw new Error('Subscriber not connected');
        }

        const subscribeHeaders = {
            destination: `/queue/${queueName}`,
            ack: 'client-individual'
        };

        this.subscribeClient.subscribe(subscribeHeaders, (error: Error | null, message) => {
            if (error) {
                logger.error(`Subscribe error for queue ${queueName}:`, error);
                return;
            }

            message.readString('utf-8', async (error: Error | null, body?: string) => {
                if (error || !body) {
                    logger.error(`Read message error for queue ${queueName}:`, error);
                    if (this.subscribeClient) {
                        this.subscribeClient.nack(message);
                    }
                    return;
                }

                try {
                    const messageData = JSON.parse(body);
                    await handler(messageData);
                    if (this.subscribeClient) {
                        this.subscribeClient.ack(message);
                    }
                } catch (error) {
                    logger.error(`Process message error for queue ${queueName}:`, error);
                    if (this.subscribeClient) {
                        this.subscribeClient.nack(message);
                    }
                }
            });
        });
    }

    /**
     * Sets up the consumer to listen for messages from the ActiveMQ queue.
     * @returns {Promise<void>} A promise that resolves when the consumer is set up.
     * @throws {Error} If the subscriber is not connected.
     */
    private async setupConsumer(): Promise<void> {
        if (!this.subscribeClient) {
            throw new Error('Subscriber not connected');
        }

        // Set up subscriptions for all registered queues
        for (const [queueName, queueHandler] of this.queueHandlers) {
            await this.subscribeToQueue(queueName, queueHandler.handler);
            logger.info(`Subscribed to queue: ${queueName}`);
        }
    }

    /**
     * Handles the processed message by broadcasting it to the appropriate WebSocket room.
     * @param {ChatMessage} message - The chat message to process.
     * @returns {Promise<void>} A promise that resolves when the message is broadcasted.
     * @throws {Error} If broadcasting fails.
     */
    private async handleProcessedMessage(message: ChatMessage): Promise<void> {
        logger.info(`Processing message: ${JSON.stringify(message)}`);
        try {
            if (message.roomId) {
                await this.wsService.broadcastToRoom(message.roomId, this.config.ws.channel.message, message);
            }
        } catch (error) {
            logger.error(`Error broadcasting message: ${error}`);
            throw error;
        }
    }

    /**
     * Disconnects from ActiveMQ.
     * @returns {Promise<void>} A promise that resolves when the disconnection is complete.
     * @throws {Error} If disconnection fails.
     */
    public async disconnect(): Promise<void> {
        try {
            if (this.publishClient) {
                this.publishClient.disconnect();
            }
            if (this.subscribeClient) {
                this.subscribeClient.disconnect();
            }
            this.isActiveMqAvailable = false; // Set connection status to false
        } catch (error) {
            logger.error('Error disconnecting from ActiveMQ:', error);
            throw error;
        }
    }
}