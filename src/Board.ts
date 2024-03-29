import { BiomeName, DecorationInfo, GrassTileInfo, ItemType, Point, RIVER_STEPPING_STONE_SIZES, RiverSteppingStoneData, SETTINGS, ServerTileUpdateData, TileType, TileTypeConst, WaterRockData, circleAndRectangleDoIntersectWithOffset, circulesDoIntersectWithOffset, randItem } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Tile from "./Tile";
import Projectile from "./Projectile";
import CircularHitbox from "./hitboxes/CircularHitbox";
import { addTileToCensus, getTilesOfType, removeEntityFromCensus, removeTileFromCensus } from "./census";
import { addFleshSword, removeFleshSword } from "./flesh-sword-ai";
import Tribe from "./Tribe";
import GameObject from "./GameObject";
import Hitbox from "./hitboxes/Hitbox";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import generateTerrain from "./world-generation/terrain-generation";

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

abstract class Board {
   public static ticks = 0;

   /** The time of day the server is currently in (from 0 to 23) */
   public static time = 6.01;

   /** This is an array as game objects get created/removed fairly slowly */
   public static gameObjects = new Array<GameObject>();

   // @Cleanup: Why are these different types?
   public static entities: { [id: number]: Entity } = {};
   public static droppedItems: { [id: number]: DroppedItem } = {};
   public static projectiles = new Set<Projectile>();

   public static tiles: Array<Tile>;
   private static chunks1d = new Array<Chunk>();
   private static chunks = new Array<Array<Chunk>>();

   private static riverFlowDirections: Record<number, Record<number, number>>;
   public static waterRocks: ReadonlyArray<WaterRockData>;
   public static riverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;

   private static tileUpdateCoordinates: Set<number>;

   private static entityJoinBuffer = new Array<Entity>();
   private static droppedItemJoinBuffer = new Array<DroppedItem>();
   private static projectileJoinBuffer = new Array<Projectile>();

   private static entityRemoveBuffer = new Array<Entity>();
   private static droppedItemRemoveBuffer = new Array<DroppedItem>();
   private static projectileRemoveBuffer = new Array<Projectile>();

   private static tribes = new Array<Tribe>();

   // @Incomplete @Bug: These shouldn't be tiles but instead serverdata, so that they aren't counted in the census
   public static edgeTiles = new Array<Tile>();
   public static edgeRiverFlowDirections: Record<number, Record<number, number>>;
   public static edgeRiverSteppingStones: ReadonlyArray<RiverSteppingStoneData>;

   public static grassInfo: Record<number, Record<number, GrassTileInfo>>;

   public static decorations: ReadonlyArray<DecorationInfo>;

   public static reset(): void {
      this.gameObjects = [];
      this.entities = {};
      this.droppedItems = {};
      this.projectiles = new Set();
   }

