import { Point } from "webgl-test-shared";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
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

   /** Player nametag. Used when sending player data to the client */
   private readonly displayName: string;

   /** All player events that have occurred since the start of the tick */
   private playerEvents: PlayerEvents = {
      pickedUpItemEntities: []
   };

   constructor(position: Point, name: string, id: number) {
      super(position, "player", {
         health: new HealthComponent(Player.MAX_HEALTH),
         inventory: new InventoryComponent(10)
      }, id);

      this.displayName = name;

      this.createEvent("item_pickup", (itemEntity: ItemEntity): void => {
         this.playerEvents.pickedUpItemEntities.push(itemEntity.id);
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

         const dist = this.position.distanceFrom(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }

      if (closestEntity === null) return null;

      return {
         target: closestEntity,
         angle: this.position.angleBetween(closestEntity.position)
      };
   }

   public getPlayerEvents(): PlayerEvents {
      return this.playerEvents;   
   }

   public clearPlayerEvents(): void {
      this.playerEvents = {
         pickedUpItemEntities: []
      };
   }
}

export default Player;