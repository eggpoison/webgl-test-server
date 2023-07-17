import { ENTITY_INFO_RECORD, Mutable, Point, ItemEntityData, SETTINGS, ServerTileUpdateData, Vector, randInt, EntityData } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Mob from "./entities/mobs/Mob";
import Player from "./entities/Player";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import ItemEntity from "./items/ItemEntity";
import generateTerrain from "./terrain-generation";
import Tile from "./tiles/Tile";
import { removeEntityFromCensus } from "./entity-spawning";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

class Board {
   /** Average number of random ticks done in a chunk a second */
   private static readonly RANDOM_TICK_RATE = 1;

   /** Stores entities indexed by the IDs */
   public readonly entities: { [id: number]: Entity } = {};
   
   private readonly tiles: Array<Array<Tile>>;
   private readonly chunks: Array<Array<Chunk>>;

   private tileUpdateCoordinates: Set<[x: number, y: number]>;

   /** Array of all entities' IDs to be removed at the beginning of the next tick */
   private removedEntities = new Set<number>();
   /** All entities to join the board */
   private entityJoinBuffer = new Set<Entity>();

   constructor() {
      this.tiles = generateTerrain();
      console.log("Terrain generated successfully");

      this.tileUpdateCoordinates = new Set<[number, number]>();

      this.chunks = this.initialiseChunks();
   }

   private initialiseChunks(): Array<Array<Chunk>> {
      const chunks = new Array<Array<Chunk>>(SETTINGS.BOARD_SIZE);

      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         chunks[x] = new Array<Chunk>(SETTINGS.BOARD_SIZE);
         for (let y = 0; y < SETTINGS.BOARD_SIZE; y++) {
            chunks[x][y] = new Chunk(x, y);
         }
      }