   public static setup(): void {
      this.initialiseChunks();

      const generationInfo = generateTerrain();
      this.tiles = generationInfo.tiles;
      this.riverFlowDirections = generationInfo.riverFlowDirections;
      this.waterRocks = generationInfo.waterRocks;
      this.riverSteppingStones = generationInfo.riverSteppingStones;
      this.edgeTiles = generationInfo.edgeTiles;
      this.edgeRiverFlowDirections = generationInfo.edgeRiverFlowDirections;
      this.edgeRiverSteppingStones = generationInfo.edgeRiverSteppingStones;
      this.grassInfo = generationInfo.grassInfo;
      this.decorations = generationInfo.decorations;

      this.tileUpdateCoordinates = new Set<number>();

      // Add river stepping stones to chunks
      for (const steppingStoneData of generationInfo.riverSteppingStones) {
         const size = RIVER_STEPPING_STONE_SIZES[steppingStoneData.size];
         const minChunkX = Math.max(Math.min(Math.floor((steppingStoneData.positionX - size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor((steppingStoneData.positionX + size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor((steppingStoneData.positionY - size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor((steppingStoneData.positionY + size/2) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         
         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = this.getChunk(chunkX, chunkY);
               chunk.riverSteppingStones.push(steppingStoneData);
            }
         }
      }
   } 

   public static isNight(): boolean {
      return Board.time < 6 || Board.time >= 18;
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
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      return this.tiles[tileIndex];
   }

   public static replaceTile(tileX: number, tileY: number, tileType: TileTypeConst, biomeName: BiomeName, isWall: boolean, riverFlowDirection: number): void {
      const tileIndex = tileY * SETTINGS.BOARD_DIMENSIONS + tileX;
      const tile = this.tiles[tileIndex];

      removeTileFromCensus(tile);
      
      tile.type = tileType;
      tile.biomeName = biomeName;
      tile.isWall = isWall;
      tile.riverFlowDirection = riverFlowDirection;

      addTileToCensus(tile);
   }

   public static getChunk(chunkX: number, chunkY: number): Chunk {
      return this.chunks[chunkX][chunkY];
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
      for (const entity of this.entityRemoveBuffer) {
         this.removeGameObject(entity);
         delete this.entities[entity.id];
         removeEntityFromCensus(entity);
      }

      for (const droppedItem of this.droppedItemRemoveBuffer) {
         this.removeGameObject(droppedItem);
         delete this.droppedItems[droppedItem.id];
         if (droppedItem.item.type === ItemType.flesh_sword) {
            removeFleshSword(droppedItem);
         }
      }

      for (const projectile of this.projectileRemoveBuffer) {
         this.removeGameObject(projectile);
         delete this.droppedItems[projectile.id];
         this.projectiles.delete(projectile);
      }

      this.entityRemoveBuffer = new Array<Entity>();
      this.droppedItemRemoveBuffer = new Array<DroppedItem>();
      this.projectileRemoveBuffer = new Array<Projectile>();
   }

   private static removeGameObject(gameObject: GameObject): void {
      const idx = this.gameObjects.indexOf(gameObject);
      
      if (idx === -1) {
         throw new Error("Tried to remove a game object which doesn't exist or was already removed.");
      }

      this.gameObjects.splice(idx, 1);

      for (const chunk of gameObject.chunks) {
         gameObject.removeFromChunk(chunk);
      }
   }

   public static forceRemoveEntity(entity: Entity): void {
      const idx = this.entityRemoveBuffer.indexOf(entity);
      if (idx !== -1) {
         this.entityRemoveBuffer.splice(idx, 1);
      }

      this.removeGameObject(entity);
      delete this.entities[entity.id];
      removeEntityFromCensus(entity);
   }

   public static updateGameObjects(): void {
      const length = this.gameObjects.length;
      for (let i = 0; i < length; i++) {
         const gameObject = this.gameObjects[i];
         gameObject.tick();
      }
   }

   public static resolveOtherCollisions(): void {
      const numGameObjects = this.gameObjects.length;
      for (let i = 0; i < numGameObjects; i++) {
         const gameObject = this.gameObjects[i];

         // Remove old collisions
         // @Speed
         let numCollisions = gameObject.collidingObjects.length;
         for (let i = 0; i < numCollisions; i++) {
            if (gameObject.collidingObjectTicks[i] !== Board.ticks) {
               gameObject.collidingObjects.splice(i, 1);
               gameObject.collidingObjectTicks.splice(i, 1);
               i--;
               numCollisions--;
            }
         }

         // @Incomplete: We may need to set hitboxesAreDirty in the resolveBorderCollisions and other places, so this actually gets called
         // @Temporary
         if (gameObject.positionIsDirty || gameObject.hitboxesAreDirty) {
            gameObject.cleanHitboxes();
         }

         if (gameObject.positionIsDirty) {
            gameObject.positionIsDirty = false;
   
            if (gameObject.hasPotentialWallTileCollisions) {
               gameObject.resolveWallTileCollisions();
            }
         
            // If the object moved due to resolving wall tile collisions, recalculate
            if (gameObject.positionIsDirty) {
               gameObject.cleanHitboxes();
            }
   
            gameObject.resolveBorderCollisions();
         
            // If the object moved due to resolving border collisions, recalculate
            if (gameObject.positionIsDirty) {
               gameObject.cleanHitboxes();
            }

            // If the game object has moved to a new tile, update its tile
            // Tile is only dirty if position is dirty so we can do this check inside
            if (gameObject.tile.x !== Math.floor(gameObject.position.x / SETTINGS.TILE_SIZE) ||
                gameObject.tile.y !== Math.floor(gameObject.position.y / SETTINGS.TILE_SIZE)) {
               gameObject.updateTile();
            }

            gameObject.isInRiver = gameObject.checkIsInRiver();
         }
      }
   }

   public static resolveGameObjectCollisions(): void {
      // @Speed: Perhaps there is some architecture which can avoid the check that game objects are already colliding, or the glorified bubble sort thing
      // Ideal implementation:
      // Ensure that any two game objects only get checked together ONCE
      // As few checks as possible (e.g. check for if they have already collided this tick)
      // BSP?
      
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
            type: tile.type as unknown as TileType,
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
         if (dirtTile.type === TileTypeConst.dirt) {
            this.replaceTile(tileX, tileY, TileTypeConst.grass, "grasslands", false, 0);
         }
      }
   }

   public static addEntityToJoinBuffer(entity: Entity): void {
      this.entityJoinBuffer.push(entity);
   }

   public static addDroppedItemToJoinBuffer(droppedItem: DroppedItem): void {
      this.droppedItemJoinBuffer.push(droppedItem);
   }

   public static addProjectileToJoinBuffer(projectile: Projectile): void {
      this.projectileJoinBuffer.push(projectile);
   }

   public static removeEntityFromJoinBuffer(entity: Entity): void {
      const idx = this.entityJoinBuffer.indexOf(entity);
      if (idx !== -1) {
         this.entityJoinBuffer.splice(idx, 1);
      }
   }

   public static removeDroppedItemFromJoinBuffer(droppedItem: DroppedItem): void {
      const idx = this.droppedItemJoinBuffer.indexOf(droppedItem);
      if (idx !== -1) {
         this.droppedItemJoinBuffer.splice(idx, 1);
      }
   }

   public static removeProjectileFromJoinBuffer(projectile: Projectile): void {
      const idx = this.projectileJoinBuffer.indexOf(projectile);
      if (idx !== -1) {
         this.projectileJoinBuffer.splice(idx, 1);
      }
   }

   public static addEntityToRemoveBuffer(entity: Entity): void {
      this.entityRemoveBuffer.push(entity);
   }

   public static addDroppedItemToRemoveBuffer(droppedItem: DroppedItem): void {
      this.droppedItemRemoveBuffer.push(droppedItem);
   }

   public static addProjectileToRemoveBuffer(projectile: Projectile): void {
      this.projectileRemoveBuffer.push(projectile);
   }

   public static pushJoinBuffer(): void {
      for (const entity of this.entityJoinBuffer) {
         this.addGameObjectToBoard(entity)
         this.entities[entity.id] = entity;
      }

      for (const droppedItem of this.droppedItemJoinBuffer) {
         this.addGameObjectToBoard(droppedItem);
         this.droppedItems[droppedItem.id] = droppedItem;
         if (droppedItem.item.type === ItemType.flesh_sword) {
            addFleshSword(droppedItem);
         }
      }

      for (const projectile of this.projectileJoinBuffer) {
         this.addGameObjectToBoard(projectile);
         this.projectiles.add(projectile);
      }

      this.entityJoinBuffer = new Array<Entity>();
      this.droppedItemJoinBuffer = new Array<DroppedItem>();
      this.projectileJoinBuffer = new Array<Projectile>();
   }

   private static addGameObjectToBoard(gameObject: GameObject): void {
      // @Cleanup: Is this necessary?
      gameObject.cleanHitboxes();
      gameObject.updateContainingChunks();

      this.gameObjects.push(gameObject);
   }

   public static isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1 && position.y >= 0 && position.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
   }

   private static gameObjectIsInBoard(gameObject: GameObject): boolean {
      // Check the game objects
      if (this.gameObjects.indexOf(gameObject) !== -1) return true;

      // Check the chunks
      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);

            // Check if it is in the chunk's game objects
            if (chunk.gameObjects.indexOf(gameObject) !== -1) return true;
         }
      }

      return false;
   }

   public static entityIsInBoard(entity: Entity): boolean {
      if (this.gameObjectIsInBoard(entity)) return true;
      return this.entityJoinBuffer.indexOf(entity) !== -1;
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
      
      // @Speed: Garbage collection
      const testPosition = new Point(x, y);

      const chunkX = Math.floor(x / SETTINGS.CHUNK_UNITS);
      const chunkY = Math.floor(y / SETTINGS.CHUNK_UNITS);

      const entities = new Set<Entity>();
      
      const chunk = this.getChunk(chunkX, chunkY);
      for (const entity of chunk.entities) {
         for (const hitbox of entity.hitboxes) {
            if (this.hitboxIsInRange(testPosition, hitbox)) {
               entities.add(entity);
               break;
            }
         }
      }

      return entities;
   }

   private static hitboxIsInRange(testPosition: Point, hitbox: Hitbox): boolean {
      // @Speed: This check is slow
      if (hitbox.hasOwnProperty("radius")) {
         // Circular hitbox
         // @Speed: Garbage collection
         return circulesDoIntersectWithOffset(testPosition, new Point(0, 0), 1, hitbox.object.position, hitbox.offset, (hitbox as CircularHitbox).radius);
      } else {
         // Rectangular hitbox
         // @Speed: Garbage collection
         return circleAndRectangleDoIntersectWithOffset(testPosition, new Point(0, 0), 1, hitbox.object.position, hitbox.offset, (hitbox as RectangularHitbox).width, (hitbox as RectangularHitbox).height, hitbox.object.rotation);
      }
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

/** Returns false if any of the tiles in the raycast don't match the inputted tile types. */
export function tileRaytraceMatchesTileTypes(startX: number, startY: number, endX: number, endY: number, tileTypes: ReadonlyArray<TileTypeConst>): boolean {
   /*
   Kindly yoinked from https://playtechs.blogspot.com/2007/03/raytracing-on-grid.html
   */
   
   // Convert to tile coordinates
   const x0 = startX / SETTINGS.TILE_SIZE;
   const x1 = endX / SETTINGS.TILE_SIZE;
   const y0 = startY / SETTINGS.TILE_SIZE;
   const y1 = endY / SETTINGS.TILE_SIZE;
   
   const dx = Math.abs(x0 - x1);
   const dy = Math.abs(y0 - y1);

   // Starting tile coordinates
   let x = Math.floor(x0);
   let y = Math.floor(y0);

   const dt_dx = 1 / dx;
   const dt_dy = 1 / dy;

   let n = 1;
   let x_inc, y_inc;
   let t_next_vertical, t_next_horizontal;

   if (dx === 0) {
      x_inc = 0;
      t_next_horizontal = dt_dx; // Infinity
   } else if (x1 > x0) {
      x_inc = 1;
      n += Math.floor(x1) - x;
      t_next_horizontal = (Math.floor(x0) + 1 - x0) * dt_dx;
   } else {
      x_inc = -1;
      n += x - Math.floor(x1);
      t_next_horizontal = (x0 - Math.floor(x0)) * dt_dx;
   }

   if (dy === 0) {
      y_inc = 0;
      t_next_vertical = dt_dy; // Infinity
   } else if (y1 > y0) {
      y_inc = 1;
      n += Math.floor(y1) - y;
      t_next_vertical = (Math.floor(y0) + 1 - y0) * dt_dy;
   } else {
      y_inc = -1;
      n += y - Math.floor(y1);
      t_next_vertical = (y0 - Math.floor(y0)) * dt_dy;
   }

   for (; n > 0; n--) {
      const tile = Board.getTile(x, y);
      if (!tileTypes.includes(tile.type)) {
         return false;
      }

      if (t_next_vertical < t_next_horizontal) {
         y += y_inc;
         t_next_vertical += dt_dy;
      } else {
         x += x_inc;
         t_next_horizontal += dt_dx;
      }
   }

   return true;
}