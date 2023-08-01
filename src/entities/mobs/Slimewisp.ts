import { Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import Mob from "./Mob";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Slime from "./Slime";
import Board from "../../Board";

class Slimewisp extends Mob {
   private static readonly MAX_HEALTH = 3;

   private static readonly RADIUS = 16;

   private static readonly MERGE_TIME = 2;

   private mergeTimer = Slimewisp.MERGE_TIME;

   constructor(position: Point, isNaturallySpawned: boolean) {
      super(position, {
         health: new HealthComponent(Slimewisp.MAX_HEALTH, false)
      }, "slimewisp", SETTINGS.TILE_SIZE * 1.5, isNaturallySpawned);

      this.addAI("wander", {
         aiWeightMultiplier: 0.5,
         wanderRate: 99999,
         acceleration: 50,
         terminalVelocity: 25,
         shouldWander: (position: Point): boolean => {
            const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return tile.biomeName === "swamp";
         }
      });

      this.addAI("chase", {
         aiWeightMultiplier: 1,
         acceleration: 50,
         terminalVelocity: 25,
         entityIsChased: (entity: Entity): boolean => {
            return entity.type === "slimewisp";
         }
      });

      this.addHitboxes([
         new CircularHitbox({
            type: "circular",
            radius: Slimewisp.RADIUS
         })
      ]);

      this.createEvent("during_entity_collision", (entity: Entity): void => {
         if (entity.type !== "slimewisp") return;

         this.mergeTimer -= 1 / SETTINGS.TPS;
         if (this.mergeTimer <= 0) {
            this.merge(entity as Slimewisp);
         }
      });
   }
   
   private merge(otherSlimewisp: Slimewisp): void {
      // Don't both merge at once
      if (otherSlimewisp.isRemoved) return;

      // Create a slime between the two wisps
      const slimeSpawnPosition = new Point((this.position.x + otherSlimewisp.position.x) / 2, (this.position.y + otherSlimewisp.position.y) / 2);
      new Slime(slimeSpawnPosition, false);
   
      this.remove();
      otherSlimewisp.remove();
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default Slimewisp;