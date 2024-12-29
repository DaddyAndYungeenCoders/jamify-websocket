import {Algorithm} from "jsonwebtoken";

export interface Config {
    mode: string;
    port: number;
    host: string;
    serverId: string;
    redis: {
        host: string;
        port: number;
        password?: string;
    };
    activemq: {
        host: string;
        port: number;
        username: string;
        password: string;
    };
    ws: {
        channel: {
            message: string;
            notification: string;
        }
    };
    jwt: {
        algorithms: Algorithm[];
        jwksUri: string;
    };
}