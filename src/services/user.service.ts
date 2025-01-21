import {RedisService} from "./redis.service";
import {User} from "../models/interfaces/user/user.types";
import {RequestContext} from "../utils/request-context";
import {Config} from "../models/interfaces/config.interface";

export class UserService {
    redisService: RedisService;
    config: Config;

    static instance: UserService;

    /**
     * Private constructor to enforce singleton pattern.
     *
     * @param {Config} config - The configuration object.
     * @param {RedisService} redisService - The Redis service instance.
     */
    private constructor(config: Config, redisService: RedisService) {
        this.redisService = redisService;
        this.config = config;
    }

    /**
     * Returns the singleton instance of UserService.
     *
     * @param {Config} config - The configuration object.
     * @param {RedisService} redisService - The Redis service instance.
     * @returns {UserService} - The singleton instance of UserService.
     */
    static getInstance(config: Config, redisService: RedisService): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService(config, redisService);
        }
        return UserService.instance
    }

    /**
     * Checks if a user exists by their ID.
     *
     * @param {string} userId - The ID of the user.
     * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating if the user exists.
     */
    async existsById(userId: string): Promise<boolean> {
        return await this.redisService.userExistsById(userId);
    }

    /**
     * Retrieves all connected users.
     *
     * @returns {Promise<User[]>} - A promise that resolves to an array of connected users.
     */
    async getConnectedUsers(): Promise<User[]> {
        const usersProviderId: string[] = await this.redisService.getConnectedUsers();
        const users: User[] = [];

        for (const userId of usersProviderId) {
            // can be optimized with async call
            const user = await this.getUserByUserProviderId(userId);
            users.push(user);
        }

        return users;
    }

    /**
     * Retrieves a user by their provider ID.
     *
     * @param {string} userProviderId - The provider ID of the user.
     * @returns {Promise<User>} - A promise that resolves to the user object.
     * @throws {Error} - Throws an error if the user fetch fails.
     */
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