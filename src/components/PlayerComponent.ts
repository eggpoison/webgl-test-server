import { PlayerComponentData } from "webgl-test-shared";
import Entity from "../Entity";
import { SERVER } from "../server";

export class PlayerComponent {
   /** ID of the tribesman the player is interacting with */
   public interactingEntityID = 0;
}

export function serialisePlayerComponent(player: Entity): PlayerComponentData {
   const playerData = SERVER.getPlayerDataFromInstance(player);
   if (playerData === null) {
      throw new Error("Can't find player data");
   }
   return {
      username: playerData.username
   };
}