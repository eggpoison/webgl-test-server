import { COLLISION_BITS, DEFAULT_COLLISION_MASK, ItemType, Point, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Item from "./Item";
import GameObject, { GameObjectEvents } from "../GameObject";
import { runFleshSwordAI } from "../flesh-sword-ai";
import Board from "../Board";
import Chunk from "src/Chunk";
import Mob from "src/entities/mobs/Mob";

interface EntityPickupCooldown {
   readonly entityID: number;
   secondsRemaining: number;
}

interface DroppedItemEvents extends GameObjectEvents {}

class DroppedItem extends GameObject<DroppedItemEvents> {
   protected events = {
      on_destroy: [],
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: [],
      during_dropped_item_collision: []
   }
   
   /** How long an item will take to despawn */
   private static readonly TICKS_TO_DESPAWN = 300 * SETTINGS.TPS;

   public readonly item: Item;

   private readonly entityPickupCooldowns = new Set<EntityPickupCooldown>();

   public mass = 0.1;

   public readonly collisionBit = COLLISION_BITS.other;
   public readonly collisionMask = DEFAULT_COLLISION_MASK;

   constructor(position: Point, item: Item) {
      super(position);

      this.position = position;
      this.item = item;

      const hitbox = new RectangularHitbox(SETTINGS.ITEM_SIZE, SETTINGS.ITEM_SIZE, 0, 0);
      this.addHitbox(hitbox);

      this.rotation = 2 * Math.PI * Math.random();

      Board.addDroppedItemToJoinBuffer(this);
   }
   
   public callCollisionEvent(gameObject: GameObject): void {
      gameObject.callEvents("during_dropped_item_collision", this);
   }

   public addToMobVisibleGameObjects(mob: Mob): void {
      mob.visibleGameObjects.push(this);
      mob.visibleDroppedItems.push(this);
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

   protected addToChunk(chunk: Chunk): void {
      super.addToChunk(chunk);
      chunk.droppedItems.add(this);
   }

   public removeFromChunk(chunk: Chunk): void {
      super.removeFromChunk(chunk);
      chunk.droppedItems.delete(this);
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