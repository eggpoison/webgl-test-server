import Entity from "../entities/Entity";
import BerryBush from "../entities/resources/BerryBush";
import AI from "./AI";

class BerryBushShakeAI extends AI {
   public readonly type = "berryBushShake";

   private target: BerryBush | null = null;

   public tick(): void {
      if (this.target === null) return;

      super.moveToPosition(this.target.position, 100, 50);

      if (this.mob.collidingObjects.has(this.target)) {
         this.shakeBush(this.target);
      }
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
      return this.entitiesInVisionRange.size > 0 ? 1 : 0;
   }

}

export default BerryBushShakeAI;