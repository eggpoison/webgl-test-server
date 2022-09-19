import { computeSideAxis, ENTITY_INFO_RECORD, Mutable, Point, SETTINGS, Tile, Vector, VisibleChunkBounds } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import { EntityCensus, SERVER } from "./server";
import generateTerrain from "./terrain-generation/terrain-generation";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

class Board {
   /** Stores entities indexed by the IDs */
   public readonly entities: { [id: number]: Entity } = {};
   
   public readonly tiles: Array<Array<Tile>>;
   public readonly chunks: Array<Array<Chunk>>;

   constructor() {
      this.tiles = generateTerrain();
      console.log("Terrain generated");

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

   public getChunk(x: number, y: number): Chunk {
      return this.chunks[x][y];
   }

   public update(): EntityCensus {
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
   public removeEntity(entity: Entity): void {
      delete this.entities[entity.id];

      // Remove the entity from its chunks
      for (const chunk of entity.chunks) {
         chunk.removeEntity(entity);
      }
   }

   public getPlayerNearbyEntities(player: Player, visibleChunkBounds: VisibleChunkBounds): Array<Entity> {
      // Find the chunks nearby to the player and all entities inside them
      let nearbyEntities = new Array<Entity>();
      for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
         for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);

            const entities = chunk.getEntities().slice();

            // Add all entities which aren't already in the array
            for (const entity of entities) {
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
}

export default Board;