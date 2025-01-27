import {RedisService} from "./redis.service";
import {Room} from "../models/room.model";
import {RoomType} from "../models/enums/room-type.enum";
import {RoomPrefix} from "../models/enums/room-prefix.enum";
import {WebSocketService} from "./websocket.service";
import {webcrypto} from "node:crypto";

export class RoomService {
    redisService: RedisService;
    webSocketService: WebSocketService;

    static instance: RoomService;

    private constructor(redisService: RedisService, webSocketService: WebSocketService) {
        this.redisService = redisService;
        this.webSocketService = webSocketService
    }

    static getInstance(redisService: RedisService, webSocketService: WebSocketService): RoomService {
        if (!RoomService.instance) {
            RoomService.instance = new RoomService(redisService, webSocketService);
        }
        return RoomService.instance
    }

    async getRoom(roomId: string): Promise<Room | null> {
        return await this.redisService.getRoom(roomId);
    }

    private async createRoom(type: RoomType, roomId: string, metadata?: {}): Promise<Room> {
        const room = new Room(roomId, type, metadata);
        await this.redisService.saveRoom(room);
        return room;
    }

    async createPrivateRoom(user1Id: string, user2Id: string, metadata?: {}): Promise<Room> {
        const roomId = this.generatePrivateRoomId(user1Id, user2Id);
        return this.createRoom(RoomType.PRIVATE, roomId, metadata);
    }

    async createEventRoom(eventId: string, metadata?: {}): Promise<Room> {
        const roomId = `${RoomPrefix.EVENT}${eventId}`;
        return this.createRoom(RoomType.EVENT, roomId, metadata);
    }

    async createJamRoom(jamId: string, metadata?: {}): Promise<Room> {
        const roomId = `${RoomPrefix.JAM}${jamId}`;
        return this.createRoom(RoomType.JAM, roomId, metadata);
    }

    async addUserToRoom(roomId: string, userId: string) {
        await this.webSocketService.addUserToRoom(roomId, userId);
        await this.redisService.addUserToRoom(roomId, userId);
    }

    async removeUserFromRoom(roomId: string, userId: string) {
        await this.redisService.removeUserFromRoom(roomId, userId);
    }

    async getRoomMembers(roomId: string) {
        return await this.redisService.getRoomUsers(roomId);
    }

    async getUserRooms(userId: string) {
        return await this.redisService.getUserRooms(userId);
    }

    generatePrivateRoomId(user1Id: string, user2Id: string) {
        return `${RoomPrefix.PRIVATE}${[user1Id, user2Id].sort().join('_')}`;
    }

    async roomExistsById(roomId: string) {
        return await this.redisService.roomExistsById(roomId);
    }
}