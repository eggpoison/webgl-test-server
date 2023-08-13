import { GameObjectDebugData, HitboxType, Point, RIVER_STEPPING_STONE_SIZES, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Tile from "./tiles/Tile";
import Hitbox from "./hitboxes/Hitbox";
import Chunk from "./Chunk";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Projectile from "./Projectile";
import Board from "./Board";

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

export type GameObject = Entity | DroppedItem | Projectile;

export interface GameObjectSubclasses {
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


export type GameEvent<T extends GameObjectEvents, E extends keyof T> = T[E];

/** A generic class for any object in the world which has hitbox(es) */
abstract class _GameObject<I extends keyof GameObjectSubclasses, EventsType extends GameObjectEvents> {
   public abstract readonly i: I;
   
   /** Unique identifier for each game object */
   public readonly id: number;

   /** Position of the object in the world */
   public position: Point;
   /** Velocity of the object */
   public velocity: Vector | null = null;
   /** Acceleration of the object */
   public acceleration: Vector | null = null;
   /** Limit to the object's velocity */
   public terminalVelocity = 0;

   /** Set of all chunks the object is contained in */
   public chunks = new Set<Chunk>();

   /** Direction the object is facing in radians */
   public rotation = 0;

   /** The tile the object is currently standing on. */
   public tile!: Tile;

   /** All hitboxes attached to the game object */
   public hitboxes = new Set<Hitbox<HitboxType>>();

   public previousCollidingObjects = new Set<GameObject>();
   public collidingObjects = new Set<GameObject>();
   
   // protected abstract readonly events: { [E in keyof IEvents<I>]: Array<GameEvent<IEvents<I>, E>> };
   protected abstract readonly events: { [E in keyof EventsType]: Array<GameEvent<EventsType, E>> };

   /** If true, the game object is flagged for deletion at the beginning of the next tick */
   public isRemoved = false;

   /** If this flag is set to true, then the game object will not be able to be moved */
   public isStatic = false;

   /** If set to false, the game object will not experience friction from moving over tiles. */
   public isAffectedByFriction = true;

   public boundingChunks = new Array<Chunk>();

   constructor(position: Point) {
      this.position = position;

      this.id = findAvailableEntityID();

      // Clamp the game object's position to within the world
      if (this.position.x < 0) this.position.x = 0;
      if (this.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.x = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
      if (this.position.y < 0) this.position.y = 0;
      if (this.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.y = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;

      this.updateTile();

      Board.addGameObjectToJoinBuffer(this as unknown as GameObject);
   }

   public addHitboxes(hitboxes: ReadonlyArray<Hitbox<HitboxType>>): void {
      for (const hitbox of hitboxes) {
         hitbox.setHitboxObject(this);

         this.hitboxes.add(hitbox);
      }
   }

   public addVelocity(vector: Vector): void {
      if (this.velocity !== null) {
         this.velocity.add(vector);
      } else {
         this.velocity = vector;
      }
   }

   public updateHitboxes(): void {
      for (const hitbox of this.hitboxes) {
         hitbox.updatePosition();
         if (hitbox.info.type === "rectangular") {
            (hitbox as RectangularHitbox).computeVertexPositions();
            (hitbox as RectangularHitbox).calculateSideAxes();
         }
         hitbox.updateHitboxBounds();
      }
   }

   public tick(): void {
      this.applyPhysics();
      this.updateHitboxes();
      this.updateContainingChunks();
   }

   /** Updates the tile the object is on. */
   public updateTile(): void {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);

      this.tile = Board.getTile(tileX, tileY);
   }

   protected overrideTileMoveSpeedMultiplier?(): number | null;

   /** Function optionally implemented by game object subclasses */
   public getMoveSpeedMultiplier?(): number;

   protected isInRiver(): boolean {
      if (this.tile.type !== "water") {
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
      const tileTypeInfo = TILE_TYPE_INFO_RECORD[this.tile.type];

      let moveSpeedMultiplier = tileTypeInfo.moveSpeedMultiplier || 1;
      if (this.tile.type === "water" && !this.isInRiver()) {
         moveSpeedMultiplier = 1;
      }
      if (typeof this.overrideTileMoveSpeedMultiplier !== "undefined") {
         const speed = this.overrideTileMoveSpeedMultiplier();
         if (speed !== null) {
            moveSpeedMultiplier = speed;
         }
      }
      if (typeof this.getMoveSpeedMultiplier !== "undefined") {
         moveSpeedMultiplier *= this.getMoveSpeedMultiplier();
      }

      const terminalVelocity = this.terminalVelocity * moveSpeedMultiplier;

      let tileFrictionReduceAmount: number;
      
      // Friction
      if (this.isAffectedByFriction && this.velocity !== null) {
         const amountBefore = this.velocity.magnitude
         this.velocity.magnitude /= 1 + 3 / SETTINGS.TPS * tileTypeInfo.friction;
         tileFrictionReduceAmount = amountBefore - this.velocity.magnitude;
      } else {
         tileFrictionReduceAmount = 0;
      }
      
      // Accelerate
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude *= tileTypeInfo.friction * moveSpeedMultiplier / SETTINGS.TPS;

         // Make acceleration slow as the game object reaches its terminal velocity
         if (this.velocity !== null) {
            const progressToTerminalVelocity = this.velocity.magnitude / terminalVelocity;
            if (progressToTerminalVelocity < 1) {
               acceleration.magnitude *= 1 - Math.pow(progressToTerminalVelocity * 1.1, 2);
            }
         }

         acceleration.magnitude += tileFrictionReduceAmount;

         const magnitudeBeforeAdd = this.velocity?.magnitude || 0;

         // Add acceleration to velocity
         if (this.velocity !== null) {
            this.velocity.add(acceleration);
         } else {
            this.velocity = acceleration;
         }

         // Don't accelerate past terminal velocity
         if (this.velocity.magnitude > terminalVelocity && this.velocity.magnitude > magnitudeBeforeAdd) {
            if (magnitudeBeforeAdd < terminalVelocity) {
               this.velocity.magnitude = terminalVelocity;
            } else {
               this.velocity.magnitude = magnitudeBeforeAdd;
            }
         }
      // Friction
      } else if (this.isAffectedByFriction && this.velocity !== null) {
         this.velocity.magnitude -= 3 * SETTINGS.FRICTION_CONSTANT * tileTypeInfo.friction / SETTINGS.TPS;
         if (this.velocity.magnitude <= 0) {
            this.velocity = null;
         }
      }

      // If the game object is in a river, push them in the flow direction of the river
      if (this.isInRiver()) {
         const flowDirection = Board.getRiverFlowDirection(this.tile.x, this.tile.y);
         const pushVector = new Vector(240 / SETTINGS.TPS, flowDirection);
         if (this.velocity === null) {
            this.velocity = pushVector;
         } else {
            this.velocity.add(pushVector);
         }
      }

      // Apply velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude /= SETTINGS.TPS;
         
         this.position.add(velocity.convertToPoint());
      }
   }

   /** Calculates the chunks that contain the object.  */
   private calculateContainingChunks(): Set<Chunk> {
      const containingChunks = new Set<Chunk>();

      for (const hitbox of this.hitboxes) {
         const minChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = Board.getChunk(chunkX, chunkY);
               if (!containingChunks.has(chunk)) {
                  containingChunks.add(chunk);
               }
            }
         }
      }

      return containingChunks;
   }

   public calculateBoundingVolume(): void {
      const containingChunks = new Array<Chunk>();
      for (const hitbox of this.hitboxes) {
         const minChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkX = Math.max(Math.min(Math.floor(hitbox.bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const minChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
         const maxChunkY = Math.max(Math.min(Math.floor(hitbox.bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

         for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
            for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
               const chunk = Board.getChunk(chunkX, chunkY);
               if (!containingChunks.includes(chunk)) {
                  containingChunks.push(chunk);
               }
            }
         }
      }

      this.boundingChunks = containingChunks;
   }

   /** Called after calculating the object's hitbox bounds */
   public updateContainingChunks(): void {
      const containingChunks = this.calculateContainingChunks();

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

   private stopXVelocity(): void {
      if (this.velocity !== null) {
         const pointVelocity = this.velocity.convertToPoint();
         pointVelocity.x = 0;
         this.velocity = pointVelocity.convertToVector();
      }
   }

   private stopYVelocity(): void {
      if (this.velocity !== null) {
         // Stop y velocity
         const pointVelocity = this.velocity.convertToPoint();
         pointVelocity.y = 0;
         this.velocity = pointVelocity.convertToVector();
      }
   }

   public resolveWallTileCollisions(): void {
      for (const hitbox of this.hitboxes) {
         let minTileX
      }
   }
   
   public resolveWallCollisions(): void {
      const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;

      for (const hitbox of this.hitboxes) {
         // Left wall
         if (hitbox.bounds[0] < 0) {
            this.stopXVelocity();
            this.position.x -= hitbox.bounds[0];
         // Right wall
         } else if (hitbox.bounds[1] > boardUnits) {
            this.position.x -= hitbox.bounds[1] - boardUnits;
            this.stopXVelocity();
         }

         // Bottom wall
         if (hitbox.bounds[2] < 0) {
            this.position.y -= hitbox.bounds[2];
            this.stopYVelocity();
         // Top wall
         } else if (hitbox.bounds[3] > boardUnits) {
            this.position.y -= hitbox.bounds[3] - boardUnits;
            this.stopYVelocity();
         }
      }
   }

   public isColliding(gameObject: GameObject): boolean {
      for (const hitbox of this.hitboxes) {
         for (const otherHitbox of gameObject.hitboxes) {
            // If the objects are colliding, add the colliding object and this object
            if (hitbox.isColliding(otherHitbox)) {
               return true;
            }
         }
      }
      return false;
   }

   public collide(gameObject: GameObject): void {
      if (!this.isStatic && gameObject.i !== "droppedItem" && this.i !== "droppedItem") {
         // Calculate the force of the push
         // Force gets greater the closer together the objects are
         const distanceBetweenEntities = this.position.calculateDistanceBetween(gameObject.position);
         const maxDistanceBetweenEntities = this.calculateMaxDistanceFromGameObject(gameObject);
         const dist = Math.max(distanceBetweenEntities / maxDistanceBetweenEntities, 0.1);
         const forceMultiplier = 1 / dist - 1;
         
         const force = SETTINGS.ENTITY_PUSH_FORCE / SETTINGS.TPS * forceMultiplier;
         const pushAngle = this.position.calculateAngleBetween(gameObject.position) + Math.PI;
         // No need to apply force to other object as they will do it themselves
         const pushForce = new Vector(force, pushAngle);
         if (this.velocity !== null) {
            this.velocity.add(pushForce);
         } else {
            this.velocity = pushForce;
         }
      }

      // Call collision events
      (this.callEvents as any)("during_collision", gameObject);
      if (gameObject.i === "entity") (this.callEvents as any)("during_entity_collision", gameObject);
      
      if (!this.previousCollidingObjects.has(gameObject)) {
         (this.callEvents as any)("enter_collision", gameObject);
      }
   }

   private calculateMaxDistanceFromGameObject(gameObject: GameObject): number {
      let maxDist = 0;

      // Account for this object's hitboxes
      for (const hitbox of this.hitboxes) {
         switch (hitbox.info.type) {
            case "circular": {
               maxDist += hitbox.info.radius;
               break;
            }
            case "rectangular": {
               maxDist += (hitbox as RectangularHitbox).halfDiagonalLength;
               break;
            }
         }
      }

      // Account for the other object's hitboxes
      for (const hitbox of gameObject.hitboxes) {
         switch (hitbox.info.type) {
            case "circular": {
               maxDist += hitbox.info.radius;
               break;
            }
            case "rectangular": {
               maxDist += (hitbox as RectangularHitbox).halfDiagonalLength;
               break;
            }
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
         tileHighlights: []
      }
   }
}

export default _GameObject;