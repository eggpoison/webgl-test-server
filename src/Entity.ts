import { DoorToggleType, EntityComponents, EntityDebugData, IEntityType, Point, RIVER_STEPPING_STONE_SIZES, SettingsConst, TileTypeConst, clampToBoardDimensions, distToSegment, distance, pointIsInRectangle, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import Tile from "./Tile";
import Chunk from "./Chunk";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Board from "./Board";
import CircularHitbox from "./hitboxes/CircularHitbox";
import { onCowDeath } from "./entities/mobs/cow";
import { onTreeDeath } from "./entities/resources/tree";
import { onPlayerCollision, onPlayerDeath } from "./entities/tribes/player";
import { onIceSpikesCollision, onIceSpikesDeath } from "./entities/resources/ice-spikes";
import { onIceShardCollision } from "./entities/projectiles/ice-shards";
import { onKrumblidDeath } from "./entities/mobs/krumblid";
import { onCactusCollision, onCactusDeath } from "./entities/resources/cactus";
import { onTribeWorkerCollision, onTribeWorkerDeath } from "./entities/tribes/tribe-worker";
import { onZombieCollision } from "./entities/mobs/zombie";
import { onSlimeCollision } from "./entities/mobs/slime";
import { onWoodenArrowCollision } from "./entities/projectiles/wooden-arrow";
import { onYetiCollision, onYetiDeath } from "./entities/mobs/yeti";
import { onSnowballCollision } from "./entities/snowball";
import { onFishDeath } from "./entities/mobs/fish";
import { DoorComponentArray } from "./components/ComponentArray";
import { onFrozenYetiCollision } from "./entities/mobs/frozen-yeti";
import { onRockSpikeProjectileCollision } from "./entities/projectiles/rock-spike";
import { cleanAngle } from "./ai-shared";
import { onSpearProjectileCollision } from "./entities/projectiles/spear-projectile";
import { onTribeTotemDeath } from "./entities/tribes/tribe-totem";
import { onTribeWarriorDeath } from "./entities/tribes/tribe-warrior";
import { onSlimeSpitCollision, onSlimeSpitDeath } from "./entities/projectiles/slime-spit";
import { onSpitPoisonCollision } from "./entities/projectiles/spit-poison";
import { onBattleaxeProjectileCollision, onBattleaxeProjectileDeath } from "./entities/projectiles/battleaxe-projectile";
import Hitbox from "./hitboxes/Hitbox";
import { onIceArrowCollision } from "./entities/projectiles/ice-arrow";
import { onPebblumCollision } from "./entities/mobs/pebblum";
import { onGolemCollision } from "./entities/mobs/golem";
import { onWoodenSpikesCollision } from "./entities/structures/wooden-spikes";
import { onPunjiSticksCollision } from "./entities/structures/punji-sticks";
import { AIHelperComponentArray } from "./components/AIHelperComponent";
import { PhysicsComponentArray } from "./components/PhysicsComponent";

export const ID_SENTINEL_VALUE = 99999999;

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

// @Cleanup: Remove this and just do all collision stuff in one function
enum TileCollisionAxis {
   none = 0,
   x = 1,
   y = 2,
   diagonal = 3
}

export const RESOURCE_ENTITY_TYPES: ReadonlyArray<IEntityType> = [IEntityType.krumblid, IEntityType.fish, IEntityType.cow, IEntityType.tree, IEntityType.boulder, IEntityType.cactus, IEntityType.iceSpikes, IEntityType.berryBush];

export const NUM_ENTITY_TYPES = Object.keys(EntityComponents).length;

export const NO_COLLISION = 0xFFFF;

const entityHasHardCollision = (entity: Entity): boolean => {
   // Doors have hard collision when closing/closed
   if (entity.type === IEntityType.woodenDoor) {
      const doorComponent = DoorComponentArray.getComponent(entity.id);
      return doorComponent.toggleType === DoorToggleType.close || doorComponent.openProgress === 0;
   }
   
   return entity.type === IEntityType.woodenWall || entity.type === IEntityType.woodenEmbrasure;
}

// @Cleanup: Copy and pasted from shared repo

const findMinWithOffset = (vertices: ReadonlyArray<Point>, offsetX: number, offsetY: number, axis: Point): number => {
   const firstVertex = vertices[0];
   let min = axis.x * (firstVertex.x + offsetX) + axis.y * (firstVertex.y + offsetY);

   for (let i = 1; i < 4; i++) {
      const vertex = vertices[i];
      const dotProduct = axis.x * (vertex.x + offsetX) + axis.y * (vertex.y + offsetY);
      if (dotProduct < min) {
         min = dotProduct;
      }
   }

   return min;
}

const findMaxWithOffset = (vertices: ReadonlyArray<Point>, offsetX: number, offsetY: number, axis: Point): number => {
   const firstVertex = vertices[0];
   let max = axis.x * (firstVertex.x + offsetX) + axis.y * (firstVertex.y + offsetY);

   for (let i = 1; i < 4; i++) {
      const vertex = vertices[i];
      const dotProduct = axis.x * (vertex.x + offsetX) + axis.y * (vertex.y + offsetY);
      if (dotProduct > max) {
         max = dotProduct;
      }
   }

   return max;
}

/** A generic class for any object in the world */
class Entity<T extends IEntityType = IEntityType> {
   // @Cleanup: Remove
   private static readonly rectangularTestHitbox = new RectangularHitbox({position: new Point(0, 0), rotation: 0}, 1, 0, 0, 0.1, 0.1);
   
   /** Unique identifier for each entity */
   public readonly id: number;

   public readonly type: T;

   /** Combined mass of all the entity's hitboxes */
   public totalMass = Number.EPSILON;

   public ageTicks = 0;

   /** Position of the entity in the world */
   public position: Point;
   // @Cleanup: Might be able to be put on the physics component
   /** Velocity of the entity */
   public velocity = new Point(0, 0);
   // @Cleanup: Might be able to be put on the physics component
   /** Acceleration of the entity */
   public acceleration = new Point(0, 0);

   // @Cleanup @Memory: Do we really need this??
   /** Last position when the entities' hitboxes were clean */
   private lastCleanedPosition: Point;

   /** Direction the entity is facing in radians */
   public rotation = Number.EPSILON;

   public collisionPushForceMultiplier = 1;

   /** Set of all chunks the entity is contained in */
   public chunks = new Array<Chunk>();

   /** The tile the entity is currently standing on. */
   public tile!: Tile;

   /** All hitboxes attached to the entity */
   public hitboxes = new Array<RectangularHitbox | CircularHitbox>();

   public isInRiver!: boolean;
   
   public boundingAreaMinX = Number.MAX_SAFE_INTEGER;
   public boundingAreaMaxX = Number.MIN_SAFE_INTEGER;
   public boundingAreaMinY = Number.MAX_SAFE_INTEGER;
   public boundingAreaMaxY = Number.MIN_SAFE_INTEGER;

   public readonly collisionBit: number;
   public readonly collisionMask: number;

   constructor(position: Point, type: T, collisionBit: number, collisionMask: number) {
      this.position = position;
      this.lastCleanedPosition = new Point(position.x, position.y);
      this.type = type;
      this.collisionBit = collisionBit;
      this.collisionMask = collisionMask;

      this.id = findAvailableEntityID();

      // Clamp the game object's position to within the world
      if (this.position.x < 0) this.position.x = 0;
      if (this.position.x >= SettingsConst.BOARD_UNITS) this.position.x = SettingsConst.BOARD_UNITS - 1;
      if (this.position.y < 0) this.position.y = 0;
      if (this.position.y >= SettingsConst.BOARD_UNITS) this.position.y = SettingsConst.BOARD_UNITS - 1;

      this.updateTile();
      this.strictCheckIsInRiver();

      Board.addEntityToJoinBuffer(this);
   }

   public addHitbox(hitbox: RectangularHitbox | CircularHitbox): void {
      this.hitboxes.push(hitbox);
      this.totalMass += hitbox.mass;

      const boundsMinX = hitbox.calculateHitboxBoundsMinX();
      const boundsMaxX = hitbox.calculateHitboxBoundsMaxX();
      const boundsMinY = hitbox.calculateHitboxBoundsMinY();
      const boundsMaxY = hitbox.calculateHitboxBoundsMaxY();

      // Update bounding area
      if (boundsMinX < this.boundingAreaMinX) {
         this.boundingAreaMinX = boundsMinX;
      }
      if (boundsMaxX > this.boundingAreaMaxX) {
         this.boundingAreaMaxX = boundsMaxX;
      }
      if (boundsMinY < this.boundingAreaMinY) {
         this.boundingAreaMinY = boundsMinY;
      }
      if (boundsMaxY > this.boundingAreaMaxY) {
         this.boundingAreaMaxY = boundsMaxY;
      }

      // Update entity bounding area
      if (boundsMinX < this.boundingAreaMinX) {
         this.boundingAreaMinX = boundsMinX;
      }
      if (boundsMaxX > this.boundingAreaMaxX) {
         this.boundingAreaMaxX = boundsMaxX;
      }
      if (boundsMinY < this.boundingAreaMinY) {
         this.boundingAreaMinY = boundsMinY;
      }
      if (boundsMaxY > this.boundingAreaMaxY) {
         this.boundingAreaMaxY = boundsMaxY;
      }

      hitbox.chunkBounds[0] = Math.floor(boundsMinX / SettingsConst.CHUNK_UNITS);
      hitbox.chunkBounds[1] = Math.floor(boundsMaxX / SettingsConst.CHUNK_UNITS);
      hitbox.chunkBounds[2] = Math.floor(boundsMinY / SettingsConst.CHUNK_UNITS);
      hitbox.chunkBounds[3] = Math.floor(boundsMaxY / SettingsConst.CHUNK_UNITS);

      // If the hitbox is clipping into a border, clean the entities' position so that it doesn't clip
      if (boundsMinX < 0 || boundsMaxX >= SettingsConst.BOARD_UNITS || boundsMinY < 0 || boundsMaxY >= SettingsConst.BOARD_UNITS) {
         this.cleanHitboxes();
      }
   }

   /** Recalculates the game objects' bounding area, hitbox positions and bounds, and the hasPotentialWallTileCollisions flag */
   public cleanHitboxes(): void {
      this.boundingAreaMinX = Number.MAX_SAFE_INTEGER;
      this.boundingAreaMaxX = Number.MIN_SAFE_INTEGER;
      this.boundingAreaMinY = Number.MAX_SAFE_INTEGER;
      this.boundingAreaMaxY = Number.MIN_SAFE_INTEGER;

      // An object only changes their chunks if a hitboxes' bounds change chunks.
      let hitboxChunkBoundsHaveChanged = false;
      const numHitboxes = this.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         hitbox.updateOffset();
         // @Speed: This check is slow
         if (!hitbox.hasOwnProperty("radius")) {
            (hitbox as RectangularHitbox).updateVertexPositionsAndSideAxes();
         }

         const boundsMinX = hitbox.calculateHitboxBoundsMinX();
         const boundsMaxX = hitbox.calculateHitboxBoundsMaxX();
         const boundsMinY = hitbox.calculateHitboxBoundsMinY();
         const boundsMaxY = hitbox.calculateHitboxBoundsMaxY();

         // Update bounding area
         if (boundsMinX < this.boundingAreaMinX) {
            this.boundingAreaMinX = boundsMinX;
         }
         if (boundsMaxX > this.boundingAreaMaxX) {
            this.boundingAreaMaxX = boundsMaxX;
         }
         if (boundsMinY < this.boundingAreaMinY) {
            this.boundingAreaMinY = boundsMinY;
         }
         if (boundsMaxY > this.boundingAreaMaxY) {
            this.boundingAreaMaxY = boundsMaxY;
         }

         // Check if the hitboxes' chunk bounds have changed
         // @Speed
         // @Speed
         // @Speed
         if (!hitboxChunkBoundsHaveChanged) {
            const minChunkX = Math.floor(boundsMinX / SettingsConst.CHUNK_UNITS);
            const maxChunkX = Math.floor(boundsMaxX / SettingsConst.CHUNK_UNITS);
            const minChunkY = Math.floor(boundsMinY / SettingsConst.CHUNK_UNITS);
            const maxChunkY = Math.floor(boundsMaxY / SettingsConst.CHUNK_UNITS);

            if (minChunkX !== hitbox.chunkBounds[0] ||
                maxChunkX !== hitbox.chunkBounds[1] ||
                minChunkY !== hitbox.chunkBounds[2] ||
                maxChunkY !== hitbox.chunkBounds[3]) {
               hitboxChunkBoundsHaveChanged = true;

               hitbox.chunkBounds[0] = minChunkX;
               hitbox.chunkBounds[1] = maxChunkX;
               hitbox.chunkBounds[2] = minChunkY;
               hitbox.chunkBounds[3] = maxChunkY;
            }
         }
      }

      this.lastCleanedPosition.x = this.position.x;
      this.lastCleanedPosition.y = this.position.y;

      if (hitboxChunkBoundsHaveChanged) {
         this.updateContainingChunks();
      }
   }

   public updateHitboxes(): void {
      const shiftX = this.position.x - this.lastCleanedPosition.x;
      const shiftY = this.position.y - this.lastCleanedPosition.y;
      
      this.boundingAreaMinX += shiftX;
      this.boundingAreaMaxX += shiftX;
      this.boundingAreaMinY += shiftY;
      this.boundingAreaMaxY += shiftY;

      this.lastCleanedPosition.x = this.position.x;
      this.lastCleanedPosition.y = this.position.y;

      // @Speed
      // @Speed
      // @Speed

      let hitboxChunkBoundsHaveChanged = false;
      const numHitboxes = this.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         const boundsMinX = hitbox.calculateHitboxBoundsMinX();
         const boundsMaxX = hitbox.calculateHitboxBoundsMaxX();
         const boundsMinY = hitbox.calculateHitboxBoundsMinY();
         const boundsMaxY = hitbox.calculateHitboxBoundsMaxY();

         // Check if the hitboxes' chunk bounds have changed
         if (!hitboxChunkBoundsHaveChanged) {
            const minChunkX = Math.floor(boundsMinX / SettingsConst.CHUNK_UNITS);
            const maxChunkX = Math.floor(boundsMaxX / SettingsConst.CHUNK_UNITS);
            const minChunkY = Math.floor(boundsMinY / SettingsConst.CHUNK_UNITS);
            const maxChunkY = Math.floor(boundsMaxY / SettingsConst.CHUNK_UNITS);

            if (minChunkX !== hitbox.chunkBounds[0] ||
                maxChunkX !== hitbox.chunkBounds[1] ||
                minChunkY !== hitbox.chunkBounds[2] ||
                maxChunkY !== hitbox.chunkBounds[3]) {
               hitboxChunkBoundsHaveChanged = true;

               hitbox.chunkBounds[0] = minChunkX;
               hitbox.chunkBounds[1] = maxChunkX;
               hitbox.chunkBounds[2] = minChunkY;
               hitbox.chunkBounds[3] = maxChunkY;
            }
         }
      }

      if (hitboxChunkBoundsHaveChanged) {
         this.updateContainingChunks();
      }
   }

   public tick(): void {
      // @Cleanup: Maybe move to AgeComponent or something
      this.ageTicks++;
   }

   /** Updates the tile the object is on. */
   public updateTile(): void {
      const tileX = Math.floor(this.position.x / SettingsConst.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SettingsConst.TILE_SIZE);
      
      this.tile = Board.getTile(tileX, tileY);
   }

   public strictCheckIsInRiver(): void {
      if (this.tile.type !== TileTypeConst.water) {
         this.isInRiver = false;
         return;
      }

      if (PhysicsComponentArray.hasComponent(this)) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         if (!physicsComponent.isAffectedByFriction) {
            this.isInRiver = false;
            return;
         }
      }

      // If the game object is standing on a stepping stone they aren't in a river
      for (const chunk of this.chunks) {
         for (const steppingStone of chunk.riverSteppingStones) {
            const size = RIVER_STEPPING_STONE_SIZES[steppingStone.size];
            
            const distX = this.position.x - steppingStone.positionX;
            const distY = this.position.y - steppingStone.positionY;
            if (distX * distX + distY * distY <= size * size / 4) {
               this.isInRiver = false;
               return;
            }
         }
      }

      this.isInRiver = true;
   }

   public checkIsInRiver(): void {
      if (typeof this.tile === "undefined") {
         console.log("tile undefined???");
      }
      
      if (this.tile.type !== TileTypeConst.water) {
         this.isInRiver = false;
         return;
      }

      const physicsComponent = PhysicsComponentArray.getComponent(this.id);
      if (!physicsComponent.isAffectedByFriction) {
         this.isInRiver = false;
         return;
      }

      // If the game object is standing on a stepping stone they aren't in a river
      for (const chunk of this.chunks) {
         for (const steppingStone of chunk.riverSteppingStones) {
            const size = RIVER_STEPPING_STONE_SIZES[steppingStone.size];
            
            const distX = this.position.x - steppingStone.positionX;
            const distY = this.position.y - steppingStone.positionY;
            if (distX * distX + distY * distY <= size * size / 4) {
               this.isInRiver = false;
               return;
            }
         }
      }

      this.isInRiver = true;
   }

   public updateContainingChunks(): void {
      // Calculate containing chunks
      const containingChunks = new Array<Chunk>();
      for (let i = 0; i < this.hitboxes.length; i++) {
         const hitbox = this.hitboxes[i];

         const boundsMinX = hitbox.calculateHitboxBoundsMinX();
         const boundsMaxX = hitbox.calculateHitboxBoundsMaxX();
         const boundsMinY = hitbox.calculateHitboxBoundsMinY();
         const boundsMaxY = hitbox.calculateHitboxBoundsMaxY();

         const minChunkX = Math.max(Math.min(Math.floor(boundsMinX / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor(boundsMaxX / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor(boundsMinY / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor(boundsMaxY / SettingsConst.CHUNK_UNITS), SettingsConst.BOARD_SIZE - 1), 0);

         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = Board.getChunk(chunkX, chunkY);
               if (containingChunks.indexOf(chunk) === -1) {
                  containingChunks.push(chunk);
               }
            }
         }
      }

      // Add all new chunks
      for (let i = 0; i < containingChunks.length; i++) {
         const chunk = containingChunks[i];
         if (this.chunks.indexOf(chunk) === -1) {
            this.addToChunk(chunk);
            this.chunks.push(chunk);
         }
      }

      // Find all chunks which aren't present in the new chunks and remove them
      for (let i = 0; i < this.chunks.length; i++) {
         const chunk = this.chunks[i]
         if (containingChunks.indexOf(chunk) === -1) {
            this.removeFromChunk(chunk);
            this.chunks.splice(i, 1);
            i--;
         }
      }
   }

   protected addToChunk(chunk: Chunk): void {
      chunk.entities.push(this);

      const numViewingMobs = chunk.viewingEntities.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const viewingEntity = chunk.viewingEntities[i];
         const aiHelperComponent = AIHelperComponentArray.getComponent(viewingEntity.id);

         const idx = aiHelperComponent.potentialVisibleEntities.indexOf(this);
         if (idx === -1 && viewingEntity.id !== this.id) {
            aiHelperComponent.potentialVisibleEntities.push(this);
            aiHelperComponent.potentialVisibleEntityAppearances.push(1);
         } else {
            aiHelperComponent.potentialVisibleEntityAppearances[idx]++;
         }
      }
   }

   public removeFromChunk(chunk: Chunk): void {
      const idx = chunk.entities.indexOf(this);
      if (idx !== -1) {
         chunk.entities.splice(idx, 1);
      }

      // @Incomplete
      // Remove the entity from the potential visible entities of all entities viewing the chunk
      const numViewingMobs = chunk.viewingEntities.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const viewingEntity = chunk.viewingEntities[i];
         if (viewingEntity.id === this.id) {
            continue;
         }

         const aiHelperComponent = AIHelperComponentArray.getComponent(viewingEntity.id);

         const idx = aiHelperComponent.potentialVisibleEntities.indexOf(this);
         if (idx === -1) {
            throw new Error("Tried to remove entity from visible entities when it wasn't in it");
         }
         aiHelperComponent.potentialVisibleEntityAppearances[idx]--;
         if (aiHelperComponent.potentialVisibleEntityAppearances[idx] === 0) {
            aiHelperComponent.potentialVisibleEntities.splice(idx, 1);
            aiHelperComponent.potentialVisibleEntityAppearances.splice(idx, 1);

            const idx2 = aiHelperComponent.visibleEntities.indexOf(this);
            if (idx2 !== -1) {
               aiHelperComponent.visibleEntities.splice(idx2, 1);
            }
         }
      }
   }

   private checkForCircularTileCollision(tile: Tile, hitbox: CircularHitbox): TileCollisionAxis {
      // Get the distance between the player's position and the center of the tile
      const xDist = Math.abs(this.position.x - (tile.x + 0.5) * SettingsConst.TILE_SIZE);
      const yDist = Math.abs(this.position.y - (tile.y + 0.5) * SettingsConst.TILE_SIZE);

      if (xDist <= hitbox.radius) {
         return TileCollisionAxis.y;
      }
      if (yDist <= hitbox.radius) {
         return TileCollisionAxis.x;
      }

      const cornerDistance = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));

      if (cornerDistance <= Math.sqrt(Math.pow(SettingsConst.TILE_SIZE, 2) / 2) + hitbox.radius) {
         return TileCollisionAxis.diagonal;
      }

      return TileCollisionAxis.none;
   }

   private resolveXAxisCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const xDist = this.position.x - tile.x * SettingsConst.TILE_SIZE;
      const xDir = xDist >= 0 ? 1 : -1;
      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      this.position.x = tile.x * SettingsConst.TILE_SIZE + (0.5 + 0.5 * xDir) * SettingsConst.TILE_SIZE + (hitbox.radius + 0.0001) * xDir;
      this.velocity.x = 0;
   }

   private resolveYAxisCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const yDist = this.position.y - tile.y * SettingsConst.TILE_SIZE;
      const yDir = yDist >= 0 ? 1 : -1;
      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      this.position.y = tile.y * SettingsConst.TILE_SIZE + (0.5 + 0.5 * yDir) * SettingsConst.TILE_SIZE + (hitbox.radius + 0.0001) * yDir;
      this.velocity.y = 0;
   }

   private resolveDiagonalCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const xDist = this.position.x - tile.x * SettingsConst.TILE_SIZE;
      const yDist = this.position.y - tile.y * SettingsConst.TILE_SIZE;

      const xDir = xDist >= 0 ? 1 : -1;
      const yDir = yDist >= 0 ? 1 : -1;

      const xDistFromEdge = Math.abs(xDist - SettingsConst.TILE_SIZE/2);
      const yDistFromEdge = Math.abs(yDist - SettingsConst.TILE_SIZE/2);

      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      if (yDistFromEdge < xDistFromEdge) {
         this.position.x = (tile.x + 0.5 + 0.5 * xDir) * SettingsConst.TILE_SIZE + (hitbox.radius + 0.0001) * xDir;
         this.velocity.x = 0;
      } else {
         this.position.y = (tile.y + 0.5 + 0.5 * yDir) * SettingsConst.TILE_SIZE + (hitbox.radius + 0.0001) * yDir;
         this.velocity.y = 0;
      }
   }

   private checkForRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): TileCollisionAxis {
      // 
      // Check if any of the hitboxes' vertices are inside the tile
      // 

      const tileMinX = tile.x * SettingsConst.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SettingsConst.TILE_SIZE;
      const tileMinY = tile.y * SettingsConst.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SettingsConst.TILE_SIZE;

      for (let i = 0; i < 4; i++) {
         const vertex = hitbox.vertexOffsets[i];
         if (vertex.x >= tileMinX && vertex.x <= tileMaxX && vertex.y >= tileMinY && vertex.y <= tileMaxY) {
            const distX = Math.abs(this.position.x - (tile.x + 0.5) * SettingsConst.TILE_SIZE);
            const distY = Math.abs(this.position.y - (tile.y + 0.5) * SettingsConst.TILE_SIZE);

            if (distX >= distY) {
               return TileCollisionAxis.x;
            } else {
               return TileCollisionAxis.y;
            }
         }
      }

      // 
      // Check for diagonal collisions
      // 
      
      Entity.rectangularTestHitbox.width = SettingsConst.TILE_SIZE;
      Entity.rectangularTestHitbox.height = SettingsConst.TILE_SIZE;
      // @Incomplete(?): Do we need to update vertices and axes?
      Entity.rectangularTestHitbox.object.position.x = (tile.x + 0.5) * SettingsConst.TILE_SIZE;
      Entity.rectangularTestHitbox.object.position.y = (tile.y + 0.5) * SettingsConst.TILE_SIZE;

      if (Entity.rectangularTestHitbox.isColliding(hitbox)) {
         return TileCollisionAxis.diagonal;
      }

      return TileCollisionAxis.none;
   }

   private resolveXAxisRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const tileMinX = tile.x * SettingsConst.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SettingsConst.TILE_SIZE;
      const tileMinY = tile.y * SettingsConst.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SettingsConst.TILE_SIZE;

      let vertexPositionX = -99999;
      for (let i = 0; i < 4; i++) {
         const vertexOffset = hitbox.vertexOffsets[i];
         const vertexPosX = this.position.x + vertexOffset.x;
         const vertexPosY = this.position.y + vertexOffset.y;
         if (vertexPosX >= tileMinX && vertexPosX <= tileMaxX && vertexPosY >= tileMinY && vertexPosY <= tileMaxY) {
            vertexPositionX = vertexPosX;
            break;
         }
      }
      if (vertexPositionX === -99999) {
         throw new Error();
      }

      const startXDist = vertexPositionX - tile.x * SettingsConst.TILE_SIZE;
      const xDist = vertexPositionX - (tile.x + 0.5) * SettingsConst.TILE_SIZE;

      // Push left
      if (xDist < 0) {
         this.position.x -= startXDist;
      } else {
         // Push right
         this.position.x += SettingsConst.TILE_SIZE - startXDist;
      }
   }

   private resolveYAxisRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const tileMinX = tile.x * SettingsConst.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SettingsConst.TILE_SIZE;
      const tileMinY = tile.y * SettingsConst.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SettingsConst.TILE_SIZE;

      let vertexPositionY = -99999;
      for (let i = 0; i < 4; i++) {
         const vertexOffset = hitbox.vertexOffsets[i];
         const vertexPosX = this.position.x + vertexOffset.x;
         const vertexPosY = this.position.y + vertexOffset.y;
         if (vertexPosX >= tileMinX && vertexPosX <= tileMaxX && vertexPosY >= tileMinY && vertexPosY <= tileMaxY) {
            vertexPositionY = vertexPosY;
            break;
         }
      }
      if (vertexPositionY === -99999) {
         throw new Error();
      }

      const startYDist = vertexPositionY - tile.y * SettingsConst.TILE_SIZE;
      const yDist = vertexPositionY - (tile.y + 0.5) * SettingsConst.TILE_SIZE;

      // Push left
      if (yDist < 0) {
         this.position.y -= startYDist;
      } else {
         // Push right
         this.position.y += SettingsConst.TILE_SIZE - startYDist;
      }
   }

   private resolveDiagonalRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const vertexOffsetPairs: ReadonlyArray<[Point, Point]> = [
         [hitbox.vertexOffsets[0], hitbox.vertexOffsets[1]],
         [hitbox.vertexOffsets[1], hitbox.vertexOffsets[3]],
         [hitbox.vertexOffsets[3], hitbox.vertexOffsets[2]],
         [hitbox.vertexOffsets[2], hitbox.vertexOffsets[0]]
      ];

      const tileX1 = tile.x * SettingsConst.TILE_SIZE;
      const tileX2 = (tile.x + 1) * SettingsConst.TILE_SIZE;
      const tileY1 = tile.y * SettingsConst.TILE_SIZE;
      const tileY2 = (tile.y + 1) * SettingsConst.TILE_SIZE;

      let collidingVertex1!: Point;
      let collidingVertex2!: Point;
      
      for (const offsetPair of vertexOffsetPairs) {
         const leftPoint =   offsetPair[0].x < offsetPair[1].x ? offsetPair[0] : offsetPair[1];
         const rightPoint =  offsetPair[0].x < offsetPair[1].x ? offsetPair[1] : offsetPair[0];
         const bottomPoint = offsetPair[0].y < offsetPair[1].y ? offsetPair[0] : offsetPair[1];
         const topPoint =    offsetPair[0].y < offsetPair[1].y ? offsetPair[1] : offsetPair[0];

         if (offsetPair[0].x === offsetPair[1].x) {
            // Division by 0 error
            // @Incomplete: Do stuff
            return;
         }

         const leftPointX = leftPoint.x + this.position.x;
         const leftPointY = leftPoint.y + this.position.y;
         const rightPointX = rightPoint.x + this.position.x;
         const rightPointY = rightPoint.y + this.position.y;

         const slope = (rightPointY - leftPointY) / (rightPointX - leftPointX);

         // Check left projection
         if (leftPointX < tileX1) {
            const leftProjectionY = leftPointY + slope * (tileX1 - leftPointX);
            if (leftProjectionY >= tileY1 && leftProjectionY <= tileY2) {
               collidingVertex1 = offsetPair[0];
               collidingVertex2 = offsetPair[1];
               break;
            }
         }

         // Check right projection
         if (rightPointX > tileX2) {
            const rightProjectionY = rightPointY - slope * (rightPointX - tileX2);
            if (rightProjectionY >= tileY1 && rightProjectionY <= tileY2) {
               collidingVertex1 = offsetPair[0];
               collidingVertex2 = offsetPair[1];
               break;
            }
         }

         const topPointX = topPoint.x + this.position.x;
         const topPointY = topPoint.y + this.position.y;

         // Check top projection
         if (topPointY > tileY2) {
            const topProjectionX = topPointX + (topPointY - tileY2) / slope;
            if (topProjectionX >= tileX1 && topProjectionX <= tileX2) {
               collidingVertex1 = offsetPair[0];
               collidingVertex2 = offsetPair[1];
               break;
            }
         }

         const bottomPointX = bottomPoint.x + this.position.x;
         const bottomPointY = bottomPoint.y + this.position.y;

         // Check bottom projection
         if (bottomPointY < tileY1) {
            const bottomProjectionX = bottomPointX - (tileY2 - topPointY) / slope;
            if (bottomProjectionX >= tileX1 && bottomProjectionX <= tileX2) {
               collidingVertex1 = offsetPair[0];
               collidingVertex2 = offsetPair[1];
               break;
            }
         }
      }

      if (typeof collidingVertex1 === "undefined" || typeof collidingVertex2 === "undefined") {
         // @Incomplete: Couldn't find colliding vertex pair
         return;
      }

      const pairs2: ReadonlyArray<[number, number]> = [
         [tileX1, tileY1],
         [tileX2, tileY1],
         [tileX1, tileY2],
         [tileX2, tileY2]
      ];

      // Find point of tile in collision
      let tileVertexX!: number;
      let tileVertexY!: number;
      for (const pair of pairs2) {
         const tilePosX = this.position.x + hitbox.rotatedOffsetX;
         const tilePosY = this.position.y + hitbox.rotatedOffsetY;
         if (pointIsInRectangle(pair[0], pair[1], tilePosX, tilePosY, hitbox.width, hitbox.height, this.rotation + hitbox.rotation)) {
            tileVertexX = pair[0];
            tileVertexY = pair[1];
            break;
         }
      }
      if (typeof tileVertexX === "undefined") {
         // @Temporary
         // console.warn("Couldn't find vertex");
         return;
      }

      // @Speed: Garbage collection
      const distance = distToSegment(new Point(tileVertexX, tileVertexY), collidingVertex1, collidingVertex2);

      const pushDirection = collidingVertex1.calculateAngleBetween(collidingVertex2) + Math.PI / 2;

      this.position.x += distance * Math.sin(pushDirection);
      this.position.y += distance * Math.cos(pushDirection);
   }

   public resolveWallTileCollisions(): void {
      // Looser check that there are any wall tiles in any of the entities' chunks
      let hasWallTiles = false;
      for (let i = 0; i < this.chunks.length; i++) {
         const chunk = this.chunks[i];
         if (chunk.hasWallTiles) {
            hasWallTiles = true;
         }
      }
      if (!hasWallTiles) {
         return;
      }
      
      for (let i = 0; i < this.hitboxes.length; i++) {
         const hitbox = this.hitboxes[i];

         const boundsMinX = hitbox.calculateHitboxBoundsMinX();
         const boundsMaxX = hitbox.calculateHitboxBoundsMaxX();
         const boundsMinY = hitbox.calculateHitboxBoundsMinY();
         const boundsMaxY = hitbox.calculateHitboxBoundsMaxY();

         const minTileX = clampToBoardDimensions(Math.floor(boundsMinX / SettingsConst.TILE_SIZE));
         const maxTileX = clampToBoardDimensions(Math.floor(boundsMaxX / SettingsConst.TILE_SIZE));
         const minTileY = clampToBoardDimensions(Math.floor(boundsMinY / SettingsConst.TILE_SIZE));
         const maxTileY = clampToBoardDimensions(Math.floor(boundsMaxY / SettingsConst.TILE_SIZE));

         // @Cleanup: Combine the check and resolve functions into one

         // @Cleanup: bad, and a slow check
         if (hitbox.hasOwnProperty("radius")) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
               for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                  const tile = Board.getTile(tileX, tileY);
                  if (tile.isWall) {
                     const physicsComponent = PhysicsComponentArray.getComponent(this.id);
                     const collisionAxis = this.checkForCircularTileCollision(tile, hitbox as CircularHitbox);
                     switch (collisionAxis) {
                        case TileCollisionAxis.x: {
                           this.resolveXAxisCircularTileCollision(tile, hitbox as CircularHitbox);
                           break;
                        }
                        case TileCollisionAxis.y: {
                           this.resolveYAxisCircularTileCollision(tile, hitbox as CircularHitbox);
                           break;
                        }
                        case TileCollisionAxis.diagonal: {
                           this.resolveDiagonalCircularTileCollision(tile, hitbox as CircularHitbox);
                           break;
                        }
                     }
                     physicsComponent.positionIsDirty = true;
                  }
               }
            }
         } else {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
               for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                  const tile = Board.getTile(tileX, tileY);
                  if (tile.isWall) {
                     const physicsComponent = PhysicsComponentArray.getComponent(this.id);
                     const collisionAxis = this.checkForRectangularTileCollision(tile, hitbox as RectangularHitbox);
                     switch (collisionAxis) {
                        case TileCollisionAxis.x: {
                           this.resolveXAxisRectangularTileCollision(tile, hitbox as RectangularHitbox);
                           break;
                        }
                        case TileCollisionAxis.y: {
                           this.resolveYAxisRectangularTileCollision(tile, hitbox as RectangularHitbox);
                           break;
                        }
                        case TileCollisionAxis.diagonal: {
                           this.resolveDiagonalRectangularTileCollision(tile, hitbox as RectangularHitbox);
                           break;
                        }
                     }
                     physicsComponent.positionIsDirty = true;
                  }
               }
            }
         }
      }
   }
   
   public resolveBorderCollisions(): void {
      // Left border
      if (this.boundingAreaMinX < 0) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         this.position.x -= this.boundingAreaMinX;
         this.velocity.x = 0;
         physicsComponent.positionIsDirty = true;
         // Right border
      } else if (this.boundingAreaMaxX > SettingsConst.BOARD_UNITS) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         this.position.x -= this.boundingAreaMaxX - SettingsConst.BOARD_UNITS;
         this.velocity.x = 0;
         physicsComponent.positionIsDirty = true;
      }

      // Bottom border
      if (this.boundingAreaMinY < 0) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         this.position.y -= this.boundingAreaMinY;
         this.velocity.y = 0;
         physicsComponent.positionIsDirty = true;
         // Top border
      } else if (this.boundingAreaMaxY > SettingsConst.BOARD_UNITS) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         this.position.y -= this.boundingAreaMaxY - SettingsConst.BOARD_UNITS;
         this.velocity.y = 0;
         physicsComponent.positionIsDirty = true;
      }

      // @Temporary
      if (this.position.x < 0 || this.position.x >= SettingsConst.BOARD_UNITS || this.position.y < 0 || this.position.y >= SettingsConst.BOARD_UNITS) {
         console.log(this);
         throw new Error("Unable to properly resolve border collisions.");
      }
   }

   private resolveCircleRectangleCollision(circleHitbox: CircularHitbox, rectangularHitbox: RectangularHitbox): void {
      const rectRotation = rectangularHitbox.rotation + rectangularHitbox.object.rotation;

      const rectPosX = rectangularHitbox.object.position.x + rectangularHitbox.rotatedOffsetX;
      const rectPosY = rectangularHitbox.object.position.y + rectangularHitbox.rotatedOffsetY;
      
      const unrotatedCirclePosX = circleHitbox.object.position.x + circleHitbox.rotatedOffsetX;
      const unrotatedCirclePosY = circleHitbox.object.position.y + circleHitbox.rotatedOffsetY;
      const circlePosX = rotateXAroundPoint(unrotatedCirclePosX, unrotatedCirclePosY, rectPosX, rectPosY, -rectRotation);
      const circlePosY = rotateYAroundPoint(unrotatedCirclePosX, unrotatedCirclePosY, rectPosX, rectPosY, -rectRotation);
      
      const distanceX = circlePosX - rectPosX;
      const distanceY = circlePosY - rectPosY;

      const absDistanceX = Math.abs(distanceX);
      const absDistanceY = Math.abs(distanceY);

      // Top and bottom collisions
      if (absDistanceX <= (rectangularHitbox.width/2)) {
         const amountIn = absDistanceY - rectangularHitbox.height/2 - circleHitbox.radius;
         const offsetMagnitude = -amountIn * Math.sign(distanceY);

         this.position.x += offsetMagnitude * Math.sin(rectRotation);
         this.position.y += offsetMagnitude * Math.cos(rectRotation);

         const direction = rectRotation + Math.PI/2;
         const bx = Math.sin(direction);
         const by = Math.cos(direction);
         const projectionCoeff = (this.velocity.x * bx + this.velocity.y * by) / (bx * bx + by * by);
         this.velocity.x = bx * projectionCoeff;
         this.velocity.y = by * projectionCoeff;
         return;
      }

      // Left and right collisions
      if (absDistanceY <= (rectangularHitbox.height/2)) {
         const amountIn = absDistanceX - rectangularHitbox.width/2 - circleHitbox.radius;
         const offsetMagnitude = -amountIn * Math.sign(distanceX);

         this.position.x += offsetMagnitude * Math.sin(rectRotation + Math.PI/2);
         this.position.y += offsetMagnitude * Math.cos(rectRotation + Math.PI/2);

         const bx = Math.sin(rectRotation);
         const by = Math.cos(rectRotation);
         const projectionCoeff = (this.velocity.x * bx + this.velocity.y * by) / (bx * bx + by * by);
         this.velocity.x = bx * projectionCoeff;
         this.velocity.y = by * projectionCoeff;
         return;
      }

      const cornerDistanceSquared = Math.pow(absDistanceX - rectangularHitbox.width/2, 2) + Math.pow(absDistanceY - rectangularHitbox.height/2, 2);
      if (cornerDistanceSquared <= circleHitbox.radius * circleHitbox.radius) {
         // @Cleanup: Whole lot of copy and paste
         const amountInX = absDistanceX - rectangularHitbox.width/2 - circleHitbox.radius;
         const amountInY = absDistanceY - rectangularHitbox.height/2 - circleHitbox.radius;
         if (Math.abs(amountInY) < Math.abs(amountInX)) {
            const closestRectBorderY = circlePosY < rectPosY ? rectPosY - rectangularHitbox.height/2 : rectPosY + rectangularHitbox.height/2;
            
            const closestRectBorderX = circlePosX < rectPosX ? rectPosX - rectangularHitbox.width/2 : rectPosX + rectangularHitbox.width/2;
            const xDistanceFromRectBorder = Math.abs(closestRectBorderX - circlePosX);
            const len = Math.sqrt(circleHitbox.radius * circleHitbox.radius - xDistanceFromRectBorder * xDistanceFromRectBorder);

            const amountIn = Math.abs(closestRectBorderY - (circlePosY - len * Math.sign(distanceY)));
            const offsetMagnitude = amountIn * Math.sign(distanceY);
   
            this.position.x += offsetMagnitude * Math.sin(rectRotation);
            this.position.y += offsetMagnitude * Math.cos(rectRotation);
   
            const direction = rectRotation + Math.PI/2;
            const bx = Math.sin(direction);
            const by = Math.cos(direction);
            const projectionCoeff = (this.velocity.x * bx + this.velocity.y * by) / (bx * bx + by * by);
            this.velocity.x = bx * projectionCoeff;
            this.velocity.y = by * projectionCoeff;
         } else {
            const closestRectBorderX = circlePosX < rectPosX ? rectPosX - rectangularHitbox.width/2 : rectPosX + rectangularHitbox.width/2;
            
            const closestRectBorderY = circlePosY < rectPosY ? rectPosY - rectangularHitbox.height/2 : rectPosY + rectangularHitbox.height/2;
            const yDistanceFromRectBorder = Math.abs(closestRectBorderY - circlePosY);
            const len = Math.sqrt(circleHitbox.radius * circleHitbox.radius - yDistanceFromRectBorder * yDistanceFromRectBorder);

            const amountIn = Math.abs(closestRectBorderX - (circlePosX - len * Math.sign(distanceX)));
            const offsetMagnitude = amountIn * Math.sign(distanceX);
   
            this.position.x += offsetMagnitude * Math.sin(rectRotation + Math.PI/2);
            this.position.y += offsetMagnitude * Math.cos(rectRotation + Math.PI/2);
   
            const bx = Math.sin(rectRotation);
            const by = Math.cos(rectRotation);
            const projectionCoeff = (this.velocity.x * bx + this.velocity.y * by) / (bx * bx + by * by);
            this.velocity.x = bx * projectionCoeff;
            this.velocity.y = by * projectionCoeff;
         }
      }
   }

   private resolveRectangleRectangleCollision(hitbox: RectangularHitbox, collidingHitbox: RectangularHitbox): void {
      const offset1x = this.position.x + hitbox.rotatedOffsetX;
      const offset1y = this.position.y + hitbox.rotatedOffsetY;
      const offset2x = collidingHitbox.object.position.x + collidingHitbox.rotatedOffsetX;
      const offset2y = collidingHitbox.object.position.y + collidingHitbox.rotatedOffsetY;
      
      let minDiff = 99999.9;
      let minDiffAxis!: Point;
      let minDiffIsPositive = true;
      
      // main: hitbox1
      for (let i = 0; i < 2; i++) {
         // const axis = hitbox.sideAxes[i];
         // @Incomplete: THE SAME FOR 2!
         const axis = new Point(hitbox.axisX, hitbox.axisY);

         const min1 = findMinWithOffset(hitbox.vertexOffsets, offset1x, offset1y, axis);
         const max1 = findMaxWithOffset(hitbox.vertexOffsets, offset1x, offset1y, axis);
         const min2 = findMinWithOffset(collidingHitbox.vertexOffsets, offset2x, offset2y, axis);
         const max2 = findMaxWithOffset(collidingHitbox.vertexOffsets, offset2x, offset2y, axis);

         const isIntersection = min2 < max1 && min1 < max2;
         if (isIntersection) {
            const diff1 = max1 - min2;
            const diff2 = max2 - min1;

            if (diff1 < minDiff) {
               minDiff = diff1;
               minDiffAxis = axis;
               minDiffIsPositive = true;
            }
            if (diff2 < minDiff) {
               minDiff = diff2;
               minDiffAxis = axis;
               minDiffIsPositive = false;
            }
         }
      }

      for (let i = 0; i < 2; i++) {
         // const axis = hitbox.sideAxes[i];
         // @Incomplete: THE SAME FOR 2!
         const axis = new Point(hitbox.axisX, hitbox.axisY);

         const min1 = findMinWithOffset(hitbox.vertexOffsets, offset1x, offset1y, axis);
         const max1 = findMaxWithOffset(hitbox.vertexOffsets, offset1x, offset1y, axis);
         const min2 = findMinWithOffset(collidingHitbox.vertexOffsets, offset2x, offset2y, axis);
         const max2 = findMaxWithOffset(collidingHitbox.vertexOffsets, offset2x, offset2y, axis);

         const isIntersection = min2 < max1 && min1 < max2;
         if (isIntersection) {
            const diff1 = max1 - min2;
            const diff2 = max2 - min1;

            if (diff1 < minDiff) {
               minDiff = diff1;
               minDiffAxis = axis;
               minDiffIsPositive = true;
            }
            if (diff2 < minDiff) {
               minDiff = diff2;
               minDiffAxis = axis;
               minDiffIsPositive = false;
            }
         }
      }

      const diffMult = (minDiffIsPositive ? 1 : -1) * -1;

      this.position.x += minDiff * minDiffAxis.x * diffMult;
      this.position.y += minDiff * minDiffAxis.y * diffMult;

      // console.log(minDiff);
      // const direction = rectRotation + Math.PI/2;
      // const direction = minDiffAxis;
      // const bx = Math.sin(direction);
      // const by = Math.cos(direction);
      // const bx = minDiffAxis.x;
      // const by = minDiffAxis.y;
      // const projectionCoeff = (this.velocity.x * bx + this.velocity.y * by) / (bx * bx + by * by);
      // this.velocity.x = bx * projectionCoeff;
      // this.velocity.y = by * projectionCoeff;
   }

   private resolveCollisionHard(hitbox: Hitbox, collidingHitbox: Hitbox): void {
      // @Incomplete: Rectangle + rectangle, circle + circle
      
      if (hitbox.hasOwnProperty("radius") && !collidingHitbox.hasOwnProperty("radius")) {
         this.resolveCircleRectangleCollision(hitbox as CircularHitbox, collidingHitbox as RectangularHitbox);
      } else if (!hitbox.hasOwnProperty("radius") && collidingHitbox.hasOwnProperty("radius")) {
         this.resolveCircleRectangleCollision(collidingHitbox as CircularHitbox, hitbox as RectangularHitbox);
      } else if (!hitbox.hasOwnProperty("radius") && !collidingHitbox.hasOwnProperty("radius")) {
         this.resolveRectangleRectangleCollision(hitbox as RectangularHitbox, collidingHitbox as RectangularHitbox);
      }
   }

   private resolveCollisionSoft(collidingEntity: Entity, collidingHitbox: Hitbox): void {
      // @Bug @Incomplete: base the push force and distance on this hitbox not this entity

      // Calculate the force of the push
      // Force gets greater the closer together the objects are
      const collidingHitboxX = collidingEntity.position.x + collidingHitbox.rotatedOffsetX;
      const collidingHitboxY = collidingEntity.position.y + collidingHitbox.rotatedOffsetY;
      const distanceBetweenEntities = distance(this.position.x, this.position.y, collidingHitboxX, collidingHitboxY);
      const maxDistanceBetweenEntities = this.calculateMaxDistanceFromGameObject(collidingEntity);
      const dist = Math.max(distanceBetweenEntities / maxDistanceBetweenEntities, 0.1);
      
      // @Incomplete: Experiment with having a constant push force. Might be good
      const force = SettingsConst.ENTITY_PUSH_FORCE * SettingsConst.I_TPS / dist * collidingHitbox.mass / this.totalMass * collidingEntity.collisionPushForceMultiplier;
      const pushAngle = this.position.calculateAngleBetween(collidingEntity.position) + Math.PI;
      this.velocity.x += force * Math.sin(pushAngle);
      this.velocity.y += force * Math.cos(pushAngle);
   }

   /**
    * @returns A number where the first 8 bits hold the index of the entity's colliding hitbox, and the next 8 bits hold the index of the other entity's colliding hitbox
   */
   public isColliding(entity: Entity): number {
      if ((entity.collisionMask & this.collisionBit) === 0 || (this.collisionMask & entity.collisionBit) === 0) {
         return NO_COLLISION;
      }

      // AABB bounding area check
      if (this.boundingAreaMinX > entity.boundingAreaMaxX || // minX(1) > maxX(2)
          this.boundingAreaMaxX < entity.boundingAreaMinX || // maxX(1) < minX(2)
          this.boundingAreaMinY > entity.boundingAreaMaxY || // minY(1) > maxY(2)
          this.boundingAreaMaxY < entity.boundingAreaMinY) { // maxY(1) < minY(2)
         return NO_COLLISION;
      }
      
      // More expensive hitbox check
      const numHitboxes = this.hitboxes.length;
      const numOtherHitboxes = entity.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         for (let j = 0; j < numOtherHitboxes; j++) {
            const otherHitbox = entity.hitboxes[j];

            // If the objects are colliding, add the colliding object and this object
            if (hitbox.isColliding(otherHitbox)) {
               return i + (j << 8);
            }
         }
      }

      // If no hitboxes match, then they aren't colliding
      return NO_COLLISION;
   }

   public collide(collidingEntity: Entity, hitboxIdx: number, collidingHitboxIdx: number): void {
      if (PhysicsComponentArray.hasComponent(this)) {
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         if (!physicsComponent.ignoreCollisions) {
            const collidingHitbox = collidingEntity.hitboxes[collidingHitboxIdx];
   
            if (entityHasHardCollision(collidingEntity)) {
               const hitbox = this.hitboxes[hitboxIdx];
               this.resolveCollisionHard(hitbox, collidingHitbox);
            } else {
               this.resolveCollisionSoft(collidingEntity, collidingHitbox);
            }
         }
      }

      switch (this.type) {
         case IEntityType.player: onPlayerCollision(this, collidingEntity); break;
         case IEntityType.tribeWorker: onTribeWorkerCollision(this, collidingEntity); break;
         case IEntityType.iceSpikes: onIceSpikesCollision(this, collidingEntity); break;
         case IEntityType.iceShardProjectile: onIceShardCollision(this, collidingEntity); break;
         case IEntityType.cactus: onCactusCollision(this, collidingEntity); break;
         case IEntityType.zombie: onZombieCollision(this, collidingEntity); break;
         case IEntityType.slime: onSlimeCollision(this, collidingEntity); break;
         case IEntityType.woodenArrowProjectile: onWoodenArrowCollision(this, collidingEntity); break;
         case IEntityType.yeti: onYetiCollision(this, collidingEntity); break;
         case IEntityType.snowball: onSnowballCollision(this, collidingEntity); break;
         case IEntityType.frozenYeti: onFrozenYetiCollision(this, collidingEntity); break;
         case IEntityType.rockSpikeProjectile: onRockSpikeProjectileCollision(this, collidingEntity); break;
         case IEntityType.spearProjectile: onSpearProjectileCollision(this, collidingEntity); break;
         case IEntityType.slimeSpit: onSlimeSpitCollision(this, collidingEntity); break;
         case IEntityType.spitPoison: onSpitPoisonCollision(this, collidingEntity); break;
         case IEntityType.battleaxeProjectile: onBattleaxeProjectileCollision(this, collidingEntity); break;
         case IEntityType.iceArrow: onIceArrowCollision(this, collidingEntity); break;
         case IEntityType.pebblum: onPebblumCollision(this, collidingEntity); break;
         case IEntityType.golem: onGolemCollision(this, collidingEntity); break;
         case IEntityType.woodenSpikes: onWoodenSpikesCollision(this, collidingEntity); break;
         case IEntityType.punjiSticks: onPunjiSticksCollision(this, collidingEntity); break;
      }
   }

   private calculateMaxDistanceFromGameObject(gameObject: Entity): number {
      // @Speed
      
      let maxDist = 0;

      // Account for this object's hitboxes
      for (const hitbox of this.hitboxes) {
         if (hitbox.hasOwnProperty("radius")) {
            // Circular hitbox
            maxDist += (hitbox as CircularHitbox).radius;
         } else {
            // Rectangular hitbox
            // @Speed
            maxDist += Math.sqrt((hitbox as RectangularHitbox).width * (hitbox as RectangularHitbox).width / 4 + (hitbox as RectangularHitbox).height * (hitbox as RectangularHitbox).height / 4);
         }
      }

      // Account for the other object's hitboxes
      for (const hitbox of gameObject.hitboxes) {
         if (hitbox.hasOwnProperty("radius")) {
            // Circular hitbox
            maxDist += (hitbox as CircularHitbox).radius;
         } else {
            // Rectangular hitbox
            // @Speed
            maxDist += Math.sqrt((hitbox as RectangularHitbox).width * (hitbox as RectangularHitbox).width / 4 + (hitbox as RectangularHitbox).height * (hitbox as RectangularHitbox).height / 4);
         }
      }

      return maxDist;
   }

   public remove(): void {
      // @Temporary
      if (!Board.entityRecord.hasOwnProperty(this.id)) {
         throw new Error("Tried to remove an entity before it was added to the board.");
      }
      
      // Don't try to remove if already being removed
      if (Board.entityIsFlaggedForRemoval(this)) {
         return;
      }

      Board.addEntityToRemoveBuffer(this);
      Board.removeEntityFromJoinBuffer(this);

      switch (this.type) {
         case IEntityType.cow: {
            onCowDeath(this);
            break;
         }
         case IEntityType.tree: {
            onTreeDeath(this);
            break;
         }
         case IEntityType.krumblid: {
            onKrumblidDeath(this);
            break;
         }
         case IEntityType.iceSpikes: {
            onIceSpikesDeath(this);
            break;
         }
         case IEntityType.cactus: {
            onCactusDeath(this);
            break;
         }
         case IEntityType.tribeWorker: {
            onTribeWorkerDeath(this);
            break;
         }
         case IEntityType.tribeWarrior: {
            onTribeWarriorDeath(this);
            break;
         }
         case IEntityType.yeti: {
            onYetiDeath(this);
            break;
         }
         case IEntityType.fish: {
            onFishDeath(this);
            break;
         }
         case IEntityType.player: {
            onPlayerDeath(this);
            break;
         }
         case IEntityType.tribeTotem: {
            onTribeTotemDeath(this);
            break;
         }
         case IEntityType.slimeSpit: {
            onSlimeSpitDeath(this);
            break;
         }
         case IEntityType.battleaxeProjectile: {
            onBattleaxeProjectileDeath(this);
            break;
         }
      }
   }

   public getDebugData(): EntityDebugData {
      return {
         entityID: this.id,
         lines: [],
         circles: [],
         tileHighlights: [],
         debugEntries: []
      };
   }

   public turn(targetRotation: number, turnSpeed: number): void {
      if (this.shouldTurnClockwise(targetRotation)) {  
         this.rotation += turnSpeed / SettingsConst.TPS;
         if (!this.shouldTurnClockwise(targetRotation)) {
            this.rotation = targetRotation;
         } else if (this.rotation >= Math.PI * 2) {
            this.rotation -= Math.PI * 2;
         }
      } else {
         this.rotation -= turnSpeed / SettingsConst.TPS
         if (this.shouldTurnClockwise(targetRotation)) {
            this.rotation = targetRotation;
         } else if (this.rotation < 0) {
            this.rotation += Math.PI * 2;
         }
      }

      const physicsComponent = PhysicsComponentArray.getComponent(this.id);
      physicsComponent.hitboxesAreDirty = true;
   }

   protected shouldTurnClockwise(targetRotation: number): boolean {
      // @Temporary @Speed: instead of doing this, probably just clean rotation after all places which could dirty it
      this.cleanRotation();

      // @Hack
      if (targetRotation < 0) {
         targetRotation += 2 * Math.PI;
      }
      
      const clockwiseDist = (targetRotation - this.rotation + Math.PI * 2) % (Math.PI * 2);
      const anticlockwiseDist = (Math.PI * 2) - clockwiseDist;
      if (clockwiseDist < 0 || anticlockwiseDist < 0) {
         throw new Error("Either targetRotation or this.rotation wasn't in the 0-to-2-pi range. Target rotation: " + targetRotation + ", rotation: " + this.rotation);
      }
      return clockwiseDist < anticlockwiseDist;
   }

   protected cleanRotation(): void {
      const rotation = cleanAngle(this.rotation);
      if (rotation !== this.rotation) {
         this.rotation = rotation;
         
         const physicsComponent = PhysicsComponentArray.getComponent(this.id);
         physicsComponent.hitboxesAreDirty = true;
      }
   }
}

export default Entity;