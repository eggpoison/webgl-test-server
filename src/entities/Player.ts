import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import Entity from "./Entity";

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;

   public readonly type = "player";

   private readonly displayName: string;

   constructor(position: Point, name: string) {
      super(position, null, null, [
         new HealthComponent(Player.MAX_HEALTH, Player.MAX_HEALTH, 0)
      ]);

      this.displayName = name;
   }
}

export default Player;