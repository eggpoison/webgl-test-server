import { Point, RectangularHitboxInfo, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Chunk from "../Chunk";
import Player from "../entities/Player";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { SERVER } from "../server";
import Tile from "../tiles/Tile";
import Item from "./generic/Item";

let nextAvailableItemID = 0;

const findAvailableItemID = (): number => {
   return nextAvailableItemID++;
}
type PlayerPickupCooldown = {
   readonly username: string;
   secondsRemaining: number;
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
   public velocity: Vector | null = null;

   /** Chunks the item entity is contained in */
   public chunks: Set<Chunk>;

   /** Rotation of the item entity */
   public readonly rotation = 2 * Math.PI * Math.random();

   public readonly hitbox: RectangularHitbox;

   private readonly playerPickupCooldowns = new Set<PlayerPickupCooldown>();

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
         chunk.addItemEntity(this);
      }
   } 

   public tick(): void {
      // Add velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude *= 1 / SETTINGS.TPS;

         this.position.add(velocity.convertToPoint());

         const tile = this.calculateContainingTile();
         const tileTypeInfo = TILE_TYPE_INFO_RECORD[tile.type];

         // Apply friction
         this.velocity.magnitude -= SETTINGS.FRICTION_CONSTANT * tileTypeInfo.friction / SETTINGS.TPS;
         if (this.velocity.magnitude <= 0) {
            this.velocity = null;
         }

         const newChunks = this.calculateContainingChunks();

         const knownChunks = new Set(this.chunks);

         for (const chunk of newChunks) {
            if (!knownChunks.has(chunk)) {
               this.chunks.add(chunk);
               chunk.addItemEntity(this);
            } else {
               knownChunks.delete(chunk);
            }
         }

         for (const chunk of knownChunks) {
            this.chunks.delete(chunk);
            chunk.removeItemEntity(this);
         }
      }
      
      // Update player pickup cooldowns
      for (const playerPickupCooldown of this.playerPickupCooldowns) {
         playerPickupCooldown.secondsRemaining -= 1 / SETTINGS.TPS;
         if (playerPickupCooldown.secondsRemaining <= 0) {
            this.playerPickupCooldowns.delete(playerPickupCooldown);
         }
      }
   }

   private calculateContainingTile(): Tile {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);
      return SERVER.board.getTile(tileX, tileY);
   }

   // IMPORTANT: Only run once every second
   public ageItem(): void {
      if (++this.age >= ItemEntity.SECONDS_TO_DESPAWN) {
         this.destroy();
      }
   }

   public addPlayerPickupCooldown(playerUsername: string, cooldownDuration: number): void {
      const pickupCooldown: PlayerPickupCooldown = {
         username: playerUsername,
         secondsRemaining: cooldownDuration
      };
      this.playerPickupCooldowns.add(pickupCooldown);
   }

   private calculateContainingChunks(): Set<Chunk> {
      const minChunkX = Math.max(Math.min(Math.floor((this.position.x - SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((this.position.x + SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((this.position.y - SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((this.position.y + SETTINGS.ITEM_SIZE / 2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const chunks = new Set<Chunk>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            chunks.add(chunk);
         }
      }

      return chunks;
   }

   public addVelocity(magnitude: number, direction: number): void {
      const addVector = new Vector(magnitude, direction);
      if (this.velocity !== null) {
         this.velocity.add(addVector);
      } else {
         this.velocity = addVector;
      }
   }

   public destroy(): void {
      for (const chunk of this.chunks) {
         chunk.removeItemEntity(this);
      }
   }

   public playerCanPickup(player: Player): boolean {
      // If the player's username exists in the player pickup cooldowns, then the player can't pickup the item.
      for (const playerPickupCooldown of this.playerPickupCooldowns) {
         if (playerPickupCooldown.username === player.displayName) return false;
      }
      return true;
   }
}

export default ItemEntity;