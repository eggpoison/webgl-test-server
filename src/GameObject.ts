import { GameObjectDebugData, Point, RIVER_STEPPING_STONE_SIZES, SETTINGS, TILE_FRICTIONS, TILE_MOVE_SPEED_MULTIPLIERS, TileType, Vector, clampToBoardDimensions, rotateXAroundPoint, rotateYAroundPoint } from "webgl-test-shared";
import Tile from "./Tile";
import Chunk from "./Chunk";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Projectile from "./Projectile";
import Board from "./Board";
import CircularHitbox from "./hitboxes/CircularHitbox";

// @Cleanup

function sqr(x: number) { return x * x }
function dist2(v: Point, w: Point) {return sqr(v.x - w.x) + sqr(v.y - w.y) }
function distToSegmentSquared(p: Point, v: Point, w: Point) {
  var l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);
  var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, new Point(v.x + t * (w.x - v.x),
                    v.y + t * (w.y - v.y) ));
}
function distToSegment(p: Point, v: Point, w: Point) { return Math.sqrt(distToSegmentSquared(p, v, w)); }

const pointIsInRectangle = (pointX: number, pointY: number, rectPos: Point, rectWidth: number, rectHeight: number, rectRotation: number): boolean => {
   // Rotate point around rect to make the situation axis-aligned
   const alignedPointX = rotateXAroundPoint(pointX, pointY, rectPos.x, rectPos.y, -rectRotation);
   const alignedPointY = rotateYAroundPoint(pointX, pointY, rectPos.x, rectPos.y, -rectRotation);

   const x1 = rectPos.x - rectWidth / 2;
   const x2 = rectPos.x + rectWidth / 2;
   const y1 = rectPos.y - rectHeight / 2;
   const y2 = rectPos.y + rectHeight / 2;
   
   return alignedPointX >= x1 && alignedPointX <= x2 && alignedPointY >= y1 && alignedPointY <= y2;
}

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

export type GameObject = Entity | DroppedItem | Projectile;

interface GameObjectSubclasses {
   entity: Entity;
   droppedItem: DroppedItem;
   projectile: Projectile;
}

export interface GameObjectEvents {
   on_destroy: () => void;
   enter_collision: (collidingGameObject: GameObject) => void;
   during_collision: (collidingGameObject: GameObject) => void;
   enter_entity_collision: (collidingEntity: Entity) => void;
   during_entity_collision: (collidingEntity: Entity) => void;
}

enum TileCollisionAxis {
   none = 0,
   x = 1,
   y = 2,
   diagonal = 3
}

export type GameEvent<T extends GameObjectEvents, E extends keyof T> = T[E];

export type BoundingArea = [minX: number, maxX: number, minY: number, maxY: number];

/*
* @Cleanup: To reduce the use of "this as unknown as GameObject", make this not have type parameters.
*/

/** A generic class for any object in the world which has hitbox(es) */
abstract class _GameObject<I extends keyof GameObjectSubclasses, EventsType extends GameObjectEvents> {
   private static readonly rectangularTestHitbox = new RectangularHitbox();
   
   public abstract readonly i: I;
   
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

   /** Set of all chunks the object is contained in */
   public chunks = new Set<Chunk>();

   /** The tile the object is currently standing on. */
   public tile!: Tile;

   /** All hitboxes attached to the game object */
   public hitboxes = new Array<RectangularHitbox | CircularHitbox>();

   public previousCollidingObjects = new Array<GameObject>();
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
   public hitboxesAreDirty = true;
   
   /** Indicates whether the game object could potentially collide with a wall tile */
   public hasPotentialWallTileCollisions = false;

   public isInRiver: boolean;

   protected overrideMoveSpeedMultiplier = false;
   
   public boundingArea: BoundingArea = [Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];

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


