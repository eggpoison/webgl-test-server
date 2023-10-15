import { ItemType, Point, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Item from "./Item";
import _GameObject, { GameObjectEvents } from "../GameObject";
import { runFleshSwordAI } from "../flesh-sword-ai";
import Board from "../Board";

interface EntityPickupCooldown {
   readonly entityID: number;
   secondsRemaining: number;
}

interface DroppedItemEvents extends GameObjectEvents {}

class DroppedItem extends _GameObject<"droppedItem", DroppedItemEvents> {
   public i = "droppedItem" as const;

   protected events = {
      on_destroy: [],
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: []
   }
   
   /** How long an item will take to despawn */
   private static readonly TICKS_TO_DESPAWN = 300 * SETTINGS.TPS;

   public readonly item: Item;

   private readonly entityPickupCooldowns = new Set<EntityPickupCooldown>();

   constructor(position: Point, item: Item) {
      super(position);

      this.position = position;
      this.item = item;

      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(SETTINGS.ITEM_SIZE, SETTINGS.ITEM_SIZE);
      this.addHitbox(hitbox);

      this.rotation = 2 * Math.PI * Math.random();

      Board.addDroppedItemToJoinBuffer(this);
   } 

   public tick(): void {
      super.tick();
      
      // Update player pickup cooldowns
      for (const playerPickupCooldown of this.entityPickupCooldowns) {
         playerPickupCooldown.secondsRemaining -= 1 / SETTINGS.TPS;
         if (playerPickupCooldown.secondsRemaining <= 0) {
            this.entityPickupCooldowns.delete(playerPickupCooldown);
         }
      }

      // Flesh sword AI
      if (this.item.type === ItemType.flesh_sword) {
         runFleshSwordAI(this);
      }

      // Despawn old items
      if (this.ageTicks >= DroppedItem.TICKS_TO_DESPAWN) {
         this.remove();
      }
   }

   public addPlayerPickupCooldown(entityID: number, cooldownDuration: number): void {
      const pickupCooldown: EntityPickupCooldown = {
         entityID: entityID,
         secondsRemaining: cooldownDuration
      };
      this.entityPickupCooldowns.add(pickupCooldown);
   }

   public canBePickedUp(entityID: number): boolean {
      // If the player's username exists in the player pickup cooldowns, then the player can't pickup the item.
      for (const playerPickupCooldown of this.entityPickupCooldowns) {
         if (playerPickupCooldown.entityID === entityID) return false;
      }
      return true;
   }

   public remove(): void {
      if (!this.isRemoved) {
         super.remove();
         Board.addDroppedItemToRemoveBuffer(this);
         Board.removeDroppedItemFromJoinBuffer(this);
      }
   }
}

export default DroppedItem;