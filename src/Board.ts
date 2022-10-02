import { computeSideAxis, ENTITY_INFO_RECORD, Mutable, Point, ServerItemData, SETTINGS, Tile, TileUpdateData, Vector, VisibleChunkBounds } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import Item from "./items/Item";
import { EntityCensus, SERVER } from "./server";
import generateTerrain from "./terrain-generation/terrain-generation";

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
   /** Stores entities indexed by the IDs */
   public readonly entities: { [id: number]: Entity } = {};
   
   private readonly tiles: Array<Array<Tile>>;
   private readonly chunks: Array<Array<Chunk>>;

   private tileUpdateCoordinates: Array<[x: number, y: number]>;

   public readonly attackInfoRecord: { [id: number]: AttackInfo } = {};

   constructor() {
      this.tiles = generateTerrain();
      console.log("Terrain generated");

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

   public update(): EntityCensus {
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

         // Tick entity
         if (typeof entity.tick !== "undefined") entity.tick();
         entity.tickComponents();

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

   /** Registers a tile update to be sent to the clients */
   public updateTile(x: number, y: number): void {
      this.tileUpdateCoordinates.push([x, y]);
   }

   /** Get all tile updates and reset them */
   public getTileUpdates(): ReadonlyArray<TileUpdateData> {
      // Generate the tile updates array
      const tileUpdates: ReadonlyArray<TileUpdateData> = this.tileUpdateCoordinates.map(([x, y]) => {
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

   public calculatePlayerItemInfoArray(player: Player, visibleChunkBounds: VisibleChunkBounds): ReadonlyArray<ServerItemData> {
      // Find the chunks nearby to the player and all items inside them
      let nearbyItems = new Array<Item>();
      for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
         for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            // Add all entities which aren't already in the array
            for (const item of chunk.getItems()) {
               if (!nearbyItems.includes(item)) {
                  nearbyItems.push(item);
               }
            }
         }
      }

      const serverItemDataArray: ReadonlyArray<ServerItemData> = nearbyItems.map(item => {
         return {
            id: item.id,
            itemID: item.itemID,
            count: item.count,
            position: item.position.package(),
            chunkCoordinates: item.chunks.map(chunk => [chunk.x, chunk.y]),
            rotation: item.rotation
         };
      });

      return serverItemDataArray;
   }
}

export default Board;