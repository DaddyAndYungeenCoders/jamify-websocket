import Redis from 'ioredis';
import {RedisServiceConfig} from "../models/interfaces/redis-service-config.interface";
import {UserConnection} from "../models/interfaces/user-connection.interface";
import logger from "../config/logger";
import {Room} from "../models/room.model";

/**
 * Service for managing Redis operations related to user connections and rooms.
 */
export class RedisService {
    private redis: Redis;
    static instance: RedisService;

    /**
     * Constructs a new RedisService instance.
     * @param {RedisServiceConfig} config - The configuration object for Redis.
     */
    private constructor(config: RedisServiceConfig) {
        this.redis = new Redis(config);
    }

    /**
     * Returns the singleton instance of RedisService.
     * @param {RedisServiceConfig} config - The configuration object for Redis.
     * @returns {RedisService} The singleton instance of RedisService.
     */
    public static getInstance(config: RedisServiceConfig): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService(config);
        }
        return RedisService.instance;
    }

    /**
     * Adds a user connection to Redis.
     * @param {string} userId - The ID of the user.
     * @param {string} socketId - The socket ID of the connection.
     * @param {string} serverId - The server ID where the connection is established.
     * @returns {Promise<void>} A promise that resolves when the connection is added.
     * @throws {Error} If adding the connection fails.
     */
    async addUserConnection(userId: string, socketId: string, serverId: string): Promise<void> {
        const connectionData: UserConnection = {
            socketId,
            serverId,
            timestamp: Date.now()
        };

        try {
            // Use a multi to execute multiple commands atomically
            const multi = this.redis.multi();

            // Get the old user ID associated with the socket ID and remove the connection
            const oldUserId = await this.getUserIdFromSocket(socketId);
            if (oldUserId) {
                multi.srem(
                    `user:${oldUserId}:connections`,
                    JSON.stringify({...connectionData, socketId})
                );
            }

            multi.sadd(
                `user:${userId}:connections`,
                JSON.stringify(connectionData)
            );
            multi.set(`socket:${socketId}:user`, userId);

            await multi.exec();
        } catch (error) {
            logger.error(`Error adding user connection: ${error}`);
            throw new Error('Failed to add user connection');
        }
    }

    /**
     * Removes a user connection from Redis and its associated sockets.
     * @param {string} userId - The ID of the user.
     * @param {string} socketId - The socket ID of the connection.
     * @returns {Promise<void>} A promise that resolves when the connection is removed.
     * @throws {Error} If removing the connection fails.
     */
    async removeUserConnection(userId: string, socketId: string): Promise<void> {
        try {
            const connection = await this.getUserConnection(userId, socketId);
            if (connection) {
                await Promise.all([
                    this.redis.srem(
                        `user:${userId}:connections`,
                        JSON.stringify(connection)
                    ),
                    this.redis.del(`socket:${socketId}:user`)
                ]);
            }

            const socket = await this.getSocketFromUserId(userId);
            if (socket) {
                await this.redis.del(`socket:${socket}:user`);
            }
        } catch (error) {
            logger.error(`Error removing user connection: ${error}`);
            throw new Error('Failed to remove user connection');
        }
    }

    /**
     * Retrieves a user connection from Redis.
     * @param {string} userId - The ID of the user.
     * @param {string} socketId - The socket ID of the connection.
     * @returns {Promise<UserConnection | null>} A promise that resolves with the user connection or null if not found.
     * @throws {Error} If retrieving the connection fails.
     */
    async getUserConnection(userId: string, socketId: string): Promise<UserConnection | null> {
        try {
            const connections = await this.redis.smembers(`user:${userId}:connections`);
            const connection = connections
                .map(conn => JSON.parse(conn) as UserConnection)
                .find(conn => conn.socketId === socketId);

            return connection || null;
        } catch (error) {
            logger.error(`Error getting user connection: ${error}`);
            throw new Error('Failed to get user connection');
        }
    }

    /**
     * Retrieves the user ID associated with a socket ID from Redis.
     * @param {string} socketId - The socket ID.
     * @returns {Promise<string | null>} A promise that resolves with the user ID or null if not found.
     * @throws {Error} If retrieving the user ID fails.
     */
    async getUserIdFromSocket(socketId: string): Promise<string | null> {
        try {
            return await this.redis.get(`socket:${socketId}:user`);
        } catch (error) {
            logger.error(`Error getting userId from socket: ${error}`);
            throw new Error('Failed to get userId from socket');
        }
    }

    /**
     * Retrieves all connections of a user from Redis.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<UserConnection[]>} A promise that resolves with an array of user connections.
     * @throws {Error} If retrieving the connections fails.
     */
    async getAllUserConnections(userId: string): Promise<UserConnection[]> {
        try {
            const connections = await this.redis.smembers(`user:${userId}:connections`);
            return connections.map(conn => JSON.parse(conn) as UserConnection);
        } catch (error) {
            logger.error(`Error getting all user connections: ${error}`);
            throw new Error('Failed to get all user connections');
        }
    }

    /**
     * Retrieves all rooms a user is part of from Redis.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<string[]>} A promise that resolves with an array of room IDs.
     * @throws {Error} If retrieving the rooms fails.
     */
    async getUserRooms(userId: string): Promise<string[]> {
        const keys = await this.redis.keys(`user:*${userId}*:rooms`); // Trouver toutes les clés correspondantes
        console.log("Clés trouvées :", keys);
        // list of 'user:private-room_123_gze:rooms'

        if (keys.length === 0) {
            console.log("Aucune clé trouvée pour cet utilisateur.");
            return [];
        } else {
            // get room for each key
            const rooms = keys.map(key => {
                return key.split(":")[1];
            })

            console.log("Rooms trouvées :", rooms);
            return rooms.flat();
        }
    }

    /**
     * Adds a user to a room in Redis.
     * @param {string} userId - The ID of the user.
     * @param {string} roomId - The ID of the room.
     * @returns {Promise<void>} A promise that resolves when the user is added to the room.
     * @throws {Error} If adding the user to the room fails.
     */
    async addUserToRoom(userId: string, roomId: string): Promise<void> {
        try {
            await this.redis.sadd(`user:${userId}:rooms`, roomId);
        } catch (error) {
            logger.error(`Error adding user room: ${error}`);
            throw new Error('Failed to add user room');
        }
    }

    /**
     * Removes a user from a room in Redis.
     * @param {string} userId - The ID of the user.
     * @param {string} roomId - The ID of the room.
     * @returns {Promise<void>} A promise that resolves when the user is removed from the room.
     * @throws {Error} If removing the user from the room fails.
     */
    async removeUserFromRoom(userId: string, roomId: string): Promise<void> {
        try {
            await this.redis.srem(`user:${userId}:rooms`, roomId);
        } catch (error) {
            logger.error(`Error removing user room: ${error}`);
            throw new Error('Failed to remove user room');
        }
    }

    /**
     * Retrieves all users in a room from Redis.
     * @param {string} roomId - The ID of the room.
     * @returns {Promise<string[]>} A promise that resolves with an array of user IDs.
     * @throws {Error} If retrieving the users fails.
     */
    async getRoomUsers(roomId: string): Promise<string[]> {
        try {
            return await this.redis.smembers(`room:${roomId}:users`);
        } catch (error) {
            logger.error(`Error getting room users: ${error}`);
            throw new Error('Failed to get room users');
        }
    }

    /**
     * Saves a room to Redis.
     * @param {Room} room - The room object to save.
     * @returns {Promise<void>} A promise that resolves when the room is saved.
     * @throws {Error} If saving the room fails.
     */
    async saveRoom(room: Room): Promise<void> {
        try {
            await this.redis.set(`room:${room.id}`, JSON.stringify(room));
        } catch (error) {
            logger.error(`Error saving room: ${error}`);
            throw new Error('Failed to save room');
        }
    }

    /**
     * Retrieves a room from Redis.
     * @param {string} roomId - The ID of the room.
     * @returns {Promise<Room | null>} A promise that resolves with the room object or null if not found.
     * @throws {Error} If retrieving the room fails.
     */
    async getRoom(roomId: string): Promise<Room | null> {
        try {
            const roomData = await this.redis.get(`room:${roomId}`);
            return roomData ? JSON.parse(roomData) : null;
        } catch (error) {
            logger.error(`Error getting room: ${error}`);
            throw new Error('Failed to get room');
        }
    }

    /**
     * Checks if a room exists in Redis by its ID.
     * @param {string} roomId - The ID of the room.
     * @returns {Promise<boolean>} A promise that resolves with true if the room exists, false otherwise.
     */
    async roomExistsById(roomId: string): Promise<boolean> {
        const exists = await this.redis.exists(`room:${roomId}`);
        return exists === 1;
    }

    /**
     * Checks if a user exists in Redis by their ID.
     * @param {string} userId - The ID of the user.
     * @returns {Promise<boolean>} A promise that resolves with true if the user exists, false otherwise.
     */
    async userExistsById(userId: string): Promise<boolean> {
        const exists = await this.redis.exists(`user:${userId}`);
        return exists === 1;
    }

    /**
     * Retrieves the socket ID associated with a user ID from Redis.
     * @param userId
     */
    async getSocketFromUserId(userId: string): Promise<string | null> {
        try {
            const connections = await this.getAllUserConnections(userId);
            // Prend la connexion la plus récente si plusieurs existent
            const latestConnection = connections.sort((a, b) => b.timestamp - a.timestamp)[0];
            return latestConnection?.socketId || null;
        } catch (error) {
            logger.error(`Error getting socket from userId: ${error}`);
            throw new Error('Failed to get socket from userId');
        }
    }

    /**
     * Retrieves list of members in a room with their socket IDs.
     * @param roomId
     */
    async getRoomMembers(roomId: string): Promise<{ userId: string, socketId: string }[]> {
        try {
            const users = await this.getRoomUsers(roomId);
            const memberDetails = await Promise.all(
                users.map(async userId => {
                    const socketId = await this.getSocketFromUserId(userId);
                    return {userId, socketId: socketId || ''};
                })
            );
            return memberDetails.filter(member => member.socketId);
        } catch (error) {
            logger.error(`Error getting room members: ${error}`);
            throw new Error('Failed to get room members');
        }
    }
}