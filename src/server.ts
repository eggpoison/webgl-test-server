import { RemoteSocket, Server, Socket } from "socket.io";
import { networkInterfaces } from "os";
import generateTerrain from "./terrain-generation";
import { startReadingInput } from "./command-input";
import { ClientToServerEvents, InterServerEvents, ServerToClientEvents, SocketData } from "webgl-test-shared";
import { SETTINGS } from "webgl-test-shared/lib/settings";

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Start the server
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);

const playerPositionRequests: { [clientID: string]: Array<(playerPosition: [number, number]) => void> } = {};

// Generate the tiles
const tiles = generateTerrain();

const getPlayerPosition = (socket: ISocket | RemoteSocket<ServerToClientEvents, SocketData>): Promise<[number, number]> => {
   return new Promise(resolve => {
      socket.emit("position");

      if (!playerPositionRequests.hasOwnProperty(socket.id)) {
         playerPositionRequests[socket.id] = [];
      }

      // Add the request
      playerPositionRequests[socket.id].push(
         (playerPosition: [number, number]): void => {
            resolve(playerPosition);
         }
      );
   });
}

const getSocketData = (socket: ISocket | RemoteSocket<ServerToClientEvents, SocketData>): Promise<SocketData> => {
   return new Promise(async resolve => {
      const name = socket.data.name!;
      
      const position = await getPlayerPosition(socket);
      
      const socketData: SocketData = {
         name: name,
         position: position,
         clientID: socket.id
      };
      resolve(socketData);
   });
}

io.on("connection", async socket => {
   // Log the new client
   console.log(`New client: ${socket.id}`);

   // Send the tiles to the client
   socket.emit("terrain", tiles);

   socket.on("socketData", async (socketData: SocketData) => {
      socket.data.name = socketData.name;
      socket.data.position = socketData.position;

      const clients = await io.fetchSockets();

      // Send the socket data to all other players
      for (const client of clients) {
         if (client.id === socket.id) continue;

         client.emit("newPlayer", socketData);
      }
      
      // Send existing players to the client
      for (const client of clients) {
         if (client.id === socket.id) continue;

         const currentPlayerSocketData = await getSocketData(client);
         socket.emit("newPlayer", currentPlayerSocketData);
      }
   });

   // Push any player movement packets to all other clients
   socket.on("playerMovement", async (movementHash: number) => {
      const clients = await io.fetchSockets();

      for (const client of clients) {
         // Don't send the chat message to the socket sending it
         if (client.id === socket.id) continue;

         client.emit("playerMovement", socket.id, movementHash);
      }
   });

   socket.on("position", (position: [number, number]) => {
      if (!playerPositionRequests.hasOwnProperty(socket.id)) return;

      for (const request of playerPositionRequests[socket.id]) request(position);
      playerPositionRequests[socket.id] = [];
   });

   // Push any chat messages to all other clients
   socket.on("chatMessage", async (chatMessage: string) => {
      const clients = await io.fetchSockets();
      for (const client of clients) {
         // Don't send the chat message to the socket sending it
         if (client.id === socket.id) continue;

         client.emit("chatMessage", socket.data.name!, chatMessage);
      }
   });

   // Log whenever a client disconnects from the server
   socket.on("disconnect", async () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Send a disconnect packet to all other players
      const clients = await io.fetchSockets();
      for (const client of clients) {
         client.emit("clientDisconnect", socket.id);
      }
   });
});

startReadingInput();




// 
// Print the IP address of the server
// https://stackoverflow.com/questions/3653065/get-local-ip-address-in-node-js#:~:text=Any%20IP%20address%20of%20your,networkInterfaces()%3B%20console.
// 

const nets = networkInterfaces();
const results = Object.create(null); // Or just '{}', an empty object

for (const name of Object.keys(nets)) {
   for (const net of nets[name]!) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
      const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
      if (net.family === familyV4Value && !net.internal) {
         if (!results[name]) {
            results[name] = [];
         }
         results[name].push(net.address);
      }
   }
}
console.log("Server IP Address:", typeof results.eth0 !== "undefined" ? results.eth0[0] : results.en0[0]);