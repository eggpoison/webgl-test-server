import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import Entity from "./Entity";

type PlayerAttackInfo = {
   readonly target: Entity;
   readonly distance: number;
   readonly angle: number;
}

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   constructor(position: Point, name: string, id: number) {
      super("player", position, null, null, 0, [
         new HealthComponent(Player.MAX_HEALTH, Player.MAX_HEALTH, 0)
      ], id);

      this.displayName = name;
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }

   public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): PlayerAttackInfo | null {
   let closestEntity: Entity | null = null;
   let minDistance = Number.MAX_SAFE_INTEGER;
   for (const entity of targetEntities) {
      // Don't attack entities without health components
      if (entity.getComponent(HealthComponent) === null) continue;

      const dist = this.position.distanceFrom(entity.position);
      if (dist < minDistance) {
         closestEntity = entity;
         minDistance = dist;
      }
   }

   if (closestEntity === null) return null;

   return {
      target: closestEntity,
      distance: minDistance,
      angle: this.position.angleBetween(closestEntity.position)
   };
}
}

export default Player;