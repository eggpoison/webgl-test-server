import { ItemType, parseCommand } from "webgl-test-shared";
import Player from "./entities/Player";
import { createItem } from "./items/item-creation";
import { SERVER } from "./server";

const killPlayer = (username: string): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   // Kill the player
   player.getComponent("health")!.damage(999999, 0, 0,null);
}

const damagePlayer = (username: string, damage: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   // Damage the player
   player.getComponent("health")!.damage(damage, 0, 0, null);
}

const setTime = (time: number): void => {
   SERVER.time = time;
}

const giveItem = (username: string, itemType: ItemType, amount: number): void => {
   const player = SERVER.getPlayerFromUsername(username);
   if (player === null) return;

   const item = createItem(itemType, amount);
   player.getComponent("inventory")!.addItem(item);
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

         break;
      }

      case "damage": {
         if (numParameters === 1) {
            const damage = commandComponents[1] as number;
            damagePlayer(player.displayName, damage);
         } else if (numParameters === 2) {
            const username = commandComponents[1] as string;
            const damage = commandComponents[2] as number;
            damagePlayer(username, damage);
         }

         break;
      }

      case "set_time": {
         setTime(commandComponents[1] as number);

         break;
      }

      case "give": {
         if (numParameters === 1) {
            const itemType = commandComponents[1] as ItemType;
            
            giveItem(player.displayName, itemType, 1);
         } else if (numParameters === 2) {
            const itemType = commandComponents[1] as ItemType;
            const amount = commandComponents[2] as number;

            giveItem(player.displayName, itemType, amount);
         }
         
         break;
      }
   }
}