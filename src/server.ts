import { RemoteSocket, Server, Socket } from "socket.io";
import { networkInterfaces } from "os";
import SETTINGS from "webgl-test-shared/lib/settings";
import generateTerrain from "./terrain-generation";
import { ClientToServerEvents, InterServerEvents, PlayerData, ServerToClientEvents, SocketData } from "webgl-test-shared";

type ISocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Start the server
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(SETTINGS.SERVER_PORT);
console.log(`Server started on port ${SETTINGS.SERVER_PORT}`);

// Generate the tiles
const tiles = generateTerrain();

// const clients: { [key: string]: ISocket } = {};

const getSocketData = (socket: ISocket | RemoteSocket<ServerToClientEvents, SocketData>): SocketData => {
   const playerData = socket.data as PlayerData;

   const socketData: SocketData = Object.assign(playerData, { clientID: socket.id });
   return socketData;
}

io.on("connection", async socket => {
   // Log the new client
   console.log(`New client: ${socket.id}`);

   // Send a message to the client confirming the connection
   socket.emit("message", "Connection established");
   // Send the tiles to the client
   socket.emit("terrain", tiles);

   socket.on("playerData", async (playerData: PlayerData) => {
      socket.data.name = playerData.name;
      socket.data.position = playerData.position;

      const clients = await io.fetchSockets();

      // Send the player data to all other players
      for (const client of clients) {
         if (client.id === socket.id) continue;

         const socketData = getSocketData(socket);
         client.emit("newPlayer", socketData);
      }
      
      // Send existing players to the client
      for (const client of clients) {
         if (client.id === socket.id) continue;

         const socketData = getSocketData(client);
         socket.emit("newPlayer", socketData);
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
   socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
   });
});




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
console.log("Server IP Address:", results.eth0[0]);