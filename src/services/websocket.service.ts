import {Server, Socket} from 'socket.io';
import {RedisService} from './redis.service';
import logger from '../config/logger';
import {Notification} from "../models/interfaces/notification.interface";
import {RoomPrefix} from "../models/enums/room-prefix.enum";

interface WebSocketServiceConfig {
    serverId: string;
    redisService: RedisService;
}

export class WebSocketService {
    private io: Server;
    private redisService: RedisService;
    private readonly serverId: string;

    /**
     * Creates an instance of WebSocketService.
     *
     * @param {Server} io - The Socket.io server instance.
     * @param {WebSocketServiceConfig} config - The configuration object.
     * @param {string} config.serverId - The ID of the server.
     * @param {RedisService} config.redisService - The Redis service instance.
     */
    constructor(io: Server, config: WebSocketServiceConfig) {
        this.io = io;
        this.redisService = config.redisService;
        this.serverId = config.serverId;
    }

    /**
     * Handles a new client connection.
     *
     * @param {Socket} socket - The connected client's socket.
     */
    public handleConnection(socket: Socket): void {
        logger.info(`New client connected: ${socket.id}`);

        socket.on('register', async (userId: string) => {
            try {
                await this.redisService.addUserConnection(userId, socket.id, this.serverId);
                // join user's rooms
                await this.handleUserRooms(socket, userId);
                logger.info(`User ${userId} registered with socket ${socket.id}`);
            } catch (error) {
                logger.error(`Registration error: ${error}`);
            }
        });

        socket.on('disconnect', async () => {
            try {
                const userId = await this.redisService.getUserIdFromSocket(socket.id);
                if (userId) {
                    await this.redisService.removeUserConnection(userId, socket.id);
                    logger.info(`User ${userId} disconnected (socket: ${socket.id})`);
                }
            } catch (error) {
                logger.error(`Disconnect error: ${error}`);
            }
        });
    }

    /**
     * Broadcasts a message to a specific room.
     *
     * @param {string} roomId - The ID of the room.
     * @param {string} event - The event name.
     * @param {any} data - The data to broadcast.
     * @throws {Error} - Throws an error if roomId or event is not provided or if the room does not exist.
     */
    public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
        if (!roomId || !event) {
            throw new Error('Room ID and event name are required to broadcast message');
        }

        try {
            const roomExists = await this.redisService.roomExistsById(roomId);
            if (!roomExists) {
                throw new Error(`Room ${roomId} does not exist`);
            }

            logger.info(`Broadcasting to room ${roomId}: ${JSON.stringify(data)}`);
            this.io.to(roomId).emit(event, data);
            logger.info(`Done broadcast to room ${roomId}: ${JSON.stringify(data)}`);
        } catch (error) {
            logger.error(`Broadcast error to room ${roomId}: ${error}`);
            throw error;
        }
    }

    /**
     * Sends a notification to a specific destination.
     *
     * @param {string} destId - The ID of the destination.
     * @param {string} channel - The channel name.
     * @param {Notification} notification - The notification to send.
     * @throws {Error} - Throws an error if the destination, channel, or notification is not provided or if the destination does not exist.
     */
    public async sendNotificationTo(destId: string | undefined, channel: string, notification: Notification): Promise<void> {
        if (destId && destId.startsWith(RoomPrefix.JAM) || destId && destId.startsWith(RoomPrefix.EVENT)) {
            if (!await this.redisService.roomExistsById(destId)) {
                throw new Error(`Room ${destId} does not exist`);
            }
        } else {
            if (destId && !await this.redisService.userExistsById(destId)) {
                throw new Error(`User ${destId} does not exist or is not connected`);
            }
        }

        if (destId && channel && notification) {
            logger.info(`Send notification to ${destId}: ${JSON.stringify(notification)}`);

            if (destId.startsWith(RoomPrefix.JAM) || destId.startsWith(RoomPrefix.EVENT)) {
                this.io.to(destId).emit(channel, notification);
            } else {
                const socketId = await this.redisService.getSocketFromUserId(destId);
                if (socketId) {
                    const socket = this.io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.emit(channel, notification);
                    } else {
                        throw new Error(`Socket ${socketId} not found for user ${destId}`);
                    }
                } else {
                    throw new Error(`Socket for user ${destId} not found`);
                }
            }
        } else {
            throw new Error('Destination ID, channel, and notification are required to process notification');
        }

    }

    /**
     * Handles joining the user to their rooms.
     *
     * @param {Socket} socket - The connected client's socket.
     * @param {string} userId - The ID of the user.
     */
    private async handleUserRooms(socket: Socket, userId: string): Promise<void> {
        try {
            console.log("handleUserRooms");
            const userRooms = await this.redisService.getUserRooms(userId);
            if (userRooms.length === 0) {
                logger.info(`No rooms found for user ${userId}`);
                // return;
            }

            const joinPromises = userRooms.map(async (roomId) => {
                const roomExists = await this.redisService.roomExistsById(roomId);
                if (roomExists) {
                    socket.join(roomId);
                    logger.info(`User ${userId} joined room ${roomId}`);
                } else {
                    logger.warn(`Room ${roomId} not found for user ${userId}`);
                }
            });

            await Promise.all(joinPromises);
            logger.info(`User ${userId} joined ${userRooms.length} rooms`);
        } catch (error) {
            logger.error(`Error joining user rooms: ${error}`);
            socket.emit('room_join_error', {message: 'Failed to join rooms'});
        }
    }

    /**
     * Adds a user to a specific room.
     *
     * @param {string} roomId - The ID of the room.
     * @param {string} userId - The ID of the user.
     * @throws {Error} - Throws an error if the room does not exist or if the user is not connected.
     */
    async addUserToRoom(roomId: string, userId: string) {
        try {
            const roomExists = await this.redisService.roomExistsById(roomId);
            if (!roomExists) {
                throw new Error(`Room ${roomId} does not exist`);
            }

            const socket = this.io.sockets.sockets.get(userId);
            if (socket) {
                socket.join(roomId);
                logger.info(`User ${userId} joined room ${roomId}`);
            } else {
                logger.warn(`User ${userId} not connected`);
            }

            // logger.info(`Added user ${usersId[0]} and user ${usersId[1]} users to room ${roomId}`);
        } catch (error) {
            logger.error(`Error adding users to room: ${error}`);
            throw error;
        }
    }

    /**
     * Cleans up all sockets from Redis.
     */
    public async cleanupSockets(): Promise<void> {
        try {
            const sockets = await this.redisService.getAllSockets();
            const cleanupPromises = sockets.map(async (socketId) => {
                const userId = await this.redisService.getUserIdFromSocket(socketId);
                if (userId) {
                    await this.redisService.removeUserConnection(userId, socketId);
                }
            });
            await Promise.all(cleanupPromises);
            logger.info('All sockets cleaned up from Redis');
        } catch (error) {
            logger.error(`Error cleaning up sockets: ${error}`);
        }
    }
}