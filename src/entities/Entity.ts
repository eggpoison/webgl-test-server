import Chunk from "../Chunk";
import { EntityInfoClientArgs, EntityType, ENTITY_INFO_RECORD, HitboxType, HitboxVertexPositions, Point, rotatePoint, ServerAttackData, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Component from "../entity-components/Component";
import { SERVER } from "../server";
import { AttackInfo, EntityHitboxInfo } from "../Board";
import HealthComponent from "../entity-components/HealthComponent";
import Tile from "../tiles/Tile";
import Hitbox from "../hitboxes/Hitbox";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";

type EventType = "death";

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

abstract class Entity {
   private static readonly MAX_ENTITY_COLLISION_PUSH_FORCE = 200;
   
   private readonly components = new Map<(abstract new (...args: any[]) => any), Component>();
   private readonly updateableComponents: ReadonlyArray<Component>;

   /** Unique identifier for every entity */
   public readonly id: number;
   /** Type of the entity (e.g. "cow") */
   public readonly type: EntityType;

   public readonly hitbox: Hitbox<HitboxType>;

   public readonly events: Record<EventType, Array<() => void>> = {
      death: []
   };

   /** Position of the entity */
   public position: Point;
   /** Velocity of the entity */
   public velocity: Vector | null = null;
   /** Amount of units that the entity's speed increases in a second */
   public acceleration: Vector | null = null;
   /** Limit to how many units the entity can move in a second */
   public terminalVelocity: number = 0;

   /** Direction the entity is facing (radians) */
   public rotation: number;

   public chunks: Array<Chunk>;

   public currentTile: Tile;

   /** Whether the entity has been  */
   public isAdded: boolean = false;
   /** If true, the entity is flagged for deletion at the beginning of the next tick */
   public isRemoved: boolean = false;

   constructor(type: EntityType, position: Point, velocity: Vector | null, acceleration: Vector | null, rotation: number, components: Array<Component>, id?: number) {
      if (typeof id === "undefined") {
         this.id = findAvailableEntityID();
      } else {
         this.id = id;
      }

      this.type = type;
      
      this.position = position;
      this.velocity = velocity;
      this.acceleration = acceleration;

      this.rotation = rotation;

      const hitboxInfo = ENTITY_INFO_RECORD[type].hitbox;
      switch (hitboxInfo.type) {
         case "circular": {
            this.hitbox = new CircularHitbox(hitboxInfo, this);
            break;
         }
         case "rectangular": {
            this.hitbox = new RectangularHitbox(hitboxInfo, this);
            break;
         }
      }

      // Add entity to the ID record
      SERVER.board.entities[this.id] = this;

      // Calculate initial containing chunks
      if (this.hitbox.info.type === "rectangular") {
         (this.hitbox as RectangularHitbox).calculateVertexPositions();
      }
      const hitboxBounds = this.hitbox.calculateHitboxBounds();
      this.chunks = this.calculateContainingChunks(hitboxBounds);

      // Find inital tile
      this.currentTile = this.findCurrentTile();

      // Add entity to chunks
      for (const chunk of this.chunks) {
         chunk.addEntity(this);
      }

      // Set components
      this.updateableComponents = components.filter(component => typeof component.update !== "undefined");
      for (const component of components) {
         this.components.set(component.constructor as (new (...args: any[]) => any), component);
         component.setEntity(this);
      }
   }

   public onLoad?(): void;

   public loadComponents(): void {
      this.components.forEach(component => {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      });
   }

   public abstract getClientArgs(): Parameters<EntityInfoClientArgs[EntityType]>;

   public updateComponents(): void {
      for (const component of this.updateableComponents) {
         component.update!();
      }
   }

   /** Called immediately after every physics update. */
   public update?(): void;

   public findCurrentTile(): Tile {
      const [x, y] = this.findCurrentTileCoordinates();
      return SERVER.board.getTile(x, y);
   }

   public findCurrentTileCoordinates(): [number, number] {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);
      return [tileX, tileY];
   }

   public getComponent<C extends Component>(constr: { new(...args: any[]): C }): C | null {
      const component = this.components.get(constr);
      return typeof component !== "undefined" ? (component as C) : null;
   }

   public getChunkCoords(): [number, number] {
      const x = Math.floor(this.position.x / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      const y = Math.floor(this.position.y / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE);
      return [x, y];
   }
   public updateChunks(newChunks: ReadonlyArray<Chunk>): void {
      // Find all chunks which aren't present in the new chunks and remove them
      const removedChunks = this.chunks.filter(chunk => !newChunks.includes(chunk));
      for (const chunk of removedChunks) {
         chunk.removeEntity(this);
         this.chunks.splice(this.chunks.indexOf(chunk), 1);
      }

      // Add all new chunks
      const addedChunks = newChunks.filter(chunk => !this.chunks.includes(chunk));
      for (const chunk of addedChunks) {
         chunk.addEntity(this);
         this.chunks.push(chunk);
      }
   }

   /** Calculates the chunks that contain the entity. Called after calculating the entity's hitbox bounds */
   public calculateContainingChunks(): Array<Chunk> {
      const minChunkX = Math.max(Math.min(Math.floor(this.hitbox.bounds[0] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkX = Math.max(Math.min(Math.floor(this.hitbox.bounds[1] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minChunkY = Math.max(Math.min(Math.floor(this.hitbox.bounds[2] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxChunkY = Math.max(Math.min(Math.floor(this.hitbox.bounds[3] / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);

      const chunks = new Array<Chunk>();
      for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX++) {
         for (let chunkY = minChunkY; chunkY <= maxChunkY; chunkY++) {
            const chunk = SERVER.board.getChunk(chunkX, chunkY);
            chunks.push(chunk);
         }
      }

      return chunks;
   }

   public addVelocity(magnitude: number, direction: number): void {
      const force = new Vector(magnitude, direction);
      this.velocity = this.velocity?.add(force) || force;
   }
   public addForceVector(force: Vector): void {
      this.velocity = this.velocity?.add(force) || force;

   }

   public applyPhysics(): void {
      this.currentTile = this.findCurrentTile();
      const tileTypeInfo = TILE_TYPE_INFO_RECORD[this.currentTile.type];

      const tileMoveSpeedMultiplier = tileTypeInfo.moveSpeedMultiplier || 1;

      const terminalVelocity = this.terminalVelocity * tileMoveSpeedMultiplier;

      // Friction
      if (this.velocity !== null) {
         this.velocity.magnitude /= 1 + 1 / SETTINGS.TPS;
      }
      
      // Accelerate
      if (this.acceleration !== null) {
         const acceleration = this.acceleration.copy();
         acceleration.magnitude *= tileTypeInfo.friction * tileMoveSpeedMultiplier / SETTINGS.TPS;

         const magnitudeBeforeAdd = this.velocity?.magnitude || 0;
         // Add acceleration to velocity
         this.velocity = this.velocity !== null ? this.velocity.add(acceleration) : acceleration;
         // Don't accelerate past terminal velocity
         if (this.velocity.magnitude > terminalVelocity && this.velocity.magnitude > magnitudeBeforeAdd) {
            if (magnitudeBeforeAdd < terminalVelocity) {
               this.velocity.magnitude = terminalVelocity;
            } else {
               this.velocity.magnitude = magnitudeBeforeAdd;
            }
         }
      // Friction
      } else if (this.velocity !== null) {
         this.velocity.magnitude -= 50 * tileTypeInfo.friction / SETTINGS.TPS;
         if (this.velocity.magnitude <= 0) {
            this.velocity = null;
         }
      }

      // Apply velocity
      if (this.velocity !== null) {
         const velocity = this.velocity.copy();
         velocity.magnitude /= SETTINGS.TPS;
         
         this.position = this.position.add(velocity.convertToPoint());
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
      const [minX, maxX, minY, maxY] = this.hitbox.bounds;
      const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;

      // Left wall
      if (minX < 0) {
         this.stopXVelocity();
         this.position.x -= minX;
      // Right wall
      } else if (maxX > boardUnits) {
         this.position.x -= maxX - boardUnits;
         this.stopXVelocity();
      }

      // Bottom wall
      if (minY < 0) {
         this.position.y -= minY;
         this.stopYVelocity();
      // Top wall
      } else if (maxY > boardUnits) {
         this.position.y -= maxY - boardUnits;
         this.stopYVelocity();
      }
   }

   public resolveCollisions(entityHitboxInfoRecord: { [id: number]: EntityHitboxInfo }): void {
      const collidingEntities = this.getCollidingEntities(entityHitboxInfoRecord);

      for (const entity of collidingEntities) {
         // Push both entities away from each other
         const force = Entity.MAX_ENTITY_COLLISION_PUSH_FORCE / SETTINGS.TPS;
         const angle = this.position.angleBetween(entity.position);

         // No need to apply force to other entity as they will do it themselves
         this.addVelocity(force, angle + Math.PI);
      }
   }

   private getCollidingEntities(entityHitboxInfoRecord: { [id: number]: EntityHitboxInfo }): ReadonlyArray<Entity> {
      const collidingEntities = new Array<Entity>();

      for (const chunk of this.chunks) {
         for (const entity of chunk.getEntities()) {
            if (entity === this) continue;

            if (isColliding(this, entity, entityHitboxInfoRecord)) {
               collidingEntities.push(entity);
            }
         }
      }

      return collidingEntities;
   }

   public registerHit(attackingEntity: Entity, distance: number, angle: number, damage: number): void {
      if (!this.getComponent(HealthComponent)!.receiveDamage(damage)) return;

      const PUSH_FORCE = 150;
      this.addVelocity(PUSH_FORCE, angle);

      const attackInfo: AttackInfo = {
         attackingEntity: attackingEntity,
         targetEntity: this,
         progress: 0
      };
      SERVER.board.addNewAttack(attackInfo);
   }

   public kill(causeOfDeath: null): void {
      this.callEvents("death");
      this.isRemoved = true;
   }

   public callEvents(type: EventType): void {
      for (const event of this.events[type]) {
         event();
      }
   }

   public createEvent(type: EventType, event: () => void): void {
      this.events[type].push(event);
   }
}

export default Entity;