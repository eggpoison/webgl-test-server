import { Point, RectangularHitboxInfo, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Chunk from "../Chunk";
import Player from "../entities/Player";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { SERVER } from "../server";
import Tile from "../tiles/Tile";
import Item from "./generic/Item";
import _GameObject, { GameObject } from "../GameObject";
import { GameObjectEvents } from "../events";
import Entity from "../entities/Entity";

let nextAvailableItemID = 0;

const findAvailableItemID = (): number => {
   return nextAvailableItemID++;
}
type PlayerPickupCooldown = {
   readonly username: string;
   secondsRemaining: number;
}

class DroppedItem extends _GameObject<"droppedItem", GameObjectEvents> {
   public i = "droppedItem" as const;

   protected events = {
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: []
   }
   /** ROUGHLY how long an item will take to despawn */
   private static readonly SECONDS_TO_DESPAWN = 300;

   /** Unique identifier for the dropped item */
   public readonly id: number;

   /** How long the item has existed in seconds */
   private age: number = 0;

   public readonly item: Item;

   private readonly playerPickupCooldowns = new Set<PlayerPickupCooldown>();

   constructor(position: Point, item: Item) {
      super(position);

      this.id = findAvailableItemID();

      this.position = position;
      this.item = item;

      this.addHitboxes([
         new RectangularHitbox({
            type: "rectangular",
            width: SETTINGS.ITEM_SIZE,
            height: SETTINGS.ITEM_SIZE
         })
      ]);

      this.rotation = 2 * Math.PI * Math.random();
   } 

   public tick(): void {
      super.tick();
      
      // Update player pickup cooldowns
      for (const playerPickupCooldown of this.playerPickupCooldowns) {
         playerPickupCooldown.secondsRemaining -= 1 / SETTINGS.TPS;
         if (playerPickupCooldown.secondsRemaining <= 0) {
            this.playerPickupCooldowns.delete(playerPickupCooldown);
         }
      }
   }

   // IMPORTANT: Only run once every second
   public ageItem(): void {
      if (++this.age >= DroppedItem.SECONDS_TO_DESPAWN) {
         this.remove();
      }
   }

   public addPlayerPickupCooldown(playerUsername: string, cooldownDuration: number): void {
      const pickupCooldown: PlayerPickupCooldown = {
         username: playerUsername,
         secondsRemaining: cooldownDuration
      };
      this.playerPickupCooldowns.add(pickupCooldown);
   }

   public playerCanPickup(player: Player): boolean {
      // If the player's username exists in the player pickup cooldowns, then the player can't pickup the item.
      for (const playerPickupCooldown of this.playerPickupCooldowns) {
         if (playerPickupCooldown.username === player.displayName) return false;
      }
      return true;
   }
}

export default DroppedItem;