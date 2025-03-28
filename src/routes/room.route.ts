import {Router} from 'express';
import {RoomService} from "../services/room.service";
import {Room} from "../models/room.model";
import logger from "../config/logger";
import {StatusCodes} from "http-status-codes";

/**
 * Defines the routes for room-related operations.
 *
 * @param {RoomService} roomService - The service to handle room operations.
 * @returns {Router} - The configured router.
 */
export const roomRoutes = (roomService: RoomService): Router => {
    const router = Router();

    /**
     * @swagger
     * /api/rooms:
     *   get:
     *     summary: Returns a simple message indicating the Rooms API used to test the app.
     *     responses:
     *       200:
     *         description: A simple message to test the app.
     */
    router.get('/', async (req, res) => {
        logger.info("Rooms API");
        res.json("Successfully queried Rooms API in the websocket microservice ! The JWT was successfully validated.");
    });

    /**
     * @swagger
     * /api/rooms/private:
     *   post:
     *     summary: Creates a private room if it doesn't exist, otherwise returns the existing room.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               userId:
     *                 type: string
     *               destId:
     *                 type: string
     *     responses:
     *       200:
     *         description: The created or existing room.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Room'
     */
    router.post('/private', async (req, res) => {
        let room: Room | null;

        const {userId, destId} = req.body;
        const roomId = roomService.generatePrivateRoomId(userId, destId)
        const roomExists: boolean = await roomService.roomExistsById(roomId);
        if (!roomExists) {
            room = await roomService.createPrivateRoom(userId, destId);
        } else {
            room = await roomService.getRoom(roomId);
        }
        res.json(room);
    });

    /**
     * @swagger
     * /api/rooms/private/add-users:
     *   post:
     *     summary: Adds users to a private room.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               roomId:
     *                 type: string
     *               usersId:
     *                 type: array
     *                 items:
     *                   type: string
     *     responses:
     *       200:
     *         description: A message indicating the users were added.
     */
    router.post('/private/add-users', async (req, res) => {
        const {roomId, usersId} = req.body;
        try {
            usersId.map(async (userId: string) => {
                await roomService.addUserToRoom(roomId, userId);
            });
            res.json("Users added to room");
        } catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
        }
    });

    /**
     * @swagger
     * /api/rooms/event:
     *   post:
     *     summary: Creates a room for an event.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               eventId:
     *                 type: string
     *     responses:
     *       200:
     *         description: The created event room.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Room'
     */
    router.post('/event', async (req, res) => {
        const {eventId} = req.body;
        const room: Room = await roomService.createEventRoom(eventId);
        res.json(room);
    });

    /**
     * @swagger
     * /api/rooms/event/add-user:
     *   post:
     *     summary: Adds a user to an event room.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               roomId:
     *                 type: string
     *               userId:
     *                 type: string
     *     responses:
     *       200:
     *         description: A message indicating the user was added.
     */
    router.post('/event/add-user', async (req, res) => {
        const {roomId, userId} = req.body;
        try {
            await roomService.addUserToRoom(roomId, userId);
            res.json("User added to room");
        }
        catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
        }
    });

    /**
     * @swagger
     * /api/rooms/jam:
     *   post:
     *     summary: Creates a room for a jam session.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               jamId:
     *                 type: string
     *     responses:
     *       200:
     *         description: The created jam room.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Room'
     */
    router.post('/jam', async (req, res) => {
        const {jamId} = req.body;
        const room: Room = await roomService.createJamRoom(jamId);
        res.json(room);
    });

    /**
     * @swagger
     * /api/rooms/jam/add-user:
     *   post:
     *     summary: Adds a user to a jam room.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               roomId:
     *                 type: string
     *               userId:
     *                 type: string
     *     responses:
     *       200:
     *         description: A message indicating the user was added.
     */
    router.post('/jam/add-user', async (req, res) => {
        const {roomId, userId} = req.body;
        try {
            await roomService.addUserToRoom(roomId, userId);
            res.json("User added to room");
        }
        catch (error) {
            res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(error);
        }
    });

    /**
     * @swagger
     * /api/rooms/existById/{roomId}:
     *   get:
     *     summary: Checks if a room exists by its ID.
     *     parameters:
     *       - in: path
     *         name: roomId
     *         schema:
     *           type: string
     *         required: true
     *         description: The ID of the room.
     *     responses:
     *       200:
     *          description: A message indicating if the room exists.
     *          content:
     *              application/json:
     *                  schema:
     *                      type: object
     *                      properties:
     *                          exists:
     *                              type: boolean
     *                              example: true
     */
    router.get('/existsById/:roomId', async (req, res) => {
        const roomId = req.params.roomId;
        const exists = await roomService.roomExistsById(roomId);
        if (exists) {
            res.status(StatusCodes.OK).json({exists: true});
        } else {
            res.status(StatusCodes.NOT_FOUND).json({exists: false});
        }
    });

    return router;
}