import express, {Application} from 'express';
import cors from 'cors';
import {createServer, Server as HttpServer} from 'http';
import {Server as SocketServer} from 'socket.io';
import {WebSocketService} from './services/websocket.service';
import {RedisService} from './services/redis.service';
import {errorHandler} from './middleware/error-handler';
import {Config} from './models/interfaces/config.interface';
import {QueueService} from './services/queue.service';
import {RoomService} from './services/room.service';
import logger from './config/logger';
import {roomRoutes} from './routes/room.route';
import {setupSwagger} from "./config/swagger";
import {authMiddleware} from "./middleware/jwt.middleware";
import {QueueEnum} from "./models/enums/queue.enum";
import {QueueMessageHandlers} from "./handlers/queue.handler";
import {userRoutes} from "./routes/user.route";
import {UserService} from "./services/user.service";

export class App {
    public app: Application;
    public server: HttpServer;
    public io: SocketServer;
    private queueService: QueueService;
    private queueHandlers: QueueMessageHandlers;
    private readonly wsService: WebSocketService;
    private readonly redisService: RedisService;
    private readonly roomService: RoomService;
    private readonly userService: UserService;

    constructor(config: Config) {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketServer(this.server, {
            cors: {
                origin: 'http://localhost:5173',
                methods: ['GET', 'POST'],
                allowedHeaders: ['Content-Type', 'Authorization'],
                credentials: true
            }
        });

        this.redisService = RedisService.getInstance(config.redis);
        this.roomService = RoomService.getInstance(this.redisService);
        this.userService = UserService.getInstance(this.redisService);
        this.wsService = new WebSocketService(this.io, {
            serverId: config.serverId,
            redisService: this.redisService
        });
        this.queueService = QueueService.getInstance(config, this.wsService);
        this.queueHandlers = QueueMessageHandlers.getInstance(config, this.wsService);

        this.initializeQueueService();
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeSwagger();
        this.initializeWebSocket();
        this.initializeErrorHandling();
    }

    private async initializeQueueService(): Promise<void> {
        try {
            this.queueService.registerQueueHandler(
                QueueEnum.WS_CHAT_MESSAGE,
                this.queueHandlers.handleChatMessage.bind(this.queueHandlers)
            );

            this.queueService.registerQueueHandler(
                QueueEnum.WS_NOTIFICATION,
                this.queueHandlers.handleNotification.bind(this.queueHandlers)
            );

            await this.queueService.connect();
            logger.info('Queue service initialized successfully');
        } catch (error) {
            logger.error('Error initializing queue service:', error);
            throw error;
        }
    }

    private initializeMiddlewares(): void {
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: true}));
        this.app.use(cors({
            origin: 'http://localhost:5173', // TODO : change to gateway URL
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization']
        }));
    }

    private initializeRoutes(): void {
        this.app.use('/api/rooms', authMiddleware, roomRoutes(this.roomService));
        this.app.use('/api/users', authMiddleware, userRoutes(this.userService));
    }

    private initializeSwagger(): void {
        setupSwagger(this.app);
    }

    private initializeWebSocket(): void {
        this.io.on('connection', (socket) => {
            this.wsService.handleConnection(socket);
        });
    }

    private initializeErrorHandling(): void {
        this.app.use(errorHandler);
    }

    public getServer(): HttpServer {
        return this.server;
    }
}