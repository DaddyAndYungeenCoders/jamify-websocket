// src/handlers/queue-handlers.ts
import {WebSocketService} from '../services/websocket.service';
import {Config} from "../models/interfaces/config.interface";
import {ChatMessage} from "../models/interfaces/chat-message.interface";
import logger from "../config/logger";
import {Notification} from "../models/interfaces/notification.interface";

export class QueueMessageHandlers {

    private static instance: QueueMessageHandlers;

    /**
     * Creates an instance of QueueMessageHandlers.
     *
     * @param {WebSocketService} wsService - The WebSocket service instance.
     * @param {Config} config - The configuration object.
     */
    private constructor(
        private readonly config: Config,
        private readonly wsService: WebSocketService
    ) {
    }

    public static getInstance(config: Config, wsService: WebSocketService): QueueMessageHandlers {
        if (!QueueMessageHandlers.instance) {
            QueueMessageHandlers.instance = new QueueMessageHandlers(config, wsService);
        }
        return QueueMessageHandlers.instance;
    }

    /**
     * Handles incoming chat messages from the queue.
     *
     * @param {ChatMessage} message - The chat message object.
     * @returns {Promise<void>} A promise that resolves when the message is handled.
     */
    public async handleChatMessage(message: ChatMessage): Promise<void> {
        if (!message.roomId) {
            logger.error('Invalid message: missing roomId', message);
            return;
        }

        try {
            await this.wsService.broadcastToRoom(
                message.roomId,
                this.config.ws.channel.message,
                message
            );
        } catch (error) {
            logger.error('Error broadcasting chat message:', error);
            throw error;
        }
    }

    /**
     * Handles incoming notifications from the queue.
     *
     * @param {Notification} notification - The notification object.
     * @returns {Promise<void>} A promise that resolves when the notification is handled.
     */
    public async handleNotification(notification: Notification): Promise<void> {
        if (!notification.destId && !notification.roomId) {
            logger.error('Invalid notification: missing destId and roomId', notification);
            return;
        }

        try {
            await this.wsService.sendNotificationTo(
                notification.destId ? notification.destId : notification.roomId,
                this.config.ws.channel.notification,
                notification
            );
        } catch (error) {
            logger.error('Error processing notification:', error);
            throw error;
        }
    }
}