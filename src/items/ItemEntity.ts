import { Point, RectangularHitboxInfo, SETTINGS } from "webgl-test-shared";
import Chunk from "../Chunk";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { SERVER } from "../server";
import Item from "./generic/Item";

let nextAvailableItemID = 0;

const findAvailableItemID = (): number => {
   return nextAvailableItemID++;
}

class ItemEntity {
   /** ROUGHLY how long an item will take to despawn */
   private static readonly SECONDS_TO_DESPAWN = 300;
   
   /** Unique identifier for the item entity */
   public readonly id: number;

   /** How long the item has existed in seconds */
   private age: number = 0;

   public readonly item: Item;

   public readonly position: Point;
   /** Chunks the item entity is contained in */
   public readonly chunks: ReadonlyArray<Chunk>;

   /** Rotation of the item entity */
   public readonly rotation = 2 * Math.PI * Math.random();

   public readonly hitbox: RectangularHitbox;

   constructor(position: Point, item: Item) {
      this.id = findAvailableItemID();

      this.position = position;
      this.item = item;

      // Create the hitbox
      const hitboxInfo: RectangularHitboxInfo = {
         type: "rectangular",
         width: SETTINGS.ITEM_SIZE,
         height: SETTINGS.ITEM_SIZE
      }
      this.hitbox = new RectangularHitbox(hitboxInfo);
      this.hitbox.setHitboxObject(this);

      // Add to containing chunks
      this.chunks = this.calculateContainingChunks();
      for (const chunk of this.chunks) {
         chunk.addItem(this);
      }
   }

   // Only run once every second
   public ageItem(): void {
      if (++this.age >= ItemEntity.SECONDS_TO_DESPAWN) {
         this.destroy();
      }
   }

   private calculateContainingChunks(): ReadonlyArray<Chunk> {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const chunks = new Array<Chunk>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            chunks.push(chunk);
         }
      }

      return chunks;
   }

   public destroy(): void {
      for (const chunk of this.chunks) {
         chunk.removeItem(this);
      }
   }
}

export default ItemEntity;