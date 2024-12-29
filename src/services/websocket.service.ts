import {Server, Socket} from 'socket.io';
import {RedisService} from './redis.service';
import logger from '../config/logger';

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
     */
    public async broadcastToRoom(roomId: string, event: string, data: any): Promise<void> {
        logger.info(`Broadcasting to room ${roomId}: ${data.toString()}`);
        this.io.to(roomId).emit(event, data);
    }

    /**
     * Handles joining the user to their rooms.
     *
     * @param {Socket} socket - The connected client's socket.
     * @param {string} userId - The ID of the user.
     */
    private async handleUserRooms(socket: Socket, userId: string): Promise<void> {
        try {
            const userRooms = await this.redisService.getUserRooms(userId);
            for (const roomId of userRooms) {
                socket.join(roomId);
            }
        } catch (error) {
            logger.error(`Error joining user rooms: ${error}`);
        }
    }
}