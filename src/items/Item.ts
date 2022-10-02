import { BaseItemInfo, ItemID, ITEM_INFO_RECORD, Point, SETTINGS } from "webgl-test-shared";
import Chunk from "../Chunk";
import { SERVER } from "../server";

let nextAvailableItemID = 0;

const findAvailableItemID = (): number => {
   return nextAvailableItemID++;
}

class Item implements BaseItemInfo {
   /** Unique identifier for the item */
   public readonly id: number;

   public readonly position: Point;
   /** Containing chunks */
   public readonly chunks: ReadonlyArray<Chunk>;
   public count: number;

   /** Rotation of the item (only used in client-side rendering) */
   public readonly rotation = 2 * Math.PI * Math.random();

   public readonly itemID: ItemID;
   public readonly name: string;

   constructor(position: Point, itemID: ItemID, count: number) {
      this.id = findAvailableItemID();

      this.position = position;
      this.count = count;
      this.itemID = itemID;

      const itemInfo = ITEM_INFO_RECORD[itemID];
      this.name = itemInfo.name;

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

   public remove(): void {
      for (const chunk of this.chunks) {
         chunk.removeItem(this);
      }
   }
}

export default Item;