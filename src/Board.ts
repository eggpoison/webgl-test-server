import { Mutable, Point, DroppedItemData, SETTINGS, ServerTileUpdateData, Vector, randInt, EntityData, EntityType } from "webgl-test-shared";
import Chunk from "./Chunk";
import Entity from "./entities/Entity";
import Mob from "./entities/mobs/Mob";
import Player from "./entities/Player";
import DroppedItem from "./items/DroppedItem";
import generateTerrain from "./terrain-generation";
import Tile from "./tiles/Tile";
import { GameObject } from "./GameObject";

export type EntityHitboxInfo = {
   readonly vertexPositions: readonly [Point, Point, Point, Point];
   readonly sideAxes: ReadonlyArray<Vector>;
}

class Board {
   /** Average number of random ticks done in a chunk a second */
   private static readonly RANDOM_TICK_RATE = 1;

   private readonly gameObjects = new Set<GameObject>();

   /** Stores entities indexed by the IDs */
   public readonly entities: { [id: number]: Entity } = {};
   
   private readonly tiles: Array<Array<Tile>>;
   private readonly chunks: Array<Array<Chunk>>;

   private tileUpdateCoordinates: Set<[x: number, y: number]>;

   private gameObjectsToRemove = new Array<GameObject>();

   /** Array of all entities' IDs to be removed at the beginning of the next tick */
   private removedEntities = new Set<number>();
   /** All entities to join the board */
   // private entityJoinBuffer = new Set<Entity>();

   private joinBuffer = new Array<GameObject>();

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
      // for (const id of this.removedEntities) {
      //    const entity = this.entities[id];
      //    this.removeEntity(entity);
      // }

      // this.removedEntities.clear();
   }

   private removeGameObject(gameObject: GameObject): void {
      if (gameObject.i === "entity") {
         delete this.entities[gameObject.id];
      }

      for (const chunk of gameObject.chunks) {
         chunk.removeGameObject(gameObject);
      }

      this.gameObjects.delete(gameObject);
   }

   public addGameObjectToRemoveBuffer(gameObject: GameObject): void {
      this.gameObjectsToRemove.push(gameObject);
   }

   public updateGameObjects(): void {
      const chunkGroups: { [key: string]: Set<GameObject> } = {};

      for (const gameObject of this.gameObjects) {
         // if (gameObject.i === "entity") console.log(gameObject.type);
         gameObject.tick();

         if (gameObject.isRemoved) {
            this.gameObjectsToRemove.push(gameObject);
         }

         gameObject.savePreviousCollidingGameObjects();
         gameObject.clearCollidingGameObjects();
         this.setEntityPotentialCollidingEntities(chunkGroups, gameObject);
      }
   }

   // public updateEntities(): void {
      // const entityChunkGroups: { [key: string]: Set<Entity> } = {};

   //    for (const entity of Object.values(this.entities)) {
   //       entity.applyPhysics();

   //       // Calculate the entity's new info
   //       for (const hitbox of entity.hitboxes) {
   //          if (hitbox.info.type === "rectangular") {
   //             (hitbox as RectangularHitbox).computeVertexPositions();
   //             (hitbox as RectangularHitbox).calculateSideAxes();
   //          }
   //          hitbox.updateHitboxBounds();
   //       }
   //       entity.updateContainingChunks();

   //       // Tick entity
   //       entity.tick();

   //       // If the entity was removed during the tick, add it to the list of removed entities
   //       if (entity.isRemoved) {
   //          this.removedEntities.add(entity.id);
   //       }

   //       entity.savePreviousCollidingEntities();
   //       entity.clearCollidingGameObjects();

   //       this.setEntityPotentialCollidingEntities(entityChunkGroups, entity);
   //    }
   // }

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
      // console.log("potential colliding objects:");
      // console.log(gameObject.potentialCollidingObjects);
   }

   public resolveCollisions(): void {
      for (const gameObject of this.gameObjects) {
         gameObject.updateCollidingGameObjects();
         gameObject.resolveGameObjectCollisions();
         gameObject.resolveWallCollisions();

         gameObject.updateTile();
      }
      // for (const entity of Object.values(this.entities)) {
      //    entity.updateCollidingEntities();
      //    entity.resolveGameObjectCollisions();
      //    entity.resolveWallCollisions();

      //    entity.updateTile();
      // }
   }

   // /** Removes the entity from the game */
   // private removeEntity(entity: Entity): void {
   //    if (entity.isRemoved) {

   //    }

   //    delete this.entities[entity.id];

   //    // Remove the entity from its chunks
   //    for (const chunk of entity.chunks) {
   //       chunk.removeEntity(entity);
   //    }

   //    removeEntityFromCensus(entity.type);
   // }

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

   public pushJoinBuffer(): void {
      for (const gameObject of this.joinBuffer) {
         gameObject.updateHitboxes();
         gameObject.updateContainingChunks();

         this.gameObjects.add(gameObject);

         if (gameObject.i === "entity") {
            this.entities[gameObject.id] = gameObject;
         }
      }

      this.joinBuffer = new Array<GameObject>();
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

   private bundleEntityData(entity: Entity): EntityData<EntityType> {
      const healthComponent = entity.getComponent("health")!;
      
      const entityData: Mutable<EntityData<EntityType>> = {
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

      if (entity instanceof Mob) {
         entityData.special = {
            mobAIType: (entity as Mob).getCurrentAIType() || "none"
         };
      }

      return entityData;
   }

   public bundleEntityDataArray(player: Player): ReadonlyArray<EntityData<EntityType>> {
      const entityDataArray = new Array<EntityData<EntityType>>();

      for (const entity of Object.values(this.entities)) {
         if (entity !== player) {
            const data = this.bundleEntityData(entity);
            entityDataArray.push(data);
         }
      }

      return entityDataArray;
   }

   private bundleDroppedItemData(droppedItem: DroppedItem): DroppedItemData {
      const chunkCoordinates = new Array<[number, number]>();
      for (const chunk of droppedItem.chunks) {
         chunkCoordinates.push([chunk.x, chunk.y]);
      }

      return {
         id: droppedItem.id,
         itemID: droppedItem.item.type,
         count: droppedItem.item.count,
         position: droppedItem.position.package(),
         velocity: droppedItem.velocity !== null ? droppedItem.velocity.package() : null,
         chunkCoordinates: chunkCoordinates,
         rotation: droppedItem.rotation
      };
   }

   public bundleDroppedItemDataArray(): ReadonlyArray<DroppedItemData> {
      const droppedItemDataArray = new Array<DroppedItemData>();

      const seenDroppedItemIDs = new Array<number>();

      for (let chunkX = 0; chunkX < SETTINGS.BOARD_SIZE; chunkX++) {
         for (let chunkY = 0; chunkY < SETTINGS.BOARD_SIZE; chunkY++) {
            const chunk = this.getChunk(chunkX, chunkY);
            for (const droppedItem of chunk.getDroppedItems()) {
               if (!seenDroppedItemIDs.includes(droppedItem.id)) {
                  const data = this.bundleDroppedItemData(droppedItem);
                  droppedItemDataArray.push(data);
                  
                  seenDroppedItemIDs.push(droppedItem.id);
               }
            }
         }
      }

      return droppedItemDataArray;
   }

   public isInBoard(position: Point): boolean {
      return position.x >= 0 && position.x <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1 && position.y >= 0 && position.y <= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
   }
}

export default Board;