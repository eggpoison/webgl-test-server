import { Point, SETTINGS, ServerTileUpdateData, Vector, randInt } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import generateTerrain from "./terrain-generation";
import Tile from "./tiles/Tile";
import { GameObject } from "./GameObject";
import { removeEntityFromCensus } from "./entity-spawning";
import Projectile from "./Projectile";
import { SERVER } from "./server";
import CircularHitbox from "./hitboxes/CircularHitbox";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

class Board {
   /** Average number of random ticks done in a chunk a second */
   private static readonly RANDOM_TICK_RATE = 1;

   private readonly gameObjects = new Set<GameObject>();

   public readonly entities: { [id: number]: Entity } = {};
   public readonly droppedItems: { [id: number]: DroppedItem } = {};
   public readonly projectiles = new Set<Projectile>();
   
   private readonly tiles: Array<Array<Tile>>;
   private readonly chunks: Array<Array<Chunk>>;

   private tileUpdateCoordinates: Set<[x: number, y: number]>;

   private gameObjectsToRemove = new Array<GameObject>();

   private joinBuffer = new Array<GameObject>();

   constructor() {
      this.tiles = generateTerrain();

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

   public getEntityByID(id: number): Entity {
      return this.entities[id];
   }

   public worldToTileX(x: number): number {
      return Math.floor(x / SETTINGS.TILE_SIZE);
   }

   public worldToTileY(y: number): number {
      return Math.floor(y / SETTINGS.TILE_SIZE);
   }

   public getTile(tileX: number, tileY: number): Tile {
      if (tileX < 0 || tileX >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Tile x '${tileX}' is not a valid tile coordinate.`);
      if (tileY < 0 || tileY >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Tile y '${tileY}' is not a valid tile coordinate.`);

      return this.tiles[tileX][tileY];
   }

   public setTile(tileX: number, tileY: number, tile: Tile): void {
      this.tiles[tileX][tileY] = tile;
   }

   public getChunk(x: number, y: number): Chunk {
      return this.chunks[x][y];
   }

   /** Returns a reference to the tiles array */
   public getTiles(): Array<Array<Tile>> {
      return this.tiles;
   }

   /** Removes game objects flagged for deletion */
   public removeFlaggedGameObjects(): void {
      for (const gameObject of this.gameObjectsToRemove) {
         this.removeGameObject(gameObject);
      }

      this.gameObjectsToRemove = new Array<GameObject>();
   }

   private removeGameObject(gameObject: GameObject): void {
      if (!this.gameObjects.has(gameObject)) {
         console.warn("Tried to remove a game object which doesn't exist or was already removed.");
         // throw new Error("Tried to remove a game object which doesn't exist or was already removed.");
      }
      
      switch (gameObject.i) {
         case "entity": {
            delete this.entities[gameObject.id];
            removeEntityFromCensus(gameObject);
            break;
         }
         case "droppedItem": {
            delete this.droppedItems[gameObject.id];
            break;
         }
         case "projectile": {
            this.projectiles.delete(gameObject);
            break;
         }
      }

      for (const chunk of gameObject.chunks) {
         chunk.removeGameObject(gameObject);
      }

      this.gameObjects.delete(gameObject);
   }

   public forceRemoveGameObject(gameObject: GameObject): void {
      const idx = this.gameObjectsToRemove.indexOf(gameObject);
      if (idx !== -1) {
         this.gameObjectsToRemove.splice(idx, 1);
      }
      
      this.removeGameObject(gameObject);
   }

   public addGameObjectToRemoveBuffer(gameObject: GameObject): void {
      if (this.gameObjectsToRemove.indexOf(gameObject) === -1) {
         this.gameObjectsToRemove.push(gameObject);
      }
   }

   public updateGameObjects(): void {
      const chunkGroups: { [key: string]: Set<GameObject> } = {};

      for (const gameObject of this.gameObjects) {
         gameObject.tick();

         gameObject.savePreviousCollidingGameObjects();
         gameObject.clearCollidingGameObjects();
         this.setEntityPotentialCollidingEntities(chunkGroups, gameObject);

         for (const hitbox of gameObject.hitboxes) {
            hitbox.updatePosition();
         }
      }
   }

   private setEntityPotentialCollidingEntities(chunkGroups: { [key: string]: Set<GameObject> }, gameObject: GameObject): void {
      // Generate the chunk group hash
      let chunkGroupHash = "";
      for (const chunk of gameObject.chunks) {
         chunkGroupHash += chunk.x + "-" + chunk.y + "-";
      }

      // Set the entity's potential colliding entities based on the chunk group hash
      if (!chunkGroups.hasOwnProperty(chunkGroupHash)) {
         // If a chunk group doesn't exist for the hash, create it
         const chunkGroup = new Set<GameObject>();
         for (const chunk of gameObject.chunks) {
            for (const gameObject of chunk.getGameObjects()) {
               if (!chunkGroup.has(gameObject)) {
                  chunkGroup.add(gameObject);
               }
            }
         }
         chunkGroups[chunkGroupHash] = chunkGroup;
      }
      gameObject.potentialCollidingObjects = new Set(chunkGroups[chunkGroupHash]);
   }

   public resolveCollisions(): void {
      for (const gameObject of this.gameObjects) {
         gameObject.updateCollidingGameObjects();
         gameObject.resolveGameObjectCollisions();
         gameObject.resolveWallCollisions();

         gameObject.updateTile();
      }
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

   public addGameObjectToJoinBuffer(gameObject: GameObject): void {
      this.joinBuffer.push(gameObject);
   }

   public removeGameObjectFromJoinBuffer(gameObject: GameObject): void {
      const idx = this.joinBuffer.indexOf(gameObject);
      if (idx !== -1) {
         this.joinBuffer.splice(idx, 1);
      }
   }

   public pushJoinBuffer(): void {
      for (const gameObject of this.joinBuffer) {
         this.addGameObjectToBoard(gameObject)
      }

      this.joinBuffer = new Array<GameObject>();
   }

   private addGameObjectToBoard(gameObject: GameObject): void {
      gameObject.updateHitboxes();
      gameObject.updateContainingChunks();

      this.gameObjects.add(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities[gameObject.id] = gameObject;
            break;
         }
         case "droppedItem": {
            this.droppedItems[gameObject.id] = gameObject;
            break;
         }
         case "projectile": {
            this.projectiles.add(gameObject);
            break;
         }
      }
   }

   /** Forcefully adds a game object to the board from the join buffer */
   public forcePushGameObjectFromJoinBuffer(gameObject: GameObject): void {
      const idx = this.joinBuffer.indexOf(gameObject);
      if (idx !== -1) {
         this.addGameObjectToBoard(gameObject);
         this.removeGameObjectFromJoinBuffer(gameObject);
      }
   }

   public ageItems(): void {
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const droppedItem of chunk.getDroppedItems()) {
               droppedItem.ageItem();
            }
         }  
      }
   }

   public isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1 && position.y >= 0 && position.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
   }

   public gameObjectIsInBoard(gameObject: GameObject): boolean {
      // Check the join buffer and game objects set
      if (this.gameObjects.has(gameObject) || this.joinBuffer.includes(gameObject)) return true;

      // Check in the entities
      if (gameObject.i === "entity" && Object.values(this.entities).includes(gameObject)) return true;

      // Check in the dropped items
      if (gameObject.i === "droppedItem" && Object.values(this.droppedItems).includes(gameObject)) return true;

      // Check in the projectiles
      if (gameObject.i === "projectile" && this.projectiles.has(gameObject)) return true;

      // Check the chunks
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);

            // Check if it is in the chunk's game objects
            if (chunk.getGameObjects().has(gameObject)) return true;

            // If the game object is an entity, check if it is in the chunk's entities
            if (gameObject.i === "entity" && chunk.getEntities().has(gameObject)) return true;
         }
      }

      return false;
   }

   public distanceToClosestEntity(position: Point): number {
      let minDistance = 2000;

      const minChunkX = Math.max(Math.min(Math.floor((position.x - 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((position.x + 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((position.y - 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((position.y + 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const checkedEntities = new Set<Entity>();
      
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            for (const entity of chunk.getEntities()) {
               if (checkedEntities.has(entity)) continue;
               
               const distance = position.calculateDistanceBetween(entity.position);
               if (distance <= minDistance) {
                  minDistance = distance;
               }

               checkedEntities.add(entity);
            }
         }
      }

      return minDistance;
   }

   public getEntitiesAtPosition(position: Point): Set<Entity> {
      const testHitbox = new CircularHitbox({
         type: "circular",
         radius: 1
      });

      testHitbox.setPosition(position);
      testHitbox.updateHitboxBounds();

      const chunkX = Math.floor(position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);

      const entities = new Set<Entity>();
      
      const chunk = this.getChunk(chunkX, chunkY);
      entityLoop: for (const entity of chunk.getEntities()) {
         for (const hitbox of entity.hitboxes) {
            if (testHitbox.isColliding(hitbox)) {
               entities.add(entity);
               continue entityLoop;
            }
         }
      }

      return entities;
   }
}

export default Board;