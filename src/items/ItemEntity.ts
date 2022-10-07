import { Point, SETTINGS } from "webgl-test-shared";
import Chunk from "../Chunk";
import { SERVER } from "../server";
import Item from "./Item";

let nextAvailableItemID = 0;

const findAvailableItemID = (): number => {
   return nextAvailableItemID++;
}

class ItemEntity {
   /** Unique identifier for the item entity */
   public readonly id: number;

   public readonly item: Item;

   public readonly position: Point;
   /** Chunks the item entity is contained in */
   public readonly chunks: ReadonlyArray<Chunk>;

   /** Rotation of the item entity (only used in client-side rendering) */
   public readonly rotation = 2 * Math.PI * Math.random();

   constructor(position: Point, item: Item) {
      this.id = findAvailableItemID();

      this.position = position;
      this.item = item;

      // Add to containing chunks
      this.chunks = this.calculateContainingChunks();
      for (const chunk of this.chunks) {
         chunk.addItem(this);
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