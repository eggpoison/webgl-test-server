import { Point, SETTINGS, ServerTileUpdateData, Vector, randInt } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import generateTerrain from "./terrain-generation";
import Tile from "./tiles/Tile";
import { GameObject } from "./GameObject";
import Projectile from "./Projectile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import { removeEntityFromCensus } from "./census";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

abstract class Board {
   /** Average number of random ticks done in a chunk a second */
   private static readonly RANDOM_TICK_RATE = 1;

   private static readonly gameObjects = new Set<GameObject>();

   public static readonly entities: { [id: number]: Entity } = {};
   public static readonly droppedItems: { [id: number]: DroppedItem } = {};
   public static readonly projectiles = new Set<Projectile>();
   
   private static tiles: Array<Array<Tile>>;
   private static chunks: Array<Array<Chunk>>;

   private static tileUpdateCoordinates: Set<[x: number, y: number]>;

   private static gameObjectsToRemove = new Array<GameObject>();

   private static joinBuffer = new Array<GameObject>();

   public static setup(): void {
      this.tiles = generateTerrain();

      this.tileUpdateCoordinates = new Set<[number, number]>();

      this.chunks = this.initialiseChunks();
   }

   // constructor() {
   //    this.tiles = generateTerrain();

   //    this.tileUpdateCoordinates = new Set<[number, number]>();

   //    this.chunks = this.initialiseChunks();
   // }

   private static initialiseChunks(): Array<Array<Chunk>> {
      const chunks = new Array<Array<Chunk>>(SETTINGS.BOARD_SIZE);

      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         chunks[x] = new Array<Chunk>(SETTINGS.BOARD_SIZE);
         for (let y = 0; y < SETTINGS.BOARD_SIZE; y++) {
            chunks[x][y] = new Chunk(x, y);
         }
      }