      Board.addGameObjectToJoinBuffer(this as unknown as GameObject);
   }

   public addHitbox(hitbox: RectangularHitbox | CircularHitbox): void {
      this.hitboxes.push(hitbox);
      
      // Calculate initial position and hitbox bounds for the hitbox as it is not guaranteed that they are updated the immediate tick after
      hitbox.updatePositionFromGameObject(this as unknown as GameObject);
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

      this.hitboxesAreDirty = true;

      // 
      // Flag if the hitbox could be in a wall
      // 

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

         hitbox.updatePositionFromGameObject(this as unknown as GameObject);
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
            hitbox.updatePositionFromGameObject(this as unknown as GameObject);
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
      if (this.tile.type !== TileType.water) {
         return false;
      }

      // If the game object is standing on a stepping stone they aren't in a river
      for (const chunk of this.chunks) {
         for (const steppingStone of chunk.riverSteppingStones) {
            const size = RIVER_STEPPING_STONE_SIZES[steppingStone.size];
            
            const dist = this.position.calculateDistanceBetween(steppingStone.position);
            if (dist <= size/2) {
               return false;
            }
         }
      }

      return true;
   }

   public applyPhysics(): void {
      let moveSpeedMultiplier: number;
      if (this.overrideMoveSpeedMultiplier) {
         moveSpeedMultiplier = 1;
      } else if (this.tile.type === TileType.water && !this.isInRiver) {
         moveSpeedMultiplier = this.moveSpeedMultiplier;
      } else {
         moveSpeedMultiplier = TILE_MOVE_SPEED_MULTIPLIERS[this.tile.type] * this.moveSpeedMultiplier;
      }

      const terminalVelocity = this.terminalVelocity * moveSpeedMultiplier;

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
      // @Speed: perhaps only do this check when position changes
      if (this.isAffectedByFriction && this.isInRiver) {
         const flowDirection = Board.getRiverFlowDirection(this.tile.x, this.tile.y);
         this.velocity.x += 240 / SETTINGS.TPS * Math.sin(flowDirection);
         this.velocity.y += 240 / SETTINGS.TPS * Math.cos(flowDirection);
      }

      // Apply velocity
      this.position.x += this.velocity.x / SETTINGS.TPS;
      this.position.y += this.velocity.y / SETTINGS.TPS;
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
            chunk.removeGameObject(this as unknown as GameObject);
            this.chunks.delete(chunk);
         }
      }

      // Add all new chunks
      for (const chunk of containingChunks) {
         if (!this.chunks.has(chunk)) {
            chunk.addGameObject(this as unknown as GameObject);
            this.chunks.add(chunk);
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
      
      _GameObject.rectangularTestHitbox.setHitboxInfo(SETTINGS.TILE_SIZE, SETTINGS.TILE_SIZE);
      _GameObject.rectangularTestHitbox.position = new Point((tile.x + 0.5) * SETTINGS.TILE_SIZE, (tile.y + 0.5) * SETTINGS.TILE_SIZE);
      _GameObject.rectangularTestHitbox.updateHitboxBounds(0);

      if (_GameObject.rectangularTestHitbox.isColliding(hitbox)) {
         return TileCollisionAxis.diagonal;
      }

      return TileCollisionAxis.none;
   }

   private resolveXAxisRectangularTileCollision(tile: Tile, hitbox: RectangularHitbox): void {
      // 
      // @Speed: don't recalculate, instead pass in
      // 

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
      // 
      // @Speed: don't recalculate, instead pass in
      // 

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
         // Right border
      } else if (this.boundingArea[1] > SETTINGS.BOARD_UNITS) {
         this.position.x -= this.boundingArea[1] - SETTINGS.BOARD_UNITS;
         this.velocity.x = 0;
      }

      // Bottom border
      if (this.boundingArea[2] < 0) {
         this.position.y -= this.boundingArea[2];
         this.velocity.y = 0;
         // Top border
      } else if (this.boundingArea[3] > SETTINGS.BOARD_UNITS) {
         this.position.y -= this.boundingArea[3] - SETTINGS.BOARD_UNITS;
         this.velocity.y = 0;
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
      // @Cleanup This shouldn't be hardcoded
      // Krumblids and cacti don't collide
      if (gameObject.i === "entity" && this.i === "entity" && ((gameObject.type === "cactus" && (this as unknown as Entity).type === "krumblid") || (gameObject.type === "krumblid" && (this as unknown as Entity).type === "cactus"))) {
         return;
      }
      
      if (!this.isStatic && gameObject.i !== "droppedItem") {
         // Calculate the force of the push
         // Force gets greater the closer together the objects are
         const distanceBetweenEntities = this.position.calculateDistanceBetween(gameObject.position);
         const maxDistanceBetweenEntities = this.calculateMaxDistanceFromGameObject(gameObject);
         let dist = Math.max(distanceBetweenEntities / maxDistanceBetweenEntities, 0.1);
         if (this.i === "entity" && (this as unknown as Entity).type === "slime" && gameObject.i === "entity" && (gameObject as unknown as Entity).type === "slime") {
            dist += 0.15;
         }
         const forceMultiplier = 1 / dist;
         
         const force = SETTINGS.ENTITY_PUSH_FORCE / SETTINGS.TPS * forceMultiplier * gameObject.mass / this.mass;
         const pushAngle = this.position.calculateAngleBetween(gameObject.position) + Math.PI;
         this.velocity.x += force * Math.sin(pushAngle);
         this.velocity.y += force * Math.cos(pushAngle);
      }

      // Call collision events
      (this.callEvents as any)("during_collision", gameObject);
      if (gameObject.i === "entity") (this.callEvents as any)("during_entity_collision", gameObject);
      
      if (this.previousCollidingObjects.indexOf(gameObject) === -1) {
         (this.callEvents as any)("enter_collision", gameObject);
      }

      this.collidingObjects.push(gameObject);
   }

   private calculateMaxDistanceFromGameObject(gameObject: GameObject): number {
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

   public remove(): void {
      this.isRemoved = true;
      Board.addGameObjectToRemoveBuffer(this as unknown as GameObject);
      Board.removeGameObjectFromJoinBuffer(this as unknown as GameObject);
   }

   public getDebugData(): GameObjectDebugData {
      return {
         gameObjectID: this.id,
         lines: [],
         circles: [],
         tileHighlights: [],
         debugEntries: []
      }
   }
}

export default _GameObject;