import { circleAndRectangleDoIntersect, rectanglePointsDoIntersect, SETTINGS } from "webgl-test-shared";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Item from "../items/Item";
import ItemEntity from "../items/ItemEntity";
import { SERVER } from "../server";
import Component from "./Component";

type Inventory = { [itemSlot: number]: Item | null };

class InventoryComponent extends Component {
   private readonly inventorySize: number;
   /** Inventory. Index begins at 1 */
   private readonly inventory: Inventory = this.createInventory();

   constructor(inventorySize: number) {
      super();

      this.inventorySize = inventorySize;
   }

   private createInventory(): Inventory {
      const inventory: Inventory = {};
      for (let i = 1; i <= this.inventorySize; i++) {
         inventory[i] = null;
      }
      return inventory;
   }

   public tick(): void {
      const nearbyItemEntities = this.getNearbyItemEntities();
      const collidingItemEntities = this.getCollidingItemEntities(nearbyItemEntities);

      // Attempt to pick up all colliding item entities
      for (const itemEntity of collidingItemEntities) {
         this.pickupItemEntity(itemEntity);
      }
   }

   private getNearbyItemEntities(): Set<ItemEntity> {
      // Calculate chunk bounds
      const bounds = this.entity.hitbox.bounds;
      const minChunkX = Math.max(Math.min(Math.floor(bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor(bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor(bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor(bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const nearbyItemEntities = new Set<ItemEntity>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            for (const itemEntity of chunk.getItemEntities()) {
               if (!nearbyItemEntities.has(itemEntity)) {
                  nearbyItemEntities.add(itemEntity);
               }
            }
         }
      }

      return nearbyItemEntities;
   }

   private getCollidingItemEntities(nearbyItemEntities: Set<ItemEntity>): Set<ItemEntity> {
      const collidingItemEntities = new Set<ItemEntity>();

      for (const itemEntity of nearbyItemEntities) {
         if (this.entity.hitbox.isColliding(itemEntity.hitbox)) {
            collidingItemEntities.add(itemEntity);
         }
      }

      return collidingItemEntities;
   }

   /**
    * Attempts to pick up an item and add it to the inventory
    * @param itemEntity The item entit to attempt to pick up
    * @returns Whether the item was picked up or not
    */
   private pickupItemEntity(itemEntity: ItemEntity): void {
      const availableSlot = this.findFirstAvailableSlot();
      if (availableSlot === null) return;

      this.addItemToSlot(itemEntity.item, availableSlot);

      this.entity.callEvents("item_pickup", itemEntity);
      
      itemEntity.destroy();
   }

   private findFirstAvailableSlot(): number | null {
      for (let i = 1; i <= this.inventorySize; i++) {
         if (this.inventory[i] !== null) return i;
      }

      return null;
   }

   /** Adds an item to a slot. Overrides any item previously there */
   private addItemToSlot(item: Item, slotNum: number): void {
      this.inventory[slotNum] = item;
   }
}

export default InventoryComponent;