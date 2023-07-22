import { SETTINGS, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import BerryBush from "../entities/resources/BerryBush";
import AI from "./AI";
import { SERVER } from "../server";

class BerryBushShakeAI extends AI {
   private static readonly SAMPLE_DISTANCE = 60;

   /** Number of ticks for the entity to shake the berry bush */
   private static readonly TICKS_TO_SHAKE = 1.5 * SETTINGS.TPS;
   
   public readonly type = "berryBushShake";

   private target: BerryBush | null = null;

   private shakeTimer: number = 0;

   public tick(): void {
      if (this.target === null) return;

      super.moveToPosition(this.target.position, 100, 50);

      const testPosition = this.mob.position.copy();
      testPosition.add(new Vector(BerryBushShakeAI.SAMPLE_DISTANCE, this.mob.rotation).convertToPoint());

      // If the target entity is directly in front of the cow, start eatin it
      const entities = SERVER.board.getEntitiesAtPosition(testPosition);
      if (entities.has(this.target)) {
         this.shakeTimer++;
         if (this.shakeTimer >= BerryBushShakeAI.TICKS_TO_SHAKE) {
            this.shakeBush(this.target);
            this.shakeTimer = 0;
         }
      } else {
         this.shakeTimer = 0;
      }
   }

   protected onActivation(): void {
      this.shakeTimer = 0;
   }

   private shakeBush(berryBush: BerryBush): void {
      berryBush.shake();
   }

   public onRefresh(): void {
      let target: BerryBush | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of this.entitiesInVisionRange) {
         const distance = this.mob.position.calculateDistanceBetween(entity.position);
         if (distance < minDistance) {
            target = entity as BerryBush;
            minDistance = distance;
         }
      }

      this.target = target;
   }

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): Set<Entity> {
      // Only look for berry bushes
      const filteredEntities = new Set<Entity>();
      for (const entity of visibleEntities) {
         // Only try to shake berry bushes with berries on them
         if (entity.type === "berry_bush" && (entity as BerryBush).getNumBerries() > 0) {
            filteredEntities.add(entity);
         }
      }
      return filteredEntities;
   }

   protected _getWeight(): number {
      const hunger = this.mob.getAIParam("hunger")!;
      if (hunger < 80) return 0;
      
      return this.entitiesInVisionRange.size > 0 ? 1 : 0;
   }

}

export default BerryBushShakeAI;