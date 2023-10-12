import { ItemType, Point, RIVER_STEPPING_STONE_SIZES, RiverSteppingStoneData, SETTINGS, ServerTileUpdateData, TileType, Vector, WaterRockData, randInt, randItem } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import generateTerrain from "./terrain-generation/terrain-generation";
import Tile from "./Tile";
import { GameObject } from "./GameObject";
import Projectile from "./Projectile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import { getTilesOfType, removeEntityFromCensus } from "./census";
import { addFleshSword, removeFleshSword } from "./flesh-sword-ai";
import Tribe from "./Tribe";

const OFFSETS: ReadonlyArray<[xOffest: number, yOffset: number]> = [
   [-1, -1],
   [0, -1],
   [1, -1],
   [-1, 0],
   [1, 0],
   [-1, 1],
   [0, 1],
   [1, 1],
];

interface KilledEntityInfo {
   readonly id: number;
   readonly boundingChunks: ReadonlySet<Chunk>;
}

abstract class Board {
   public static ticks = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public static time = 6;

   /** This is an array as game objects get created/removed fairly slowly */
   private static readonly gameObjects = new Array<GameObject>();

   public static readonly entities: { [id: number]: Entity } = {};
   public static readonly droppedItems: { [id: number]: DroppedItem } = {};
   public static readonly projectiles = new Set<Projectile>();

   // This is undefined initially to indicate that terrain hasn't been generated yet
   private static tiles: Array<Array<Tile>>;
   private static chunks1d = new Array<Chunk>();
   private static chunks = new Array<Array<Chunk>>();

   private static riverFlowDirections: Record<number, Record<number, number>>;
   public static waterRocks: ReadonlyArray<WaterRockData>;
   public static riverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;

   private static tileUpdateCoordinates: Set<number>;

   private static gameObjectsToRemove = new Array<GameObject>();

   private static joinBuffer = new Array<GameObject>();

   private static tribes = new Array<Tribe>();

   /** The IDs of all entities which have been killed since the start of the current tick */
   public static killedEntities = new Array<KilledEntityInfo>();