      return chunks;
   }

   public getTile(x: number, y: number): Tile {
      return this.tiles[x][y];
   }

   public setTile(x: number, y: number, tile: Tile): void {
      this.tiles[x][y] = tile;
   }

   public getChunk(x: number, y: number): Chunk {
      return this.chunks[x][y];
   }

   /** Returns a reference to the tiles array */
   public getTiles(): Array<Array<Tile>> {
      return this.tiles;
   }

   /** Removes entities flagged for deletion */
   public removeEntities(): void {
      for (const id of this.removedEntities) {
         const entity = this.entities[id];
         this.removeEntity(entity);
      }

      this.removedEntities.clear();
   }

   public updateEntities(): void {
      const entityChunkGroups: { [key: string]: Set<Entity> } = {};

      for (const entity of Object.values(this.entities)) {
         entity.applyPhysics();

         // Calculate the entity's new info
         for (const hitbox of entity.hitboxes) {
            if (hitbox.info.type === "rectangular") {
               (hitbox as RectangularHitbox).computeVertexPositions();
               (hitbox as RectangularHitbox).calculateSideAxes();
            }
            hitbox.updateHitboxBounds();
         }
         entity.updateContainingChunks();

         // Tick entity
         entity.tick();

         // If the entity was removed during the tick, add it to the list of removed entities
         if (entity.isRemoved) {
            this.removedEntities.add(entity.id);
         }

         entity.savePreviousCollidingEntities();
         entity.clearCollidingEntities();

         this.setEntityPotentialCollidingEntities(entityChunkGroups, entity);
      }
   }

   private setEntityPotentialCollidingEntities(entityChunkGroups: { [key: string]: Set<Entity> }, entity: Entity): void {
      // Generate the chunk group hash
      let chunkGroupHash = "";
      for (const chunk of entity.chunks) {
         chunkGroupHash += chunk.x + "-" + chunk.y + "-";
      }

      // Set the entity's potential colliding entities based on the chunk group hash
      if (!entityChunkGroups.hasOwnProperty(chunkGroupHash)) {
         // If a chunk group doesn't exist for the hash, create it
         const chunkGroup = new Set<Entity>();
         for (const chunk of entity.chunks) {
            for (const entity of chunk.getEntities()) {
               if (!chunkGroup.has(entity)) {
                  chunkGroup.add(entity);
               }
            }
         }
         entityChunkGroups[chunkGroupHash] = chunkGroup;
      }
      entity.potentialCollidingEntities = new Set(entityChunkGroups[chunkGroupHash]);
   }

   public resolveCollisions(): void {
      for (const entity of Object.values(this.entities)) {
         entity.updateCollidingEntities();
         entity.resolveEntityCollisions();
         entity.resolveWallCollisions();

         entity.updateCurrentTile();
      }
   }

   /** Removes the entity from the game */
   private removeEntity(entity: Entity): void {
      delete this.entities[entity.id];

      // Remove the entity from its chunks
      for (const chunk of entity.chunks) {
         chunk.removeEntity(entity);
      }

      removeEntityFromCensus(entity.type);
   }

   /** Registers a tile update to be sent to the clients */
   public registerNewTileUpdate(x: number, y: number): void {
      this.tileUpdateCoordinates.add([x, y]);
   }

   /** Get all tile updates and reset them */
   public popTileUpdates(): ReadonlyArray<ServerTileUpdateData> {
      // Generate the tile updates array
      const tileUpdates = new Array<ServerTileUpdateData>();
      for (const [x, y] of this.tileUpdateCoordinates) {
         const tile = this.getTile(x, y);
         tileUpdates.push({
            x: x,
            y: y,
            type: tile.type,
            isWall: tile.isWall
         });
      }

      // reset the tile update coordiantes
      this.tileUpdateCoordinates.clear();

      return tileUpdates;
   }

   public runRandomTickAttempt(): void {
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            if (Math.random() * SETTINGS.TPS < Board.RANDOM_TICK_RATE) {
               const tileX = chunkX * SETTINGS.CHUNK_SIZE + randInt(0, SETTINGS.CHUNK_SIZE - 1);
               const tileY = chunkY * SETTINGS.CHUNK_SIZE + randInt(0, SETTINGS.CHUNK_SIZE - 1);

               const tile = this.getTile(tileX, tileY);
               if (typeof tile.onRandomTick !== "undefined") tile.onRandomTick();
            }
         }
      }
   }

   public addEntityToJoinBuffer(entity: Entity): void {
      this.entityJoinBuffer.add(entity);
   }

   /** Creates all of the entities in the join buffer and adds them to the board */
   public addEntitiesFromJoinBuffer(): void {
      for (const entity of this.entityJoinBuffer) {
         // Add entity to the ID record
         this.entities[entity.id] = entity;
      }

      this.entityJoinBuffer.clear();
   }

   public addEntityFromJoinBuffer(entity: Entity): void {
      if (!this.entityJoinBuffer.has(entity)) {
         throw new Error("Tried to add an entity from the join buffer which wasn't there!");
      }

      this.entityJoinBuffer.delete(entity);
      this.entities[entity.id] = entity;
   }

   public tickItems(): void {
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const itemEntity of chunk.getItemEntities()) {
               itemEntity.tick();
            }
         }
      }
   }

   public ageItems(): void {
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const itemEntity of chunk.getItemEntities()) {
               itemEntity.ageItem();
            }
         }  
      }
   }

   private bundleEntityData(entity: Entity): EntityData {
      const healthComponent = entity.getComponent("health")!;
      
      const entityData: Mutable<EntityData> = {
         id: entity.id,
         type: entity.type,
         position: entity.position.package(),
         velocity: entity.velocity !== null ? entity.velocity.package() : null,
         acceleration: entity.acceleration !== null ? entity.acceleration.package() : null,
         terminalVelocity: entity.terminalVelocity,
         rotation: entity.rotation,
         clientArgs: entity.getClientArgs(),
         secondsSinceLastHit: healthComponent !== null ? healthComponent.getSecondsSinceLastHit() : null,
         chunkCoordinates: Array.from(entity.chunks).map(chunk => [chunk.x, chunk.y]),
         hitboxes: Array.from(entity.hitboxes).map(hitbox => {
            return hitbox.info;
         })
      };

      const entityInfo = ENTITY_INFO_RECORD[entity.type];
      if (entityInfo.category === "mob") {
         entityData.special = {
            mobAIType: (entity as Mob).getCurrentAIType() || "none"
         };
      }

      return entityData;
   }

   public bundleEntityDataArray(player: Player): ReadonlyArray<EntityData> {
      const entityDataArray = new Array<EntityData>();

      for (const entity of Object.values(this.entities)) {
         if (entity !== player) {
            const data = this.bundleEntityData(entity);
            entityDataArray.push(data);
         }
      }

      return entityDataArray;
   }

   private bundleItemEntityData(itemEntity: ItemEntity): ItemEntityData {
      const chunkCoordinates = new Array<[number, number]>();
      for (const chunk of itemEntity.chunks) {
         chunkCoordinates.push([chunk.x, chunk.y]);
      }

      return {
         id: itemEntity.id,
         itemID: itemEntity.item.type,
         count: itemEntity.item.count,
         position: itemEntity.position.package(),
         velocity: itemEntity.velocity !== null ? itemEntity.velocity.package() : null,
         chunkCoordinates: chunkCoordinates,
         rotation: itemEntity.rotation
      };
   }

   public bundleItemEntityDataArray(): ReadonlyArray<ItemEntityData> {
      const itemEntityDataArray = new Array<ItemEntityData>();

      const seenItemEntityIDs = new Array<number>();

      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const itemEntity of chunk.getItemEntities()) {
               if (!seenItemEntityIDs.includes(itemEntity.id)) {
                  const data = this.bundleItemEntityData(itemEntity);
                  itemEntityDataArray.push(data);
                  
                  seenItemEntityIDs.push(itemEntity.id);
               }
            }
         }
      }

      return itemEntityDataArray;
   }
}

export default Board;