      return chunks;
   }

   public static getEntityByID(id: number): Entity {
      return this.entities[id];
   }

   public static worldToTileX(x: number): number {
      return Math.floor(x / SETTINGS.TILE_SIZE);
   }

   public static worldToTileY(y: number): number {
      return Math.floor(y / SETTINGS.TILE_SIZE);
   }

   public static getTile(tileX: number, tileY: number): Tile {
      if (tileX < 0 || tileX >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Tile x '${tileX}' is not a valid tile coordinate.`);
      if (tileY < 0 || tileY >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Tile y '${tileY}' is not a valid tile coordinate.`);

      return this.tiles[tileX][tileY];
   }

   public static setTile(tileX: number, tileY: number, tile: Tile): void {
      this.tiles[tileX][tileY] = tile;
   }

   public static getChunk(x: number, y: number): Chunk {
      return this.chunks[x][y];
   }

   /** Returns a reference to the tiles array */
   public static getTiles(): Array<Array<Tile>> {
      return this.tiles;
   }

   /** Removes game objects flagged for deletion */
   public static removeFlaggedGameObjects(): void {
      for (const gameObject of this.gameObjectsToRemove) {
         this.removeGameObject(gameObject);
      }

      this.gameObjectsToRemove = new Array<GameObject>();
   }

   private static removeGameObject(gameObject: GameObject): void {
      if (!this.gameObjects.has(gameObject)) {
         throw new Error("Tried to remove a game object which doesn't exist or was already removed.");
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

   public static forceRemoveGameObject(gameObject: GameObject): void {
      const idx = this.gameObjectsToRemove.indexOf(gameObject);
      if (idx !== -1) {
         this.gameObjectsToRemove.splice(idx, 1);
      }

      this.removeGameObject(gameObject);
   }

   public static addGameObjectToRemoveBuffer(gameObject: GameObject): void {
      if (this.gameObjectsToRemove.indexOf(gameObject) === -1) {
         this.gameObjectsToRemove.push(gameObject);
      }
   }

   private static a: Record<number, Array<GameObject>> = {};

   public static updateGameObjects(): void {
      this.a = {};

      for (const gameObject of this.gameObjects) {
         gameObject.tick();

         gameObject.calculateBoundingVolume();

         for (const chunk of gameObject.boundingChunks) {
            const n = chunk.y * SETTINGS.BOARD_SIZE + chunk.x;
            if (!this.a.hasOwnProperty(n)) {
               this.a[n] = new Array<GameObject>();
            }
            this.a[n].push(gameObject);
         }
      }
   }

   public static resolveCollisions(): void {
      for (const gameObject of this.gameObjects) {
         gameObject.resolveWallCollisions();
         gameObject.updateTile();

         gameObject.previousCollidingObjects = gameObject.collidingObjects;
         gameObject.collidingObjects = new Set();
      }

      for (const gameObjectsInChunk of Object.values(this.a)) {
         for (let i = 0; i <= gameObjectsInChunk.length - 2; i++) {
            const gameObject1 = gameObjectsInChunk[i];
            for (let j = i + 1; j <= gameObjectsInChunk.length - 1; j++) {
               const gameObject2 = gameObjectsInChunk[j];

               if (!gameObject1.collidingObjects.has(gameObject2) && gameObject1.isColliding(gameObject2)) {
                  gameObject1.collide(gameObject2);
                  gameObject2.collide(gameObject1);

                  gameObject1.collidingObjects.add(gameObject2);
                  gameObject2.collidingObjects.add(gameObject1);
               }
            }
         }
      }
   }

   /** Registers a tile update to be sent to the clients */
   public static registerNewTileUpdate(x: number, y: number): void {
      this.tileUpdateCoordinates.add([x, y]);
   }

   /** Get all tile updates and reset them */
   public static popTileUpdates(): ReadonlyArray<ServerTileUpdateData> {
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

   public static runRandomTickAttempt(): void {
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

   public static addGameObjectToJoinBuffer(gameObject: GameObject): void {
      this.joinBuffer.push(gameObject);
   }

   public static removeGameObjectFromJoinBuffer(gameObject: GameObject): void {
      const idx = this.joinBuffer.indexOf(gameObject);
      if (idx !== -1) {
         this.joinBuffer.splice(idx, 1);
      }
   }

   public static pushJoinBuffer(): void {
      for (const gameObject of this.joinBuffer) {
         this.addGameObjectToBoard(gameObject)
      }

      this.joinBuffer = new Array<GameObject>();
   }

   private static addGameObjectToBoard(gameObject: GameObject): void {
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
   public static forcePushGameObjectFromJoinBuffer(gameObject: GameObject): void {
      const idx = this.joinBuffer.indexOf(gameObject);
      if (idx !== -1) {
         this.addGameObjectToBoard(gameObject);
         this.removeGameObjectFromJoinBuffer(gameObject);
      }
   }

   public static ageItems(): void {
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const droppedItem of chunk.getDroppedItems()) {
               droppedItem.ageItem();
            }
         }  
      }
   }

   public static isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1 && position.y >= 0 && position.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
   }

   public static gameObjectIsInBoard(gameObject: GameObject): boolean {
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

   public static distanceToClosestEntity(position: Point): number {
      let minDistance = 2000;

      const minChunkX = Math.max(Math.min(Math.floor((position.x - 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((position.x + 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((position.y - 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((position.y + 2000) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const checkedEntities = new Set<Entity>();
      
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
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

   public static getEntitiesAtPosition(position: Point): Set<Entity> {
      if (!this.isInBoard(position)) {
         throw new Error("Position isn't in the board");
      }
      
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

   public static getGameObject(id: number): GameObject {
      let gameObject: GameObject;
      for (const currentGameObject of this.gameObjects) {
         if (currentGameObject.id === id) {
            gameObject = currentGameObject;
            break;
         }
      }
      return gameObject!;
   }

   public static hasGameObject(gameObjectID: number): boolean {
      for (const gameObject of this.gameObjects) {
         if (gameObject.id === gameObjectID) {
            return true;
         }
      }
      return false;
   }

   public static tileIsInBoard(tileX: number, tileY: number): boolean {
      return tileX >= 0 && tileX < SETTINGS.BOARD_DIMENSIONS && tileY >= 0 && tileY < SETTINGS.BOARD_DIMENSIONS;
   }
}

export default Board;