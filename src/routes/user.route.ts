import {Router} from 'express';
import logger from "../config/logger";
import {StatusCodes} from "http-status-codes";
import {UserService} from "../services/user.service";

/**
 * Defines the routes for user-related operations.
 *
 * @param {UserService} userService - The user service.
 * @returns {Router} - The configured router.
 */
export const userRoutes = (userService: UserService): Router => {
    const router = Router();

    /**
     * @swagger
     * /api/users:
     *   get:
     *     summary: Test the User API.
     *     responses:
     *       200:
     *         description: Successfully queried the User API.
     */
    router.get('/', async (req, res) => {
        logger.info("User API");
        res.json("Successfully queried the User API");
    });

    /**
     * @swagger
     * /api/users/existsById/{userId}:
     *   get:
     *     summary: Check if a user exists by their ID.
     *     parameters:
     *       - in: path
     *         name: userId
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: The user exists.
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 exists:
     *                   type: boolean
     *                   example: true
     */
    router.get('/existsById/:userId', async (req, res) => {
        const userId = req.params.userId;
        const exists = await userService.existsById(userId);
        if (exists) {
            res.status(StatusCodes.OK).json({exists: true});
        } else {
            res.status(StatusCodes.NOT_FOUND).json({exists: false});
        }
    });

    return router;
}