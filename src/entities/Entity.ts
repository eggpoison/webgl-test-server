import Chunk from "../Chunk";
import { curveWeight, EntityInfoClientArgs, EntityType, ENTITY_INFO_RECORD, HitboxType, Point, SETTINGS, TILE_TYPE_INFO_RECORD, Vector } from "webgl-test-shared";
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
   public abstract readonly type: EntityType;

   public hitboxes:Set<Hitbox<HitboxType>>;

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

   public chunks = new Set<Chunk>();

   public currentTile!: Tile;

   /** Whether the entity has been added to the game */
   public isAdded: boolean = false;
   /** If true, the entity is flagged for deletion at the beginning of the next tick */
   public isRemoved: boolean = false;

   /** If this flag is set to true, then the entity will not move */
   private isStatic: boolean = false;

   private collidingEntities = new Set<Entity>();

   /** Impacts how much force an entity experiences which pushing away from another entity */
   private pushForceMultiplier = 1;

   public readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   constructor(position: Point, hitboxes: Set<Hitbox<HitboxType>>, components: Partial<Components>) {
      this.id = findAvailableEntityID();
      
      this.position = position;
      this.hitboxes = hitboxes;
      this.components = components;

      this.calculateCurrentTile();

      this.tickableComponents = filterTickableComponents(components);

      for (const hitbox of this.hitboxes) {
         hitbox.setHitboxObject(this);
      }

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

   public setPushForceMultiplier(pushForceMultiplier: number): void {
      this.pushForceMultiplier = pushForceMultiplier;
   }

   public setIsStatic(isStatic: boolean): void {
      this.isStatic = isStatic;
   }

   public getComponent<C extends keyof Components>(name: C): Components[C] | null {
      if (this.components.hasOwnProperty(name)) {
         return this.components[name] as Components[C];
      }
      return null;
   }

   /** Calculates the chunks that contain the entity.  */
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

   /** Called after calculating the entity's hitbox bounds */
   public updateContainingChunks(): void {
      const containingChunks = this.calculateContainingChunks();

      // Find all chunks which aren't present in the new chunks and remove them
      for (const chunk of this.chunks) {
         if (!containingChunks.has(chunk)) {
            chunk.removeEntity(this);
            this.chunks.delete(chunk);
         }
      }

      // Add all new chunks
      for (const chunk of containingChunks) {
         if (!this.chunks.has(chunk)) {
            chunk.addEntity(this);
            this.chunks.add(chunk);
         }
      }
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
         
         this.position.add(velocity.convertToPoint());
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
      if (this.isStatic) return;
      
      // Push away from all colliding entities
      for (const entity of this.collidingEntities) {
         // If the two entities are exactly on top of each other, don't do anything
         if (entity.position.x === this.position.x && entity.position.y === this.position.y) {
            continue;
         }

         // Calculate the force of the push
         // Force gets greater the closer together the entities are
         const distanceBetweenEntities = this.position.calculateDistanceBetween(entity.position);
         const maxDistanceBetweenEntities = this.calculateMaxDistanceFromEntity(entity);
         let forceMultiplier = 1 - distanceBetweenEntities / maxDistanceBetweenEntities;
         forceMultiplier = curveWeight(forceMultiplier, 2, 0.2);
         
         const force = Entity.MAX_ENTITY_COLLISION_PUSH_FORCE / SETTINGS.TPS * forceMultiplier * this.pushForceMultiplier;
         const pushAngle = this.position.calculateAngleBetween(entity.position) + Math.PI;
         // No need to apply force to other entity as they will do it themselves
         const pushForce = new Vector(force, pushAngle);
         if (this.velocity !== null) {
            this.velocity.add(pushForce);
         } else {
            this.velocity = pushForce;
         }
      }
   }

   private calculateMaxDistanceFromEntity(entity: Entity): number {
      let maxDist = 0;
      // Account for this entity's hitboxes
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
      // Account for the other entity's hitboxes
      for (const hitbox of entity.hitboxes) {
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
   
   private getCollidingEntities(): Set<Entity> {
      const collidingEntities = new Set<Entity>();

      for (const chunk of this.chunks) {
         entityLoop: for (const entity of chunk.getEntities()) {
            if (entity === this) continue;

            for (const hitbox of this.hitboxes) {
               for (const otherHitbox of entity.hitboxes) {
                  if (hitbox.isColliding(otherHitbox)) {
                     collidingEntities.add(entity);
                     continue entityLoop;
                  }
               }
            }
         }
      }

      return collidingEntities;
   }

   public takeDamage(damage: number, attackingEntity: Entity | null, attackHash?: string): void {
      const healthComponent = this.getComponent("health")!;
      
      // Don't attack during invulnerability
      if (healthComponent.isInvulnerable(attackHash)) {
         return;
      }
      
      const hitWasReceived = healthComponent.takeDamage(damage);
 
      if (hitWasReceived) this.callEvents("hurt", damage, attackingEntity);

      // Push away from the source of damage
      if (hitWasReceived && !this.isRemoved && !this.isStatic) {
         if (attackingEntity !== null) {
            const angle = this.position.calculateAngleBetween(attackingEntity.position) + Math.PI;
            const force = new Vector(150 * healthComponent.getKnockbackMultiplier(), angle);
            if (this.velocity !== null) {
               this.velocity.add(force);
            } else {
               this.velocity = force;
            }
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

      if (this.statusEffects.hasOwnProperty("fire")) {
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

   public hasStatusEffect(type: StatusEffectType): boolean {
      return this.statusEffects.hasOwnProperty(type);
   }

   public removeStatusEffect(type: StatusEffectType): void {
      delete this.statusEffects[type];
   }
}

export default Entity;