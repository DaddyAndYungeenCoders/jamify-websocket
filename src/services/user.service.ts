import {RedisService} from "./redis.service";
import {User} from "../models/interfaces/user/user.types";
import {RequestContext} from "../utils/request-context";
import {Config} from "../models/interfaces/config.interface";

export class UserService {
    redisService: RedisService;
    config: Config;

    static instance: UserService;

    private constructor(config: Config, redisService: RedisService) {
        this.redisService = redisService;
        this.config = config;
    }

    static getInstance(config: Config, redisService: RedisService): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService(config, redisService);
        }
        return UserService.instance
    }

    async existsById(userId: string) {
        return await this.redisService.userExistsById(userId);
    }

    async getConnectedUsers() {
        const usersProviderId: string[] = await this.redisService.getConnectedUsers();
        const users: User[] = [];

        for (const userId of usersProviderId) {
            // can be otpimized with async call
            const user = await this.getUserByUserProviderId(userId);
            users.push(user);
        }

        return users;
    }


    async getUserByUserProviderId(userProviderId: string): Promise<User> {
        const token = RequestContext.getInstance().getToken();
        return fetch(`${this.config.engine.uri}/users/providerId/${userProviderId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        }).then(response => response.json())
            .catch(error => {
                throw new Error('Failed to fetch user : ' + error);
            })
    }
}