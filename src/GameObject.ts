import { HitboxType, Point, SETTINGS, TILE_TYPE_INFO_RECORD, Vector, curveWeight } from "webgl-test-shared";
import Tile from "./tiles/Tile";
import Hitbox from "./hitboxes/Hitbox";
import Chunk from "./Chunk";
import { EntityEvents, GameEvent, GameObjectEvents } from "./events";
import RectangularHitbox from "./hitboxes/RectangularHitbox";
import Entity from "./entities/Entity";
import DroppedItem from "./items/DroppedItem";
import Projectile from "./Projectile";
import { SERVER } from "./server";

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

interface GameObjectSubclassEvents {
   entity: EntityEvents;
   droppedItem: GameObjectEvents;
   projectile: GameObjectEvents;
}

type IEvents<I extends keyof GameObjectSubclasses> = GameObjectSubclassEvents[I] extends GameObjectEvents ? GameObjectSubclassEvents[I] : never;

/** A generic class for any object in the world which has hitbox(es) */
// abstract class _GameObject<I extends keyof a, T extends GameObjectEvents> {
abstract class _GameObject<I extends keyof GameObjectSubclasses> {
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

   /** Stores which other objects could be colliding with the object */
   public potentialCollidingObjects = new Set<GameObject>();
   public collidingObjects = new Set<GameObject>();

   private previousCollidingObjects = new Set<GameObject>();

   protected abstract readonly events: { [E in keyof IEvents<I>]: Array<GameEvent<IEvents<I>, E>> };

   /** If true, the game object is flagged for deletion at the beginning of the next tick */
   public isRemoved = false;

   /** If this flag is set to true, then the game object will not be able to be moved */
   public isStatic = false;

   /** If set to false, the game object will not experience friction from moving over tiles. */
   public isAffectedByFriction = true;

   constructor(position: Point) {
      this.position = position;

      this.id = findAvailableEntityID();

      // Clamp the game object's position to within the world
      if (this.position.x < 0) this.position.x = 0;
      if (this.position.x >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.x = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;
      if (this.position.y < 0) this.position.y = 0;
      if (this.position.y >= SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE) this.position.y = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE - 1;

      this.updateTile();

      SERVER.board.addGameObjectToJoinBuffer(this as unknown as GameObject);
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

      this.tile = SERVER.board.getTile(tileX, tileY);
   }

   /** Function optionally implemented by game object subclasses */
   public getMoveSpeedMultiplier?(): number;

   public applyPhysics(): void {
      const tileTypeInfo = TILE_TYPE_INFO_RECORD[this.tile.type];

      let moveSpeedMultiplier = tileTypeInfo.moveSpeedMultiplier || 1;
      if (typeof this.getMoveSpeedMultiplier !== "undefined") {
         moveSpeedMultiplier *= this.getMoveSpeedMultiplier();
      }

      const terminalVelocity = this.terminalVelocity * moveSpeedMultiplier;

      // Friction
      if (this.isAffectedByFriction && this.velocity !== null) {
         this.velocity.magnitude /= 1 + 1 / SETTINGS.TPS;
      }
      
      // Accelerate
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude *= tileTypeInfo.friction * moveSpeedMultiplier / SETTINGS.TPS;

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
         this.velocity.magnitude -= SETTINGS.FRICTION_CONSTANT * tileTypeInfo.friction / SETTINGS.TPS;
         if (this.velocity.magnitude <= 0) {
            this.velocity = null;
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
               const chunk = SERVER.board.getChunk(chunkX, chunkY);
               if (!containingChunks.has(chunk)) {
                  containingChunks.add(chunk);
               }
            }
         }
      }

      return containingChunks;
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

   public setCollidingGameObjects(collidingEntities: Set<GameObject>): void {
      this.collidingObjects = collidingEntities;
   }

   public updateCollidingGameObjects(): void {
      this.calculateCollidingGameObjects();

      // Call collision events
      for (const collidingGameObject of this.collidingObjects) {
         (this.callEvents as any)("during_collision", collidingGameObject);
         if (collidingGameObject.i === "entity") (this.callEvents as any)("during_entity_collision", collidingGameObject);
         
         if (!this.previousCollidingObjects.has(collidingGameObject)) {
            (this.callEvents as any)("enter_collision", collidingGameObject);
         }
      }
   }

   /** Resolves collisions with other game objects */
   public resolveGameObjectCollisions(): void {
      if (this.isStatic) return;
      
      // Push away from all colliding objects
      for (const gameObject of this.collidingObjects) {
         // If the two objects are exactly on top of each other, don't do anything
         if (gameObject.position.x === this.position.x && gameObject.position.y === this.position.y) {
            continue;
         }

         // Calculate the force of the push
         // Force gets greater the closer together the objects are
         const distanceBetweenEntities = this.position.calculateDistanceBetween(gameObject.position);
         const maxDistanceBetweenEntities = this.calculateMaxDistanceFromGameObject(gameObject);
         let forceMultiplier = 1 - distanceBetweenEntities / maxDistanceBetweenEntities;
         forceMultiplier = curveWeight(forceMultiplier, 2, 0.2);
         
         const force = SETTINGS.ENTITY_PUSH_FORCE / SETTINGS.TPS * forceMultiplier;
         // const force = SETTINGS.ENTITY_PUSH_FORCE / SETTINGS.TPS * forceMultiplier * this.pushForceMultiplier;
         const pushAngle = this.position.calculateAngleBetween(gameObject.position) + Math.PI;
         // No need to apply force to other object as they will do it themselves
         const pushForce = new Vector(force, pushAngle);
         if (this.velocity !== null) {
            this.velocity.add(pushForce);
         } else {
            this.velocity = pushForce;
         }
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
   
   private calculateCollidingGameObjects(): void {
      this.potentialCollidingObjects.delete(this as unknown as GameObject);
      objectLoop: for (const gameObject of this.potentialCollidingObjects) {
         if (this.collidingObjects.has(gameObject)) continue;
         
         for (const hitbox of this.hitboxes) {
            for (const otherHitbox of gameObject.hitboxes) {
               // If the objects are colliding, add the colliding object and this object
               if (hitbox.isColliding(otherHitbox)) {
                  gameObject.confirmCollidingGameObject(this as unknown as GameObject);
                  
                  this.collidingObjects.add(gameObject);
                  continue objectLoop;
               }
            }
         }
      }
   }

   public savePreviousCollidingGameObjects(): void {
      this.previousCollidingObjects.clear();
      for (const gameObject of this.collidingObjects) {
         this.previousCollidingObjects.add(gameObject);
      }
   }

   public clearCollidingGameObjects(): void {
      this.collidingObjects.clear();
   }

   public confirmCollidingGameObject(gameObject: GameObject): void {
      this.potentialCollidingObjects.delete(gameObject);
      this.collidingObjects.add(gameObject);
   }

   // Type parameters confuse me ;-;... This works somehow
   public callEvents<E extends keyof IEvents<I>>(type: E, ...params: IEvents<I>[E] extends (...args: any) => void ? Parameters<IEvents<I>[E]> : never): void {
      for (const event of this.events[type]) {
         // Unfortunate that this unsafe solution has to be used, but I couldn't find an alternative
         (event as any)(...params as any[]);
      }
   }

   public createEvent<E extends keyof IEvents<I>>(type: E, event: IEvents<I>[E]): void {
      this.events[type].push(event);
   }

   public remove(): void {
      this.isRemoved = true;
      SERVER.board.addGameObjectToRemoveBuffer(this as unknown as GameObject);
      SERVER.board.removeGameObjectFromJoinBuffer(this as unknown as GameObject);
   }
}

export default _GameObject;