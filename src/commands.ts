import { parseCommand } from "webgl-test-shared";
import Player from "./entities/Player";
import { SERVER } from "./server";

const killPlayer = (username: string): void => {
   const playerData = SERVER.getPlayerData();
   for (const data of Object.values(playerData)) {
      if (data.username === username) {
         // Found the player!
         const player = data.instance;

         // Kill the player
         player.getComponent("health")!.damage(999999);
         
         break;
      }
   }
}

const setTime = (time: number): void => {
   SERVER.time = time;
}

export function registerCommand(command: string, player: Player): void {
   const commandComponents = parseCommand(command);
   const numParameters = commandComponents.length - 1;

   switch (commandComponents[0]) {
      case "kill": {
         if (numParameters === 0) {
            killPlayer(player.displayName);
         } else if (numParameters === 1) {
            const targetPlayerName = commandComponents[1] as string;
            killPlayer(targetPlayerName);
         }
      }

      case "set_time": {
         setTime(commandComponents[1] as number);
      }
   }
}