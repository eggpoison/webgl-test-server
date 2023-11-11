import { COLLISION_BITS, DEFAULT_COLLISION_MASK, Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../../entity-components/HealthComponent";
import Mob from "./Mob";
import CircularHitbox from "../../hitboxes/CircularHitbox";
import Entity from "../Entity";
import Slime from "./Slime";
import Board from "../../Board";
import WanderAI from "../../mob-ai/WanderAI";
import ChaseAI from "../../mob-ai/ChaseAI";

class Slimewisp extends Mob {
   private static readonly MAX_HEALTH = 3;

   private static readonly RADIUS = 16;

   private static readonly MERGE_TIME = 2;

   private mergeTimer = Slimewisp.MERGE_TIME;

   public mass = 0.5;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   public collisionPushForceMultiplier = 0.3;

   constructor(position: Point) {
      super(position, {
         health: new HealthComponent(Slimewisp.MAX_HEALTH, false)
      }, "slimewisp", 100);

      // Merge AI
      this.addAI(new ChaseAI(this, {
         acceleration: 50,
         terminalVelocity: 25,
         entityIsChased: (entity: Entity): boolean => {
            return entity.type === "slimewisp";
         }
      }));

      this.addAI(new WanderAI(this, {
         wanderRate: 99999,
         acceleration: 50,
         terminalVelocity: 25,
         strictValidation: false,
         shouldWander: (wanderPositionX: number, wanderPositionY: number): boolean => {
            const tileX = Math.floor(wanderPositionX / SETTINGS.TILE_SIZE);
            const tileY = Math.floor(wanderPositionY / SETTINGS.TILE_SIZE);
            const tile = Board.getTile(tileX, tileY);
            return tile.biomeName === "swamp";
         }
      }));

      const hitbox = new CircularHitbox(Slimewisp.RADIUS, 0, 0);
      this.addHitbox(hitbox);

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
      new Slime(slimeSpawnPosition);
   
      this.remove();
      otherSlimewisp.remove();
   }
   
   public getClientArgs(): [] {
      return [];
   }
}

export default Slimewisp;