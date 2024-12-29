# jamify-websocket

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Jamify Websocket is a microservice handling real-time communications for the Jamify application. It is built with Node.js, Express.js, Socket.io.

## Features

- Real-time communication via WebSocket
- Receive messages from ActiveMQ queues and send them to users via WebSocket
- Manage connection and disconnection of users
- Endpoints to get information about rooms and create them if needed

## Requirements

- Node.js
- Express.js
- Socket.io
- ActiveMQ
- Docker

## Installation

1. Clone the repository:

    ```sh
    git clone
    ```
2. Install the dependencies:

    ```sh
    npm install
    ```

3. Start the development server:

    ```sh
    npm run dev
    ```

4. Open your browser and navigate to `http://localhost:5173`.

## Configuration

Update the configuration file with your ActiveMQ and WebSocket settings.

## Usage

- `npm run dev`: Start the development server.
- `npm run start`: Start the production server.
- `npm run test`: Run the tests.

Client needs to register by emitting a `register` event with the user's id. It will be saved in the redis database along with its socket id.

Then, it can receive messages via WebSocket that are read from the ActiveMQ queue.

### Endpoints

- `GET /api/rooms`: Get information about rooms.
- `POST /api/rooms/private`: Create a private room.
- `POST /api/rooms/private/add-users`: Add users to a private room.
- `POST /api/rooms/event`: Create a room for an event.
- `POST /api/rooms/event/add-user`: Add a user to an event room.
- `POST /api/rooms/jam`: Create a room for a jam session.
- `POST /api/rooms/jam/add-user`: Add a user to a jam room.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.