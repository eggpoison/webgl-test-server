import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import Entity from "./Entity";

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   constructor(position: Point, name: string) {
      super("player", position, null, null, 0, [
         new HealthComponent(Player.MAX_HEALTH, Player.MAX_HEALTH, 0)
      ]);

      this.displayName = name;
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }
}

export default Player;