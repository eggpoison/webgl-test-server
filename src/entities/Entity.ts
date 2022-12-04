import Chunk from "../Chunk";
import { EntityInfoClientArgs, EntityType, ENTITY_INFO_RECORD, HitboxType, Point, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
import Component from "../entity-components/Component";
import { SERVER } from "../server";
import HealthComponent from "../entity-components/HealthComponent";
import Tile from "../tiles/Tile";
import Hitbox from "../hitboxes/Hitbox";
import CircularHitbox from "../hitboxes/CircularHitbox";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import { Event, EventParams, EventType } from "../events";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

export interface Components {
   readonly health: HealthComponent;
   readonly inventory: InventoryComponent;
   readonly item_creation: ItemCreationComponent;
}

const filterTickableComponents = (components: Partial<Components>): ReadonlyArray<Component> => {
   const tickableComponents = new Array<Component>();
   for (const component of Object.values(components) as Array<Component>) {
      if (typeof component.tick !== "undefined") {
         tickableComponents.push(component);
      }
   }
   return tickableComponents;
}

type StatusEffectType = "fire";

type StatusEffect = {
   durationSeconds: number;
   secondsRemaining: number;
   ticksElapsed: number;
}

abstract class Entity {
   private static readonly MAX_ENTITY_COLLISION_PUSH_FORCE = 200;
   
   private readonly components: Partial<{ [key in keyof Components]: Components[key] }> = {};
   private readonly tickableComponents: ReadonlyArray<Component>;

   /** Unique identifier for every entity */
   public readonly id: number;
   /** Type of the entity (e.g. "cow") */
   public readonly type: EntityType;

   public readonly hitbox: Hitbox<HitboxType>;

   public readonly events: { [E in EventType]: Array<Event<E>> } = {
      hurt: [],
      death: [],
      item_pickup: [],
      enter_collision: []
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
   public rotation: number = 0;

   public chunks = new Array<Chunk>();

   public currentTile!: Tile;

   /** Whether the entity has been added to the game */
   public isAdded: boolean = false;
   /** If true, the entity is flagged for deletion at the beginning of the next tick */
   public isRemoved: boolean = false;

   private collidingEntities = new Set<Entity>();

   public readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   constructor(position: Point, type: EntityType, components: Partial<Components>, id?: number) {
      this.id = typeof id !== "undefined" ? id : findAvailableEntityID();
      this.type = type;
      
      this.position = position;

      this.calculateCurrentTile();

      // Create hitbox using hitbox info
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

      this.components = components;
      this.tickableComponents = filterTickableComponents(components);

      for (const component of Object.values(components) as Array<Component>) {
         component.setEntity(this);
      }

      // Load components. Must be done after all of them set their entity as the components might reference each other
      for (const component of Object.values(components) as Array<Component>) {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      }

      // Add the entity to the join buffer
      SERVER.board.addEntityToJoinBuffer(this);
   }

   public abstract getClientArgs(): Parameters<EntityInfoClientArgs[EntityType]>;

   /** Called after every physics update. */
   public tick(): void {
      // Tick components
      for (const component of this.tickableComponents) {
         component.tick!();
      }
      
      this.tickStatusEffects();
   }

   public getComponent<C extends keyof Components>(name: C): Components[C] | null {
      if (this.components.hasOwnProperty(name)) {
         return this.components[name] as Components[C];
      }
      return null;
   }

   /** Calculates the chunks that contain the entity.  */
   private calculateContainingChunks(): Array<Chunk> {
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

   /** Called after calculating the entity's hitbox bounds */
   public updateContainingChunks(): void {
      const containingChunks = this.calculateContainingChunks();

      // Find all chunks which aren't present in the new chunks and remove them
      const removedChunks = this.chunks.filter(chunk => !containingChunks.includes(chunk));
      for (const chunk of removedChunks) {
         chunk.removeEntity(this);
         this.chunks.splice(this.chunks.indexOf(chunk), 1);
      }

      // Add all new chunks
      const addedChunks = containingChunks.filter(chunk => !this.chunks.includes(chunk));
      for (const chunk of addedChunks) {
         chunk.addEntity(this);
         this.chunks.push(chunk);
      }
   }

   public addVelocity(magnitude: number, direction: number): void {
      const force = new Vector(magnitude, direction);
      this.velocity = this.velocity?.add(force) || force;
   }

   /** Calculates the tile the entity is currently in using its position */
   public calculateCurrentTile(): void {
      const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
      const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);

      this.currentTile = SERVER.board.getTile(tileX, tileY);
   }

   public applyPhysics(): void {
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
      const boardUnits = SETTINGS.BOARD_DIMENSIONS * SETTINGS.TILE_SIZE;

      // Left wall
      if (this.hitbox.bounds[0] < 0) {
         this.stopXVelocity();
         this.position.x -= this.hitbox.bounds[0];
      // Right wall
      } else if (this.hitbox.bounds[1] > boardUnits) {
         this.position.x -= this.hitbox.bounds[1] - boardUnits;
         this.stopXVelocity();
      }

      // Bottom wall
      if (this.hitbox.bounds[2] < 0) {
         this.position.y -= this.hitbox.bounds[2];
         this.stopYVelocity();
      // Top wall
      } else if (this.hitbox.bounds[3] > boardUnits) {
         this.position.y -= this.hitbox.bounds[3] - boardUnits;
         this.stopYVelocity();
      }
   }

   public updateCollidingEntities(): void {
      const previousCollidingEntities = new Set(this.collidingEntities);
      this.collidingEntities = this.getCollidingEntities();

      // Check for new collisions
      for (const collidingEntity of this.collidingEntities) {
         if (!previousCollidingEntities.has(collidingEntity)) {
            this.callEvents("enter_collision", collidingEntity);
         }
      }
   }

   public resolveEntityCollisions(): void {
      // Push away from all colliding entities
      for (const entity of this.collidingEntities) {
         const force = Entity.MAX_ENTITY_COLLISION_PUSH_FORCE / SETTINGS.TPS;
         const angle = this.position.angleBetween(entity.position);

         // No need to apply force to other entity as they will do it themselves
         this.addVelocity(force, angle + Math.PI);
      }
   }

   private getCollidingEntities(): Set<Entity> {
      const collidingEntities = new Set<Entity>();

      for (const chunk of this.chunks) {
         for (const entity of chunk.getEntities()) {
            if (entity === this) continue;

            if (this.hitbox.isColliding(entity.hitbox)) {
               collidingEntities.add(entity);
            }
         }
      }

      return collidingEntities;
   }

   public takeDamage(damage: number, attackingEntity: Entity | null, attackHash?: string): void {
      // Don't attack during invulnerability
      if (this.getComponent("health")!.isInvulnerable(attackHash)) {
         return;
      }
      
      const hitWasReceived = this.getComponent("health")!.takeDamage(damage);
 
      if (hitWasReceived && !this.isRemoved) {
         this.callEvents("hurt", attackingEntity);

         // Push away from the source of damage
         if (attackingEntity !== null) {
            const angle = this.position.angleBetween(attackingEntity.position);
            this.addVelocity(150, angle);
         }
      }
   }

   public destroy(): void {
      this.callEvents("death");
      this.isRemoved = true;
   }

   public callEvents<E extends EventType>(type: E, ...params: EventParams<E>): void {
      for (const event of this.events[type]) {
         // Unfortunate that this unsafe solution has to be used, but I couldn't find an alternative
         (event as any)(...params);
      }
   }

   public createEvent<E extends EventType>(type: E, event: Event<E>): void {
      this.events[type].push(event);
   }

   private tickStatusEffects(): void {
      const statusEffectTypes = Object.keys(this.statusEffects) as ReadonlyArray<StatusEffectType>;

      for (const statusEffectType of statusEffectTypes as ReadonlyArray<StatusEffectType>) {
         const statusEffect = this.statusEffects[statusEffectType]!
         statusEffect.secondsRemaining -= 1 / SETTINGS.TPS;
         statusEffect.ticksElapsed++;
         if (statusEffect.secondsRemaining <= 0) {
            // Remove the status effect
            this.removeStatusEffect(statusEffectType);
         }    
      }

      if (statusEffectTypes.includes("fire")) {
         if (this.statusEffects.fire!.ticksElapsed % 15 === 0) {
            // Fire tick
            this.takeDamage(1, null);
         }
      }
   }

   public applyStatusEffect(type: StatusEffectType, durationSeconds: number): void {
      if (!this.statusEffects.hasOwnProperty(type)) {
         this.statusEffects[type] = {
            durationSeconds: durationSeconds,
            secondsRemaining: durationSeconds,
            ticksElapsed: 0
         };
      } else {
         if (durationSeconds > this.statusEffects[type]!.durationSeconds) {
            this.statusEffects[type]!.durationSeconds = durationSeconds;
         }
         this.statusEffects[type]!.secondsRemaining = this.statusEffects[type]!.durationSeconds;
      }
   }

   public removeStatusEffect(type: StatusEffectType): void {
      delete this.statusEffects[type];
   }
}

export default Entity;