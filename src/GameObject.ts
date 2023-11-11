import { GameObjectDebugData, Point, RIVER_STEPPING_STONE_SIZES, SETTINGS, TILE_FRICTIONS, TILE_MOVE_SPEED_MULTIPLIERS, TileType, TileTypeConst, TribeMemberAction, Vector, clampToBoardDimensions, distToSegment, distance, pointIsInRectangle, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import Tile from "./Tile";
import Chunk from "./Chunk";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Board from "./Board";
import CircularHitbox from "./hitboxes/CircularHitbox";
import Mob from "./entities/mobs/Mob";

const FRICTION_MULTIPLY_VALS = TILE_FRICTIONS.map(friction => {
   let multiplyVal = 1 / (1 + 3 / SETTINGS.TPS * friction);
   return multiplyVal;
});

const a = new Array<number>();
const b = new Array<number>();
for (let i = 0; i < 8; i++) {
   const angle = i / 4 * Math.PI;
   a.push(Math.sin(angle));
   b.push(Math.cos(angle));
}

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

export interface GameObjectEvents {
   on_destroy: () => void;
   enter_collision: (collidingGameObject: GameObject) => void;
   during_collision: (collidingGameObject: GameObject) => void;
   enter_entity_collision: (collidingEntity: Entity) => void;
   during_entity_collision: (collidingEntity: Entity) => void;
   during_dropped_item_collision: (droppedItem: DroppedItem) => void;
}

// @Cleanup: Remove this and just do all collision stuff in one function
enum TileCollisionAxis {
   none = 0,
   x = 1,
   y = 2,
   diagonal = 3
}

export type GameEvent<T extends GameObjectEvents, E extends keyof T> = T[E];

export type BoundingArea = [minX: number, maxX: number, minY: number, maxY: number];

/** A generic class for any object in the world which has hitbox(es) */
abstract class GameObject<EventsType extends GameObjectEvents = GameObjectEvents> {
   private static readonly rectangularTestHitbox = new RectangularHitbox();
   
   /** Unique identifier for each game object */
   public readonly id: number;

   public ageTicks = 0;

   /** Position of the object in the world */
   public position: Point;
   /** Velocity of the object */
   public velocity = new Point(0, 0);
   /** Acceleration of the object */
   public acceleration = new Point(0, 0);
   /** Limit to the object's velocity */
   public terminalVelocity = 0;

   /** Direction the object is facing in radians */
   public rotation = 0;

   /** Affects the force the game object experiences during collisions */
   public mass = 1;

   protected moveSpeedMultiplier = 1;

   public collisionPushForceMultiplier = 1;

   /** Set of all chunks the object is contained in */
   public chunks = new Set<Chunk>();

   /** The tile the object is currently standing on. */
   public tile!: Tile;

   /** All hitboxes attached to the game object */
   public hitboxes = new Array<RectangularHitbox | CircularHitbox>();

   public collidingObjectTicks = new Array<number>();
   public collidingObjects = new Array<GameObject>();
   
   protected abstract readonly events: { [E in keyof EventsType]: Array<GameEvent<EventsType, E>> };

   /** If true, the game object is flagged for deletion at the beginning of the next tick */
   public isRemoved = false;

   /** If this flag is set to true, then the game object will not be able to be moved */
   public isStatic = false;

   /** If set to false, the game object will not experience friction from moving over tiles. */
   public isAffectedByFriction = true;

   // @Incomplete: Make the following flags false by default and make sure the hitboxes and other stuff is correct when spawning in

   /** Whether the game object's position has changed during the current tick or not. Used during collision detection to avoid unnecessary collision checks */
   public positionIsDirty = true;

   /** Whether the game object's hitboxes' bounds have changed during the current tick or not. If true, marks the game object to have its hitboxes and containing chunks updated */
   public hitboxesAreDirty = false;
   
   /** Indicates whether the game object could potentially collide with a wall tile */
   public hasPotentialWallTileCollisions = false;

   public isInRiver: boolean;

   protected overrideMoveSpeedMultiplier = false;
   
   public boundingArea: BoundingArea = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

   public abstract readonly collisionBit: number;
   public abstract readonly collisionMask: number;

   constructor(position: Point) {
      this.position = position;

      this.id = findAvailableEntityID();

      // Clamp the game object's position to within the world
      if (this.position.x < 0) this.position.x = 0;
      if (this.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.x = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
      if (this.position.y < 0) this.position.y = 0;
      if (this.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.y = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;

      this.updateTile();
      this.isInRiver = this.checkIsInRiver();
   }

   public abstract callCollisionEvent(gameObject: GameObject): void;
   public abstract addToMobVisibleGameObjects(mob: Mob): void;

   public addHitbox(hitbox: RectangularHitbox | CircularHitbox): void {
      this.hitboxes.push(hitbox);
      
      // Calculate initial position and hitbox bounds for the hitbox as it is not guaranteed that they are updated the immediate tick after
      hitbox.updateFromGameObject(this);
      hitbox.updateHitboxBounds(this.rotation);

      // Update bounding area
      if (hitbox.bounds[0] < this.boundingArea[0]) {
         this.boundingArea[0] = hitbox.bounds[0];
      }
      if (hitbox.bounds[1] > this.boundingArea[1]) {
         this.boundingArea[1] = hitbox.bounds[1];
      }
      if (hitbox.bounds[2] < this.boundingArea[2]) {
         this.boundingArea[2] = hitbox.bounds[2];
      }
      if (hitbox.bounds[3] > this.boundingArea[3]) {
         this.boundingArea[3] = hitbox.bounds[3];
      }

      // Flag if the hitbox could be in a wall
      const minTileX = clampToBoardDimensions(Math.floor(hitbox.bounds[0] / SETTINGS.TILE_SIZE));
      const maxTileX = clampToBoardDimensions(Math.floor(hitbox.bounds[1] / SETTINGS.TILE_SIZE));
      const minTileY = clampToBoardDimensions(Math.floor(hitbox.bounds[2] / SETTINGS.TILE_SIZE));
      const maxTileY = clampToBoardDimensions(Math.floor(hitbox.bounds[3] / SETTINGS.TILE_SIZE));
      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            const tile = Board.getTile(tileX, tileY);
            if (tile.isWall) {
               this.hasPotentialWallTileCollisions = true;
            }
         }
      }
   }

   public updateHitboxesAndBoundingArea(): void {
      this.boundingArea[0] = Number.MAX_SAFE_INTEGER;
      this.boundingArea[1] = Number.MIN_SAFE_INTEGER;
      this.boundingArea[2] = Number.MAX_SAFE_INTEGER;
      this.boundingArea[3] = Number.MIN_SAFE_INTEGER;

      const numHitboxes = this.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         hitbox.updateFromGameObject(this);
         hitbox.updateHitboxBounds(this.rotation);

         // Update bounding area
         if (hitbox.bounds[0] < this.boundingArea[0]) {
            this.boundingArea[0] = hitbox.bounds[0];
         }
         if (hitbox.bounds[1] > this.boundingArea[1]) {
            this.boundingArea[1] = hitbox.bounds[1];
         }
         if (hitbox.bounds[2] < this.boundingArea[2]) {
            this.boundingArea[2] = hitbox.bounds[2];
         }
         if (hitbox.bounds[3] > this.boundingArea[3]) {
            this.boundingArea[3] = hitbox.bounds[3];
         }
      }

      this.positionIsDirty = false;
   }

   public cleanHitboxes(): void {
      this.boundingArea[0] = Number.MAX_SAFE_INTEGER;
      this.boundingArea[1] = Number.MIN_SAFE_INTEGER;
      this.boundingArea[2] = Number.MAX_SAFE_INTEGER;
      this.boundingArea[3] = Number.MIN_SAFE_INTEGER;

      // An object only changes their chunks if a hitboxes' bounds change chunks.
      let hitboxChunkBoundsHaveChanged = false;
      const numHitboxes = this.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         // Find new hitbox bounds
         if (this.positionIsDirty) {
            hitbox.updateFromGameObject(this);
         }
         hitbox.updateHitboxBounds(this.rotation);

         // Update bounding area
         if (hitbox.bounds[0] < this.boundingArea[0]) {
            this.boundingArea[0] = hitbox.bounds[0];
         }
         if (hitbox.bounds[1] > this.boundingArea[1]) {
            this.boundingArea[1] = hitbox.bounds[1];
         }
         if (hitbox.bounds[2] < this.boundingArea[2]) {
            this.boundingArea[2] = hitbox.bounds[2];
         }
         if (hitbox.bounds[3] > this.boundingArea[3]) {
            this.boundingArea[3] = hitbox.bounds[3];
         }

         // Check if the hitboxes' chunk bounds have changed
         if (!hitboxChunkBoundsHaveChanged) {
            if (Math.floor(hitbox.previousBounds[0] / SETTINGS.CHUNK_UNITS) !== Math.floor(hitbox.bounds[0] / SETTINGS.CHUNK_UNITS) ||
                Math.floor(hitbox.previousBounds[1] / SETTINGS.CHUNK_UNITS) !== Math.floor(hitbox.bounds[1] / SETTINGS.CHUNK_UNITS) ||
                Math.floor(hitbox.previousBounds[2] / SETTINGS.CHUNK_UNITS) !== Math.floor(hitbox.bounds[2] / SETTINGS.CHUNK_UNITS) ||
                Math.floor(hitbox.previousBounds[3] / SETTINGS.CHUNK_UNITS) !== Math.floor(hitbox.bounds[3] / SETTINGS.CHUNK_UNITS)) {
               hitboxChunkBoundsHaveChanged = true;
            }
         }
         
         hitbox.previousBounds[0] = hitbox.bounds[0];
         hitbox.previousBounds[1] = hitbox.bounds[1];
         hitbox.previousBounds[2] = hitbox.bounds[2];
         hitbox.previousBounds[3] = hitbox.bounds[3];
      }

      if (hitboxChunkBoundsHaveChanged) {
         this.updateContainingChunks();

         // If there are any wall tiles in the game object's bounds, mark that it could potentially collide with them

         const minTileX = Math.max(Math.min(Math.floor(this.boundingArea[0] / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
         const maxTileX = Math.max(Math.min(Math.floor(this.boundingArea[1] / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
         const minTileY = Math.max(Math.min(Math.floor(this.boundingArea[2] / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
         const maxTileY = Math.max(Math.min(Math.floor(this.boundingArea[3] / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
         
         this.hasPotentialWallTileCollisions = false;
         for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
            for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
               const tile = Board.getTile(tileX, tileY);
               if (tile.isWall) {
                  this.hasPotentialWallTileCollisions = true;
               }
            }
         }
      }

      this.hitboxesAreDirty = false;
   }

   public tick(): void {
      this.ageTicks++;

      this.applyPhysics();
   }

   /** Updates the tile the object is on. */
   public updateTile(): void {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);

      this.tile = Board.getTile(tileX, tileY);
   }

   public checkIsInRiver(): boolean {
      if (this.tile.type !== TileTypeConst.water || !this.isAffectedByFriction) {
         return false;
      }

      // If the game object is standing on a stepping stone they aren't in a river
      for (const chunk of this.chunks) {
         for (const steppingStone of chunk.riverSteppingStones) {
            const size = RIVER_STEPPING_STONE_SIZES[steppingStone.size];
            
            const dist = distance(this.position.x, this.position.y, steppingStone.positionX, steppingStone.positionY);
            if (dist <= size/2) {
               return false;
            }
         }
      }

      return true;
   }

   public applyPhysics(): void {
      let tileFrictionReduceAmount: number;
      
      // Friction
      if (this.isAffectedByFriction && (this.velocity.x !== 0 || this.velocity.y !== 0)) {
         // @Speed
         const amountBefore = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
         const divideAmount = 1 + 3 / SETTINGS.TPS * TILE_FRICTIONS[this.tile.type];
         this.velocity.x /= divideAmount;
         this.velocity.y /= divideAmount;
         tileFrictionReduceAmount = amountBefore - Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
      } else {
         tileFrictionReduceAmount = 0;
      }
      
      // Accelerate
      if (this.acceleration.x !== 0 || this.acceleration.y !== 0) {
         let moveSpeedMultiplier: number;
         if (this.overrideMoveSpeedMultiplier) {
            moveSpeedMultiplier = 1;
         } else if (this.tile.type === TileTypeConst.water && !this.isInRiver) {
            moveSpeedMultiplier = this.moveSpeedMultiplier;
         } else {
            moveSpeedMultiplier = TILE_MOVE_SPEED_MULTIPLIERS[this.tile.type] * this.moveSpeedMultiplier;
         }
   
         const terminalVelocity = this.terminalVelocity * moveSpeedMultiplier;

         const friction = TILE_FRICTIONS[this.tile.type];
         let accelerateAmountX = this.acceleration.x * friction * moveSpeedMultiplier / SETTINGS.TPS;
         let accelerateAmountY = this.acceleration.y * friction * moveSpeedMultiplier / SETTINGS.TPS;

         const velocityMagnitude = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);

         // Make acceleration slow as the game object reaches its terminal velocity
         if (velocityMagnitude < terminalVelocity) {
            const progressToTerminalVelocity = velocityMagnitude / terminalVelocity;
            accelerateAmountX *= 1 - Math.pow(progressToTerminalVelocity, 2);
            accelerateAmountY *= 1 - Math.pow(progressToTerminalVelocity, 2);
         }

         // @Speed
         const accelerateAmountLength = Math.sqrt(Math.pow(accelerateAmountX, 2) + Math.pow(accelerateAmountY, 2));
         accelerateAmountX += tileFrictionReduceAmount * accelerateAmountX / accelerateAmountLength;
         accelerateAmountY += tileFrictionReduceAmount * accelerateAmountY / accelerateAmountLength;
         
         // Add acceleration to velocity
         this.velocity.x += accelerateAmountX;
         this.velocity.y += accelerateAmountY;
         
         // Don't accelerate past terminal velocity
          // @Speed
         const newVelocityMagnitude = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
         if (newVelocityMagnitude > terminalVelocity && newVelocityMagnitude > velocityMagnitude) {
            if (velocityMagnitude < terminalVelocity) {
               this.velocity.x *= terminalVelocity / newVelocityMagnitude;
               this.velocity.y *= terminalVelocity / newVelocityMagnitude;
            } else {
               this.velocity.x *= velocityMagnitude / newVelocityMagnitude;
               this.velocity.y *= velocityMagnitude / newVelocityMagnitude;
            }
         }
      // Friction
      } else if (this.velocity.x !== 0 || this.velocity.y !== 0) {
         // 
         // Apply friction
         // 

         const xSignBefore = Math.sign(this.velocity.x);
         
         // @Speed
         const velocityLength = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
         this.velocity.x = (velocityLength - 3) * this.velocity.x / velocityLength;
         this.velocity.y = (velocityLength - 3) * this.velocity.y / velocityLength;
         if (Math.sign(this.velocity.x) !== xSignBefore) {
            this.velocity.x = 0;
            this.velocity.y = 0;
         }
      }

      // If the game object is in a river, push them in the flow direction of the river
      // The tileMoveSpeedMultiplier check is so that game objects on stepping stones aren't pushed
      if (this.isInRiver && this.isInRiver && !this.overrideMoveSpeedMultiplier) {
         const flowDirection = this.tile.riverFlowDirection;
         this.velocity.x += 240 / SETTINGS.TPS * a[flowDirection];
         this.velocity.y += 240 / SETTINGS.TPS * b[flowDirection];
      }

      if (this.velocity.x !== 0 || this.velocity.y !== 0) {
         // Apply velocity
         this.position.x += this.velocity.x / SETTINGS.TPS;
         this.position.y += this.velocity.y / SETTINGS.TPS;

         this.positionIsDirty = true;
         this.hitboxesAreDirty = true;
      }
   }

   public updateContainingChunks(): void {
      // Calculate containing chunks
      const containingChunks = new Set<Chunk>();
      for (const hitbox of this.hitboxes) {
         const minChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[0] / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[1] / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[2] / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[3] / SETTINGS.CHUNK_UNITS), SETTINGS.BOARD_SIZE - 1), 0);

         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = Board.getChunk(chunkX, chunkY);
               if (!containingChunks.has(chunk)) {
                  containingChunks.add(chunk);
               }
            }
         }
      }

      // Find all chunks which aren't present in the new chunks and remove them
      for (const chunk of this.chunks) {
         if (!containingChunks.has(chunk)) {
            this.removeFromChunk(chunk);
            this.chunks.delete(chunk);
         }
      }

      // Add all new chunks
      for (const chunk of containingChunks) {
         if (!this.chunks.has(chunk)) {
            this.addToChunk(chunk);
            this.chunks.add(chunk);
         }
      }
   }

   protected addToChunk(chunk: Chunk): void {
      chunk.gameObjects.push(this);

      const numViewingMobs = chunk.viewingMobs.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const mob = chunk.viewingMobs[i];
         const idx = mob.potentialVisibleGameObjects.indexOf(this);
         if (idx === -1) {
            mob.potentialVisibleGameObjects.push(this);
            mob.potentialVisibleGameObjectAppearances.push(1);
         } else {
            mob.potentialVisibleGameObjectAppearances[idx]++;
         }
      }
   }

   public removeFromChunk(chunk: Chunk): void {
      const idx = chunk.gameObjects.indexOf(this);
      if (idx !== -1) {
         chunk.gameObjects.splice(idx, 1);
      }

      const numViewingMobs = chunk.viewingMobs.length;
      for (let i = 0; i < numViewingMobs; i++) {
         const mob = chunk.viewingMobs[i];
         const idx = mob.potentialVisibleGameObjects.indexOf(this);
         if (idx === -1) {
            throw new Error();
         }
         mob.potentialVisibleGameObjectAppearances[idx]--;
         if (mob.potentialVisibleGameObjectAppearances[idx] === 0) {
            mob.potentialVisibleGameObjects.splice(idx, 1);
            mob.potentialVisibleGameObjectAppearances.splice(idx, 1);
         }
      }
   }

   private checkForCircularTileCollision(tile: Tile, hitbox: CircularHitbox): TileCollisionAxis {
      // Get the distance between the player's position and the center of the tile
      const xDist = Math.abs(this.position.x - (tile.x + 0.5) * SETTINGS.TILE_SIZE);
      const yDist = Math.abs(this.position.y - (tile.y + 0.5) * SETTINGS.TILE_SIZE);

      if (xDist <= hitbox.radius) {
         return TileCollisionAxis.y;
      }
      if (yDist <= hitbox.radius) {
         return TileCollisionAxis.x;
      }

      const cornerDistance = Math.sqrt(Math.pow(xDist, 2) + Math.pow(yDist, 2));

      if (cornerDistance <= Math.sqrt(Math.pow(SETTINGS.TILE_SIZE, 2) / 2) + hitbox.radius) {
         return TileCollisionAxis.diagonal;
      }

      return TileCollisionAxis.none;
   }

   private resolveXAxisCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const xDist = this.position.x - tile.x * SETTINGS.TILE_SIZE;
      const xDir = xDist >= 0 ? 1 : -1;
      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      this.position.x = tile.x * SETTINGS.TILE_SIZE + (0.5 + 0.5 * xDir) * SETTINGS.TILE_SIZE + (hitbox.radius + 0.0001) * xDir;
      this.velocity.x = 0;
   }

   private resolveYAxisCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const yDist = this.position.y - tile.y * SETTINGS.TILE_SIZE;
      const yDir = yDist >= 0 ? 1 : -1;
      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      this.position.y = tile.y * SETTINGS.TILE_SIZE + (0.5 + 0.5 * yDir) * SETTINGS.TILE_SIZE + (hitbox.radius + 0.0001) * yDir;
      this.velocity.y = 0;
   }

   private resolveDiagonalCircularTileCollision(tile: Tile, hitbox: CircularHitbox): void {
      const xDist = this.position.x - tile.x * SETTINGS.TILE_SIZE;
      const yDist = this.position.y - tile.y * SETTINGS.TILE_SIZE;

      const xDir = xDist >= 0 ? 1 : -1;
      const yDir = yDist >= 0 ? 1 : -1;

      const xDistFromEdge = Math.abs(xDist - SETTINGS.TILE_SIZE/2);
      const yDistFromEdge = Math.abs(yDist - SETTINGS.TILE_SIZE/2);

      // The 0.0001 epsilon value is used so that the game object isn't put exactly on the border between tiles
      // We don't use Number.EPSILON because it doesn't work in some cases
      if (yDistFromEdge < xDistFromEdge) {
         this.position.x = (tile.x + 0.5 + 0.5 * xDir) * SETTINGS.TILE_SIZE + (hitbox.radius + 0.0001) * xDir;
         this.velocity.x = 0;
      } else {
         this.position.y = (tile.y + 0.5 + 0.5 * yDir) * SETTINGS.TILE_SIZE + (hitbox.radius + 0.0001) * yDir;
         this.velocity.y = 0;
      }
   }

   private checkForRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): TileCollisionAxis {
      // 
      // Check if any of the hitboxes' vertices are inside the tile
      // 

      const tileMinX = tile.x * SETTINGS.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SETTINGS.TILE_SIZE;
      const tileMinY = tile.y * SETTINGS.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SETTINGS.TILE_SIZE;

      for (let i = 0; i < 4; i++) {
         const vertex = hitbox.vertexPositions[i];
         if (vertex.x >= tileMinX && vertex.x <= tileMaxX && vertex.y >= tileMinY && vertex.y <= tileMaxY) {
            const distX = Math.abs(this.position.x - (tile.x + 0.5) * SETTINGS.TILE_SIZE);
            const distY = Math.abs(this.position.y - (tile.y + 0.5) * SETTINGS.TILE_SIZE);

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
      
      GameObject.rectangularTestHitbox.setHitboxInfo(SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE);
      GameObject.rectangularTestHitbox.position = new Point((tile.x + 0.5) * SETTINGS.TILE_SIZE, (tile.y + 0.5) * SETTINGS.TILE_SIZE);
      GameObject.rectangularTestHitbox.updateHitboxBounds(0);

      if (GameObject.rectangularTestHitbox.isColliding(hitbox)) {
         return TileCollisionAxis.diagonal;
      }

      return TileCollisionAxis.none;
   }

   private resolveXAxisRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const tileMinX = tile.x * SETTINGS.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SETTINGS.TILE_SIZE;
      const tileMinY = tile.y * SETTINGS.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SETTINGS.TILE_SIZE;

      let vertexPosition: Point | undefined;
      for (let i = 0; i < 4; i++) {
         const vertex = hitbox.vertexPositions[i];
         if (vertex.x >= tileMinX && vertex.x <= tileMaxX && vertex.y >= tileMinY && vertex.y <= tileMaxY) {
            vertexPosition = vertex;
            break;
         }
      }
      if (typeof vertexPosition === "undefined") {
         throw new Error();
      }

      const startXDist = vertexPosition.x - tile.x * SETTINGS.TILE_SIZE;
      const xDist = vertexPosition.x - (tile.x + 0.5) * SETTINGS.TILE_SIZE;

      // Push left
      if (xDist < 0) {
         this.position.x -= startXDist;
      } else {
         // Push right
         this.position.x += SETTINGS.TILE_SIZE - startXDist;
      }
   }

   private resolveYAxisRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const tileMinX = tile.x * SETTINGS.TILE_SIZE;
      const tileMaxX = (tile.x + 1) * SETTINGS.TILE_SIZE;
      const tileMinY = tile.y * SETTINGS.TILE_SIZE;
      const tileMaxY = (tile.y + 1) * SETTINGS.TILE_SIZE;

      let vertexPosition: Point | undefined;
      for (let i = 0; i < 4; i++) {
         const vertex = hitbox.vertexPositions[i];
         if (vertex.x >= tileMinX && vertex.x <= tileMaxX && vertex.y >= tileMinY && vertex.y <= tileMaxY) {
            vertexPosition = vertex;
            break;
         }
      }
      if (typeof vertexPosition === "undefined") {
         throw new Error();
      }

      const startYDist = vertexPosition.y - tile.y * SETTINGS.TILE_SIZE;
      const yDist = vertexPosition.y - (tile.y + 0.5) * SETTINGS.TILE_SIZE;

      // Push left
      if (yDist < 0) {
         this.position.y -= startYDist;
      } else {
         // Push right
         this.position.y += SETTINGS.TILE_SIZE - startYDist;
      }
   }

   private resolveDiagonalRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      const pairs: ReadonlyArray<[Point, Point]> = [
         [hitbox.vertexPositions[0], hitbox.vertexPositions[1]],
         [hitbox.vertexPositions[1], hitbox.vertexPositions[3]],
         [hitbox.vertexPositions[3], hitbox.vertexPositions[2]],
         [hitbox.vertexPositions[2], hitbox.vertexPositions[0]]
      ];

      const tileX1 = tile.x * SETTINGS.TILE_SIZE;
      const tileX2 = (tile.x + 1) * SETTINGS.TILE_SIZE;
      const tileY1 = tile.y * SETTINGS.TILE_SIZE;
      const tileY2 = (tile.y + 1) * SETTINGS.TILE_SIZE;

      let collidingVertex1!: Point;
      let collidingVertex2!: Point;
      
      for (const pair of pairs) {
         const leftPoint =   pair[0].x < pair[1].x ? pair[0] : pair[1];
         const rightPoint =  pair[0].x < pair[1].x ? pair[1] : pair[0];
         const bottomPoint = pair[0].y < pair[1].y ? pair[0] : pair[1];
         const topPoint =    pair[0].y < pair[1].y ? pair[1] : pair[0];

         if (pair[0].x === pair[1].x) {
            throw new Error();
         }

         const slope = (rightPoint.y - leftPoint.y) / (rightPoint.x - leftPoint.x);

         // Check left projection
         if (leftPoint.x < tileX1) {
            const leftProjectionY = leftPoint.y + slope * (tileX1 - leftPoint.x);
            if (leftProjectionY >= tileY1 && leftProjectionY <= tileY2) {
               collidingVertex1 = pair[0];
               collidingVertex2 = pair[1];
               break;
            }
         }

         // Check right projection
         if (rightPoint.x > tileX2) {
            const rightProjectionY = rightPoint.y - slope * (rightPoint.x - tileX2);
            if (rightProjectionY >= tileY1 && rightProjectionY <= tileY2) {
               collidingVertex1 = pair[0];
               collidingVertex2 = pair[1];
               break;
            }
         }

         // Check top projection
         if (topPoint.y > tileY2) {
            const topProjectionX = topPoint.x + (topPoint.y - tileY2) / slope;
            if (topProjectionX >= tileX1 && topProjectionX <= tileX2) {
               collidingVertex1 = pair[0];
               collidingVertex2 = pair[1];
               break;
            }
         }

         // Check bottom projection
         if (bottomPoint.y < tileY1) {
            const bottomProjectionX = bottomPoint.x - (tileY2 - topPoint.y) / slope;
            if (bottomProjectionX >= tileX1 && bottomProjectionX <= tileX2) {
               collidingVertex1 = pair[0];
               collidingVertex2 = pair[1];
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
         if (pointIsInRectangle(pair[0], pair[1], hitbox.position, hitbox.width, hitbox.height, this.rotation + hitbox.rotation)) {
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
      for (const hitbox of this.hitboxes) {
         const minTileX = clampToBoardDimensions(Math.floor(hitbox.bounds[0] / SETTINGS.TILE_SIZE));
         const maxTileX = clampToBoardDimensions(Math.floor(hitbox.bounds[1] / SETTINGS.TILE_SIZE));
         const minTileY = clampToBoardDimensions(Math.floor(hitbox.bounds[2] / SETTINGS.TILE_SIZE));
         const maxTileY = clampToBoardDimensions(Math.floor(hitbox.bounds[3] / SETTINGS.TILE_SIZE));

         // @Cleanup: Combine the check and resolve functions into one

         // @Cleanup: bad, and a slow check
         if (hitbox.hasOwnProperty("radius")) {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
               for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                  const tile = Board.getTile(tileX, tileY);
                  if (tile.isWall) {
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
                     this.positionIsDirty = true;
                  }
               }
            }
         } else {
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
               for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                  const tile = Board.getTile(tileX, tileY);
                  if (tile.isWall) {
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
                     this.positionIsDirty = true;
                  }
               }
            }
         }
      }
   }
   
   public resolveBorderCollisions(): void {
      // Left border
      if (this.boundingArea[0] < 0) {
         this.position.x -= this.boundingArea[0];
         this.velocity.x = 0;
         this.positionIsDirty = true;
         this.hitboxesAreDirty = true;
         // Right border
      } else if (this.boundingArea[1] > SETTINGS.BOARD_UNITS) {
         this.position.x -= this.boundingArea[1] - SETTINGS.BOARD_UNITS;
         this.velocity.x = 0;
         this.positionIsDirty = true;
         this.hitboxesAreDirty = true;
      }

      // Bottom border
      if (this.boundingArea[2] < 0) {
         this.position.y -= this.boundingArea[2];
         this.velocity.y = 0;
         this.positionIsDirty = true;
         this.hitboxesAreDirty = true;
         // Top border
      } else if (this.boundingArea[3] > SETTINGS.BOARD_UNITS) {
         this.position.y -= this.boundingArea[3] - SETTINGS.BOARD_UNITS;
         this.velocity.y = 0;
         this.positionIsDirty = true;
         this.hitboxesAreDirty = true;
      }

      if (this.position.x < 0 || this.position.x >= SETTINGS.BOARD_UNITS || this.position.y < 0 || this.position.y >= SETTINGS.BOARD_UNITS) {
         console.log(this.hitboxes.map(hitbox => hitbox.bounds));
         console.log(this.boundingArea);
         console.log(this.position.x, this.position.y);
         throw new Error("Unable to properly resolve wall collisions.");
      }
   }

   public isColliding(gameObject: GameObject): boolean {
      // AABB bounding area check
      if (this.boundingArea[0] > gameObject.boundingArea[1] || // minX(1) > maxX(2)
          this.boundingArea[1] < gameObject.boundingArea[0] || // maxX(1) < minX(2)
          this.boundingArea[2] > gameObject.boundingArea[3] || // minY(1) > maxY(2)
          this.boundingArea[3] < gameObject.boundingArea[2]) { // maxY(1) < minY(2)
         return false;
      }
      
      // More expensive hitbox check
      const numHitboxes = this.hitboxes.length;
      for (let i = 0; i < numHitboxes; i++) {
         const hitbox = this.hitboxes[i];

         const numOtherHitboxes = gameObject.hitboxes.length;
         for (let i = 0; i < numOtherHitboxes; i++) {
            const otherHitbox = gameObject.hitboxes[i];
            // If the objects are colliding, add the colliding object and this object
            if (hitbox.isColliding(otherHitbox)) {
               return true;
            }
         }
      }
      return false;
   }

   public collide(gameObject: GameObject): void {
      if ((gameObject.collisionMask & this.collisionBit) === 0 || (this.collisionMask & gameObject.collisionBit) === 0) {
         return;
      }
      
      if (!this.isStatic) {
         // Calculate the force of the push
         // Force gets greater the closer together the objects are
         const distanceBetweenEntities = this.position.calculateDistanceBetween(gameObject.position);
         const maxDistanceBetweenEntities = this.calculateMaxDistanceFromGameObject(gameObject);
         const dist = Math.max(distanceBetweenEntities / maxDistanceBetweenEntities, 0.1);
         
         const force = SETTINGS.ENTITY_PUSH_FORCE / SETTINGS.TPS / dist * gameObject.mass / this.mass * gameObject.collisionPushForceMultiplier;
         const pushAngle = this.position.calculateAngleBetween(gameObject.position) + Math.PI;
         this.velocity.x += force * Math.sin(pushAngle);
         this.velocity.y += force * Math.cos(pushAngle);
      }

      const idx = this.collidingObjects.indexOf(gameObject);
      if (idx === -1) {
         // New colliding game object
         this.collidingObjects.push(gameObject);
         this.collidingObjectTicks.push(Board.ticks);
         (this.callEvents as any)("enter_collision", gameObject);
      } else {
         // Existing colliding game object
         this.collidingObjectTicks[idx] = Board.ticks;
      }

      (this.callEvents as any)("during_collision", gameObject);
      gameObject.callCollisionEvent(this as any);
   }

   private calculateMaxDistanceFromGameObject(gameObject: GameObject): number {
      // @Speed
      
      let maxDist = 0;

      // Account for this object's hitboxes
      for (const hitbox of this.hitboxes) {
         if (hitbox.hasOwnProperty("radius")) {
            // Circular hitbox
            maxDist += (hitbox as CircularHitbox).radius;
         } else {
            // Rectangular hitbox
            maxDist += (hitbox as RectangularHitbox).halfDiagonalLength;
         }
      }

      // Account for the other object's hitboxes
      for (const hitbox of gameObject.hitboxes) {
         if (hitbox.hasOwnProperty("radius")) {
            // Circular hitbox
            maxDist += (hitbox as CircularHitbox).radius;
         } else {
            // Rectangular hitbox
            maxDist += (hitbox as RectangularHitbox).halfDiagonalLength;
         }
      }

      return maxDist;
   }

   // Type parameters confuse me ;-;... This works somehow
   public callEvents<T extends keyof EventsType>(type: T, ...params: EventsType[T] extends (...args: any) => void ? Parameters<EventsType[T]> : never): void {
      for (const event of this.events[type]) {
         // Unfortunate that this unsafe solution has to be used, but I couldn't find an alternative
         (event as any)(...params as any[]);
      }
   }

   public createEvent<T extends keyof EventsType>(type: T, event: EventsType[T]): void {
      this.events[type].push(event);
   }

   public removeEvent<T extends keyof EventsType>(type: T, event: EventsType[T]): void {
      const idx = this.events[type].indexOf(event);
      if (idx !== -1) {
         this.events[type].splice(idx, 1);
      } else {
         console.warn("cant remove");
      }
   }

   public remove(): void {
      this.isRemoved = true;
   }

   public getDebugData(): GameObjectDebugData {
      return {
         gameObjectID: this.id,
         lines: [],
         circles: [],
         tileHighlights: [],
         debugEntries: []
      };
   }
}

export default GameObject;