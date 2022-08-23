import { SETTINGS, Tile, VisibleChunkBounds } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Player from "./entities/Player";
import { EntityCensus, SERVER } from "./server";
import generateTerrain from "./terrain-generation";

class Board {
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

   public tickEntities(entityData: EntityCensus): void {
      const entityChunkChanges = new Array<[entity: Entity, previousChunk: Chunk, newChunk: Chunk]>();

      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         for (let y = 0; y < SETTINGS.BOARD_SIZE; y++) {
            const chunk = this.chunks[x][y];

            if (typeof chunk === "undefined") console.log(x, y);
            const entities = chunk.getEntities().slice();
            for (const entity of entities) {
               entity.tick();

               // Find the entity's current chunk
               const newChunk = entity.findContainingChunk();

               // Handle removed entities
               if (entity.isRemoved) {
                  entityData.removedEntities.push(entity.id);

                  this.removeEntity(entity, newChunk);
               }

               // If the entity has changed chunks, add it to the list
               if (newChunk !== entity.previousChunk) {
                  entityChunkChanges.push([entity, entity.previousChunk, newChunk]);
               }
            }
         }
      }

      // Apply entity chunk changes
      for (const [entity, previousChunk, newChunk] of entityChunkChanges) {
         previousChunk.removeEntity(entity);
         newChunk.addEntity(entity);

         entity.previousChunk = newChunk;
      }
   }

   public addEntity(entity: Entity): void {
      const chunk = entity.findContainingChunk();
      chunk.addEntity(entity);

      entity.previousChunk = chunk;
   }

   private removeEntity(entity: Entity, chunk: Chunk): void {
      chunk.removeEntity(entity);
   }

   public getPlayerNearbyEntities(player: Player, visibleChunkBounds: VisibleChunkBounds): Array<Entity> {
      const playerChunk = player.previousChunk;

      // Find the chunks nearby to the player and all entities inside them
      let nearbyEntities = new Array<Entity>();
      for (let chunkX = visibleChunkBounds[0]; chunkX <= visibleChunkBounds[1]; chunkX++) {
         for (let chunkY = visibleChunkBounds[2]; chunkY <= visibleChunkBounds[3]; chunkY++) {
            const chunk = SERVER.board.chunks[chunkX][chunkY];

            // Remove the player from the list
            const chunkEntities = chunk.getEntities().slice();

            if (chunk === playerChunk) {
               chunkEntities.splice(chunkEntities.indexOf(player), 1);
            }

            nearbyEntities = nearbyEntities.concat(chunkEntities);
         }
      }

      return nearbyEntities;
   }
}

export default Board;