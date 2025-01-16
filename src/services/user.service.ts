import {RedisService} from "./redis.service";

export class UserService {
    redisService: RedisService;

    static instance: UserService;

    private constructor(redisService: RedisService) {
        this.redisService = redisService;
    }

    static getInstance(redisService: RedisService): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService(redisService);
        }
        return UserService.instance
    }

    async existsById(userId: string) {
        return await this.redisService.userExistsById(userId);
    }
}