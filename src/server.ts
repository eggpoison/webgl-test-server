import { Server, Socket } from "socket.io";
import { networkInterfaces } from "os";

// Start the server
const io = new Server(8000);
console.log("Server started on port 8000");

let tiles: unknown;
let terrainHasBeenRequested: boolean = false;

const bufferedSockets = new Array<Socket>();

io.on("connection", socket => {
   // Log the new client
   console.log("New client: " + socket.id);

   // Send a message to the client confirming the connection
   socket.emit("message", "Connection established");

   // Generate the board's terrain if it hasn't been generated already
   if (typeof tiles === "undefined") {
      if (!terrainHasBeenRequested) {
         // If the terrain hasn't been requested, request it
         terrainHasBeenRequested = true;
         
         socket.on("terrain", (terrain: unknown) => {
            console.log("Terrain received from client " + socket.id);

            tiles = terrain;

            // Send the terrain to all buffered sockets
            for (const bufferedSocket of bufferedSockets) {
               bufferedSocket.emit("terrain", tiles);
            }
            
            socket.emit("terrain", tiles);
         });
         
         socket.emit("terrain_generation_request");
      } else {
         // Otherwise, add this socket to the list of buffered sockets
         bufferedSockets.push(socket);
      }
   } else {
      // Send the terrain
      socket.emit("terrain", tiles);
   }

   socket.on("message", (...args) => {
      console.log(args);
      // const packet = JSON.parse(data.toString());

      // switch (packet.type) {
      //    // Receive the terrain generation function
      //    case "terrain_generation_request": {
      //       break;
      //    }
      //    // Print any messages from the client
      //    case "message": {
      //       console.log(packet.content);
      //       break;
      //    }
      // }
   });
   
   socket.on("disconnect", () => {
      console.log("Client disconnected: " + socket.id);
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
console.log("IP Address:", results.eth0[0]);