import {v4 as uuidv4} from 'uuid';
import {Config} from "../models/interfaces/config.interface";
import {Algorithm} from "jsonwebtoken";

export const config: Config = {
    mode: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3333'),
    host: process.env.HOST || '0.0.0.0',
    serverId: process.env.SERVER_ID || uuidv4(),
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD || 'admin'
    },
    activemq: {
        host: process.env.ACTIVEMQ_HOST || 'localhost',
        port: parseInt(process.env.ACTIVEMQ_PORT || '61613'),
        username: process.env.ACTIVEMQ_USERNAME || 'admin',
        password: process.env.ACTIVEMQ_PASSWORD || 'admin',
    },
    ws: {
        channel: {
            message: process.env.WS_MESSAGE_CHANNEL || 'new-message',
            notification: process.env.WS_NOTIFICATION_CHANNEL || 'new-notification'
        }
    },
    jwt: {
        algorithms: ['RS256'] as Algorithm[],
        jwksUri: process.env.JWT_JWKS_URI || 'https://jamify.daddyornot.xyz/jamify-uaa/oauth/.well-known/jwks.json'
    },
    engine: {
        uri: process.env.ENGINE_URI || 'https://jamify.daddyornot.xyz/jamify-engine/api/v1',
        // uri: process.env.ENGINE_URI || 'http://localhost:8082/api/v1',
    }

};