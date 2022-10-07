import { computeSideAxis, ENTITY_INFO_RECORD, Mutable, Point, ServerItemEntityData, SETTINGS, ServerTileUpdateData, Vector, VisibleChunkBounds, TileInfo, randInt } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import ItemEntity from "./items/ItemEntity";
import { EntityCensus, SERVER } from "./server";
import generateTerrain from "./terrain-generation/terrain-generation";
import Tile from "./tiles/Tile";
import TILE_CLASS_RECORD from "./tiles/tile-class-record";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

export type AttackInfo = {
   readonly attackingEntity: Entity;
   readonly targetEntity: Entity;
   /** How far into being hit the entity is (0 = just began, 1 = ended) */
   progress: number;
}

class Board {
   /** Average number of random ticks done in a chunk a second */
   private static readonly RANDOM_TICK_RATE = 1;

   /** Stores entities indexed by the IDs */
   public readonly entities: { [id: number]: Entity } = {};
   
   private readonly tiles: Array<Array<Tile>>;
   private readonly chunks: Array<Array<Chunk>>;

   private tileUpdateCoordinates: Array<[x: number, y: number]>;

   public readonly attackInfoRecord: { [id: number]: AttackInfo } = {};

   constructor() {
      this.tiles = generateTerrain();
      console.log("Terrain generated successfully");

      this.tileUpdateCoordinates = new Array<[number, number]>();

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

   public getChunk(x: number, y: number): Chunk {
      return this.chunks[x][y];
   }

   /** Returns a reference to the tiles array */
   public getTiles(): Array<Array<Tile>> {
      return this.tiles;
   }

   public addNewAttack(attackInfo: AttackInfo): void {
      this.attackInfoRecord[attackInfo.targetEntity.id] = attackInfo;
   }

   public removeAttack(target: Entity): void {
      delete this.attackInfoRecord[target.id];
   }

   public getAttackInfoArray(): ReadonlyArray<AttackInfo> {
      return Object.values(this.attackInfoRecord);
   }

   public tickEntities(): EntityCensus {
      // Remove entities flagged for deletion
      for (const entity of Object.values(this.entities)) {
         if (entity.isRemoved) {
            this.removeEntity(entity);
         }
      }

      const census: Mutable<EntityCensus> = {
         passiveMobCount: 0
      };

      const entityHitboxInfoRecord: Record<number, EntityHitboxInfo> = {};

      for (const entity of Object.values(this.entities)) {
         entity.applyPhysics();

         // Update entity
         if (typeof entity.update !== "undefined") entity.update();
         entity.updateComponents();

         // Calculate the entity's new info
         const hitboxVertexPositons = entity.calculateHitboxVertexPositions();
         const hitboxBounds = entity.calculateHitboxBounds(hitboxVertexPositons !== null ? hitboxVertexPositons : undefined);
         const newChunks = entity.calculateContainingChunks(hitboxBounds);

         // Update the entities' containing chunks
         entity.updateChunks(newChunks);

         if (hitboxVertexPositons !== null) {
            const sideAxes = [
               computeSideAxis(hitboxVertexPositons[0], hitboxVertexPositons[1]),
               computeSideAxis(hitboxVertexPositons[0], hitboxVertexPositons[2])
            ];

            entityHitboxInfoRecord[entity.id] = {
               vertexPositions: hitboxVertexPositons,
               sideAxes: sideAxes
            };
         }

         // Add the entity to the census
         const entityInfo = ENTITY_INFO_RECORD[entity.type];
         if (entityInfo.category === "mob" && entityInfo.behaviour === "passive") census.passiveMobCount++;
      }

      // Handle entity collisions
      for (const entity of Object.values(this.entities)) {
         entity.resolveCollisions(entityHitboxInfoRecord);

         // Resolve wall collisions
         const hitboxVertexPositons = entity.calculateHitboxVertexPositions();
         const hitboxBounds = entity.calculateHitboxBounds(hitboxVertexPositons !== null ? hitboxVertexPositons : undefined);
         entity.resolveWallCollisions(hitboxBounds);
      }

      return census as EntityCensus;
   }

   public loadEntity(entity: Entity): void {
      if (typeof entity.onLoad !== "undefined") entity.onLoad();
      entity.loadComponents();
   }

   /** Removes the entity from the game */
   private removeEntity(entity: Entity): void {
      delete this.entities[entity.id];

      // Remove the entity from its chunks
      for (const chunk of entity.chunks) {
         chunk.removeEntity(entity);
      }
   }

   public changeTile(x: number, y: number, newTileInfo: TileInfo): void {
      const tileClass = TILE_CLASS_RECORD[newTileInfo.type];
      this.tiles[x][y] = new tileClass(x, y, newTileInfo);
      this.registerNewTileUpdate(x, y);
   }

   /** Registers a tile update to be sent to the clients */
   private registerNewTileUpdate(x: number, y: number): void {
      this.tileUpdateCoordinates.push([x, y]);
   }

   /** Get all tile updates and reset them */
   public popTileUpdates(): ReadonlyArray<ServerTileUpdateData> {
      // Generate the tile updates array
      const tileUpdates: ReadonlyArray<ServerTileUpdateData> = this.tileUpdateCoordinates.map(([x, y]) => {
         const tile = this.getTile(x, y);
         return {
            x: x,
            y: y,
            type: tile.type,
            isWall: tile.isWall
         };
      });

      // reset the tile update coordiantes
      this.tileUpdateCoordinates = new Array<[number, number]>();

      return tileUpdates;
   }

   public getPlayerNearbyEntities(player: Player, visibleChunkBounds: VisibleChunkBounds): Array<Entity> {
      // Find the chunks nearby to the player and all entities inside them
      let nearbyEntities = new Array<Entity>();
      for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
         for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            // Add all entities which aren't already in the array
            for (const entity of chunk.getEntities()) {
               if (!nearbyEntities.includes(entity)) {
                  nearbyEntities.push(entity);
               }
            }
         }
      }

      // Remove the player
      nearbyEntities.splice(nearbyEntities.indexOf(player), 1);

      return nearbyEntities;
   }

   public calculatePlayerItemInfoArray(visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<ServerItemEntityData> {
      // Find the chunks nearby to the player and all items inside them
      let nearbyItemEntities = new Array<ItemEntity>();
      for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
         for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            // Add all entities which aren't already in the array
            for (const item of chunk.getItems()) {
               if (!nearbyItemEntities.includes(item)) {
                  nearbyItemEntities.push(item);
               }
            }
         }
      }

      const serverItemDataArray: ReadonlyArray<ServerItemEntityData> = nearbyItemEntities.map(itemEntity => {
         return {
            id: itemEntity.id,
            itemID: itemEntity.item.itemID,
            count: itemEntity.item.count,
            position: itemEntity.position.package(),
            chunkCoordinates: itemEntity.chunks.map(chunk => [chunk.x, chunk.y]),
            rotation: itemEntity.rotation
         };
      });

      return serverItemDataArray;
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
}

export default Board;