   public static setup(): void {
      this.initialiseChunks();

      const generationInfo = generateTerrain();
      this.tiles = generationInfo.tiles;
      this.riverFlowDirections = generationInfo.riverFlowDirections;
      this.waterRocks = generationInfo.waterRocks;
      this.riverSteppingStones = generationInfo.riverSteppingStones;

      this.tileUpdateCoordinates = new Set<number>();

      // Add river stepping stones to chunks
      for (const steppingStoneData of generationInfo.riverSteppingStones) {
         const size = RIVER_STEPPING_STONE_SIZES[steppingStoneData.size];
         const minChunkX = Math.max(Math.min(Math.floor((steppingStoneData.position[0] - size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor((steppingStoneData.position[0] + size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor((steppingStoneData.position[1] - size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor((steppingStoneData.position[1] + size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         
         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = this.getChunk(chunkX, chunkY);
               chunk.addRiverSteppingStone(steppingStoneData);
            }
         }
      }
   }

   public static terrainHasBeenGenerated(): boolean {
      return typeof this.tiles !== "undefined";
   }

   private static initialiseChunks(): void {
      for (let x = 0; x < SETTINGS.BOARD_SIZE; x++) {
         this.chunks[x] = new Array<Chunk>(SETTINGS.BOARD_SIZE);
         for (let y = 0; y < SETTINGS.BOARD_SIZE; y++) {
            const chunk = new Chunk(x, y);
            
            this.chunks[x][y] = chunk;
            const chunkIndex = y * SETTINGS.BOARD_SIZE + x;
            this.chunks1d[chunkIndex] = chunk;
         }
      }
   }

   public static tickIntervalHasPassed(intervalSeconds: number): boolean {
      const ticksPerInterval = intervalSeconds * SETTINGS.TPS;
      
      const previousCheck = (this.ticks - 1) / ticksPerInterval;
      const check = this.ticks / ticksPerInterval;
      return Math.floor(previousCheck) !== Math.floor(check);
   }

   public static getRiverFlowDirection(tileX: number, tileY: number): number {
      if (!this.riverFlowDirections.hasOwnProperty(tileX) || !this.riverFlowDirections[tileX].hasOwnProperty(tileY)) {
         throw new Error("Tried to get the river flow direction of a non-water tile.");
      }
      
      return this.riverFlowDirections[tileX][tileY];
   }

   public static getRiverFlowDirections(): Record<number, Record<number, number>> {
      return this.riverFlowDirections;
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

   public static getChunk(chunkX: number, chunkY: number): Chunk {
      if (chunkX < 0 || chunkX >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Chunk x '${chunkX}' is not a valid chunk coordinate.`);
      if (chunkY < 0 || chunkY >= SETTINGS.BOARD_DIMENSIONS) throw new Error(`Chunk y '${chunkY}' is not a valid chunk coordinate.`);
      return this.chunks[chunkX][chunkY];
   }

   /** Returns a reference to the tiles array */
   public static getTiles(): Array<Array<Tile>> {
      return this.tiles;
   }

   public static addTribe(tribe: Tribe): void {
      this.tribes.push(tribe);
   }

   public static removeTribe(tribe: Tribe): void {
      const idx = this.tribes.indexOf(tribe);
      if (idx !== -1) {
         this.tribes.splice(idx, 1);
      }
   }

   public static updateTribes(): void {
      for (const tribe of this.tribes) {
         tribe.tick();
      }
   }

   public static getTribes(): ReadonlyArray<Tribe> {
      return this.tribes;
   }

   /** Removes game objects flagged for deletion */
   public static removeFlaggedGameObjects(): void {
      for (const gameObject of this.gameObjectsToRemove) {
         this.removeGameObject(gameObject);
      }

      this.gameObjectsToRemove = new Array<GameObject>();
   }

   private static removeGameObject(gameObject: GameObject): void {
      const idx = this.gameObjects.indexOf(gameObject);
      
      if (idx === -1) {
         console.log("Game object i: " + gameObject.i);
         if (gameObject.i === "entity") {
            console.log("Entity type: " + gameObject.type);
         }
         throw new Error("Tried to remove a game object which doesn't exist or was already removed.");
      }

      this.gameObjects.splice(idx, 1);
      
      switch (gameObject.i) {
         case "entity": {
            delete this.entities[gameObject.id];
            removeEntityFromCensus(gameObject);
            break;
         }
         case "droppedItem": {
            delete this.droppedItems[gameObject.id];
            if (gameObject.item.type === ItemType.flesh_sword) {
               removeFleshSword(gameObject);
            }
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

   public static updateGameObjects(): void {
      const length = this.gameObjects.length;
      for (let i = 0; i < length; i++) {
         const gameObject = this.gameObjects[i];

         const positionXBeforeUpdate = gameObject.position.x;
         const positionYBeforeUpdate = gameObject.position.y;

         gameObject.tick();
      
         if (gameObject.position.x !== positionXBeforeUpdate || gameObject.position.y !== positionYBeforeUpdate) {
            gameObject.positionIsDirty = true;
            gameObject.hitboxesAreDirty = true;
         }

         // Clean the game object's bounding area, hitbox bounds and chunks
         if (gameObject.hitboxesAreDirty) {
            gameObject.cleanHitboxes();
         }
      }
   }

   // Note: the two following functions are separate for profiling purposes

   public static resolveGameObjectCollisions(): void {
      // @Speed: Perhaps there is some architecture which can avoid the check that game objects are already colliding, or the glorified bubble sort thing
      
      const numChunks = SETTINGS.BOARD_SIZE * SETTINGS.BOARD_SIZE;
      for (let i = 0; i < numChunks; i++) {
         const chunk = this.chunks1d[i];
         for (let j = 0; j <= chunk.gameObjects.length - 2; j++) {
            const gameObject1 = chunk.gameObjects[j];
            for (let k = j + 1; k <= chunk.gameObjects.length - 1; k++) {
               const gameObject2 = chunk.gameObjects[k];

               if (gameObject1.collidingObjects.indexOf(gameObject2) === -1 && gameObject1.isColliding(gameObject2)) {
                  gameObject1.collide(gameObject2);
                  gameObject2.collide(gameObject1);
               }
            }
         }
      }
   }

   public static resolveWallCollisions(): void {
      const numGameObjects = this.gameObjects.length;
      for (let i = 0; i < numGameObjects; i++) {
         const gameObject = this.gameObjects[i];

         if (gameObject.positionIsDirty) {
            let positionXBeforeUpdate = gameObject.position.x;
            let positionYBeforeUpdate = gameObject.position.y;
   
            gameObject.resolveWallTileCollisions();
         
            // If the object moved due to resolving wall tile collisions, recalculate
            if (gameObject.position.x !== positionXBeforeUpdate || gameObject.position.y !== positionYBeforeUpdate) {
               gameObject.updateHitboxesAndBoundingArea();
            }

            positionXBeforeUpdate = gameObject.position.x;
            positionYBeforeUpdate = gameObject.position.y;
   
            gameObject.resolveWallCollisions();
         
            // If the object moved due to resolving wall collisions, recalculate
            if (gameObject.position.x !== positionXBeforeUpdate || gameObject.position.y !== positionYBeforeUpdate) {
               gameObject.updateHitboxesAndBoundingArea();
            }

            // Do calculations which are dependent on the position
            gameObject.updateTile();
            gameObject.isInRiver = gameObject.checkIsInRiver();
         }

         if (gameObject.hitboxesAreDirty) {
            gameObject.cleanHitboxes();
         }

         gameObject.previousCollidingObjects = gameObject.collidingObjects;
         // @Speed: This is a lot of garbage collection having to be done
         gameObject.collidingObjects = [];
      }
   }

   /** Registers a tile update to be sent to the clients */
   public static registerNewTileUpdate(x: number, y: number): void {
      const tileIndex = y * SETTINGS.BOARD_DIMENSIONS + x;
      this.tileUpdateCoordinates.add(tileIndex);
   }

   /** Get all tile updates and reset them */
   public static popTileUpdates(): ReadonlyArray<ServerTileUpdateData> {
      // Generate the tile updates array
      const tileUpdates = new Array<ServerTileUpdateData>();
      for (const tileIndex of this.tileUpdateCoordinates) {
         const tileX = tileIndex % SETTINGS.BOARD_DIMENSIONS;
         const tileY = Math.floor(tileIndex / SETTINGS.BOARD_DIMENSIONS);
         
         const tile = this.getTile(tileX, tileY);
         tileUpdates.push({
            tileIndex: tileIndex,
            type: tile.type,
            isWall: tile.isWall
         });
      }

      // reset the tile update coordiantes
      this.tileUpdateCoordinates.clear();

      return tileUpdates;
   }

   public static spreadGrass(): void {
      const grassTiles = getTilesOfType(TileType.grass);

      let numSpreadedGrass = grassTiles.length / SETTINGS.BOARD_DIMENSIONS / SETTINGS.BOARD_DIMENSIONS / SETTINGS.TPS;
      if (Math.random() > numSpreadedGrass % 1) {
         numSpreadedGrass = Math.ceil(numSpreadedGrass);
      } else {
         numSpreadedGrass = Math.floor(numSpreadedGrass);
      }
      for (let i = 0; i < numSpreadedGrass; i++) {
         const tile = randItem(grassTiles);
         
         const offset = randItem(OFFSETS);
         const tileX = tile.x + offset[0];
         const tileY = tile.y + offset[1];
         if (!Board.tileIsInBoard(tileX, tileY)) {
            continue;
         }

         const dirtTile = Board.getTile(tileX, tileY);
         if (dirtTile.type === TileType.dirt) {
            new Tile(tileX, tileY, TileType.grass, "grasslands", false);
         }
      }
   }

   public static addGameObjectToJoinBuffer(gameObject: GameObject): void {
      if (Object.keys(this.droppedItems).length > 100 && gameObject.i === "droppedItem") {
         return;
      }
      
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
      gameObject.updateHitboxesAndBoundingArea();
      gameObject.updateContainingChunks();

      this.gameObjects.push(gameObject);

      switch (gameObject.i) {
         case "entity": {
            this.entities[gameObject.id] = gameObject;
            break;
         }
         case "droppedItem": {
            this.droppedItems[gameObject.id] = gameObject;
            if (gameObject.item.type === ItemType.flesh_sword) {
               addFleshSword(gameObject);
            }
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

   public static isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1 && position.y >= 0 && position.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
   }

   public static gameObjectIsInBoard(gameObject: GameObject): boolean {
      // Check the join buffer and game objects set
      if (this.gameObjects.indexOf(gameObject) !== -1 || this.joinBuffer.includes(gameObject)) return true;

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
            if (chunk.gameObjects.indexOf(gameObject) !== -1) return true;

            // If the game object is an entity, check if it is in the chunk's entities
            if (gameObject.i === "entity" && chunk.entities.has(gameObject)) return true;
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
            for (const entity of chunk.entities) {
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

   public static getEntitiesAtPosition(x: number, y: number): Set<Entity> {
      if (!this.positionIsInBoard(x, y)) {
         throw new Error("Position isn't in the board");
      }
      
      // @Speed: Avoid creating a new hitbox every call
      const testHitbox = new CircularHitbox();
      testHitbox.radius = 1;
      testHitbox.position.x = x;
      testHitbox.position.y = y;
      testHitbox.updateHitboxBounds(0);

      const chunkX = Math.floor(x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const chunkY = Math.floor(y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);

      const entities = new Set<Entity>();
      
      const chunk = this.getChunk(chunkX, chunkY);
      entityLoop: for (const entity of chunk.entities) {
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

   public static positionIsInBoard(x: number, y: number): boolean {
      return x >= 0 && x < SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE && y >= 0 && y < SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;
   }

   public static getTileAtPosition(position: Point): Tile {
      const tileX = Math.floor(position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(position.y / SETTINGS.TILE_SIZE);
      return this.getTile(tileX, tileY);
   }

   public static getEntitiesInRange(position: Point, range: number): Array<Entity> {
      const minChunkX = Math.max(Math.min(Math.floor((position.x - range) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor((position.x + range) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor((position.y - range) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor((position.y + range) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const checkedEntities = new Set<Entity>();
      const entities = new Array<Entity>();
      
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = Board.getChunk(chunkX, chunkY);
            for (const entity of chunk.entities) {
               if (checkedEntities.has(entity)) continue;
               
               const distance = position.calculateDistanceBetween(entity.position);
               if (distance <= range) {
                  entities.push(entity);
               }

               checkedEntities.add(entity);
            }
         }
      }

      return entities;
   }
}

export default Board;