import { HitboxType, HitData, Point, SETTINGS } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import CircularHitbox from "../hitboxes/CircularHitbox";
import Hitbox from "../hitboxes/Hitbox";
import ItemEntity from "../items/ItemEntity";
import Entity from "./Entity";

type PlayerAttackInfo = {
   readonly target: Entity;
   readonly angle: number;
}

/** Player events to be sent to the client */
type PlayerEvents = {
   readonly pickedUpItemEntities: Array<number>;
}

class Player extends Entity {
   private static readonly MAX_HEALTH = 20;

   public readonly type = "player";

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   private hitsTaken = new Array<HitData>();

   constructor(position: Point, name: string) {
      super(position, new Set<Hitbox<HitboxType>>([
         new CircularHitbox({
            type: "circular",
            radius: 32
         })
      ]), {
         health: new HealthComponent(Player.MAX_HEALTH, true),
         inventory: new InventoryComponent(SETTINGS.PLAYER_ITEM_SLOTS)
      });

      this.displayName = name;

      this.createEvent("hurt", (damage: number, attackingEntity: Entity | null) => {
         const hitData: HitData = {
            damage: damage,
            angleFromDamageSource: attackingEntity !== null ? this.position.calculateAngleBetween(attackingEntity.position) + Math.PI : null
         };
         this.hitsTaken.push(hitData);
      });
   }

   public getClientArgs(): [displayName: string] {
      return [this.displayName];
   }

   public calculateAttackedEntity(targetEntities: ReadonlyArray<Entity>): PlayerAttackInfo | null {
      let closestEntity: Entity | null = null;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of targetEntities) {
         if (typeof entity === "undefined") continue;

         // Don't attack entities without health components
         if (entity.getComponent("health") === null) continue;

         const dist = this.position.calculateDistanceBetween(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }

      if (closestEntity === null) return null;

      return {
         target: closestEntity,
         angle: this.position.calculateDistanceBetween(closestEntity.position)
      };
   }

   public getHitsTaken(): ReadonlyArray<HitData> {
      return this.hitsTaken;
   }

   public clearHitsTaken(): void {
      this.hitsTaken = new Array<HitData>();
   }
}

export default Player;