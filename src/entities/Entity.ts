import { EntityInfoClientArgs, EntityType, Point, SETTINGS } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import { EntityEvents } from "../events";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import { addEntityToCensus } from "../entity-spawning";
import _GameObject from "../GameObject";

let idCounter = 0;

/** Finds a unique available ID for an entity */
export function findAvailableEntityID(): number {
   return idCounter++;
}

export interface EntityComponents {
   readonly health: HealthComponent;
   readonly inventory: InventoryComponent;
   readonly item_creation: ItemCreationComponent;
}

const filterTickableComponents = (components: Partial<EntityComponents>): ReadonlyArray<Component> => {
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

abstract class Entity extends _GameObject<"entity", EntityEvents> {
   public readonly i: "entity" = "entity";
   
   private readonly components: Partial<{ [key in keyof EntityComponents]: EntityComponents[key] }> = {};
   private readonly tickableComponents: ReadonlyArray<Component>;

   /** Unique identifier for every entity */
   public readonly id: number;
   public readonly type: EntityType;

   protected readonly events = {
      hurt: [],
      death: [],
      on_knockback: [],
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: []
   };

   // /** All hitboxes attached to the entity but not active */
   // private inactiveHitboxes = new Set<Hitbox<HitboxType>>();
   // /** All hitboxes in use by the entity */
   // public hitboxes = new Set<Hitbox<HitboxType>>();

   // private readonly events: { [E in EventType]: Array<Event<E>> } = {
   //    hurt: [],
   //    death: [],
   //    enter_entity_collision: [],
   //    during_entity_collision: [],
   //    enter_item_collision: [],
   //    on_knockback: []
   // };

   // /** Position of the entity */
   // public position!: Point;
   // /** Velocity of the entity */
   // public velocity: Vector | null = null;
   // /** Amount of units that the entity's speed increases in a second */
   // public acceleration: Vector | null = null;
   // /** Limit to how many units the entity can move in a second */
   // public terminalVelocity: number = 0;

   // /** Direction the entity is facing (radians) */
   // public rotation: number = 0;

   // /** Set of all chunks the entity is contained in */
   // public chunks = new Set<Chunk>();

   // public currentTile!: Tile;

   /** If true, the entity is flagged for deletion at the beginning of the next tick */
   public isRemoved: boolean = false;

   /** If this flag is set to true, then the entity will not move */
   public isStatic: boolean = false;

   /** Impacts how much force an entity experiences which pushing away from another entity */
   private pushForceMultiplier = 1;

   public readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType) {
      super(position);

      this.id = findAvailableEntityID();
      this.type = entityType;
      
      // this.position = position;
      this.components = components;
      this.tickableComponents = filterTickableComponents(components);

      // this.updateCurrentTile();


      for (const component of Object.values(components) as Array<Component>) {
         component.setEntity(this);
      }

      // Load components. Must be done after all of them set their entity as the components might reference each other
      for (const component of Object.values(components) as Array<Component>) {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      }

      addEntityToCensus(this.type);

      // Add the entity to the join buffer
      // SERVER.board.addEntityToJoinBuffer(this);
   }

   public abstract getClientArgs(): Parameters<EntityInfoClientArgs[EntityType]>;

   /** Called after every physics update. */
   public tick(): void {
      super.tick();

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

   public getComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] | null {
      if (this.components.hasOwnProperty(name)) {
         return this.components[name] as EntityComponents[C];
      }
      return null;
   }

   // public addHitboxes(hitboxes: ReadonlyArray<Hitbox<HitboxType>>): void {
   //    for (const hitbox of hitboxes) {
   //       hitbox.setHitboxObject(this);

   //       // If the hitbox is already active, add it to the list of active hitboxes
   //       if (hitbox.isActive) {
   //          this.hitboxes.add(hitbox);
   //       } else {
   //          // Otherwise add it to the list of inactive hitboxes and wait for it to become active
   //          this.inactiveHitboxes.add(hitbox);
   //          hitbox.addActivationCallback(() => this.activateHitbox(hitbox));
   //       }
   //    }
   // }

   // private activateHitbox(hitbox: Hitbox<HitboxType>): void {
   //    this.inactiveHitboxes.delete(hitbox);
   //    this.hitboxes.add(hitbox);
   // }

   /** Calculates the tile the entity is currently in using its position */
   // private calculateCurrentTile(): Tile {
   //    const tileX = Math.floor(this.position.x / SETTINGS.TILE_SIZE);
   //    const tileY = Math.floor(this.position.y / SETTINGS.TILE_SIZE);

   //    return SERVER.board.getTile(tileX, tileY);
   // }

   // public updateTile(): void {
   //    this.currentTile = this.calculateCurrentTile();
   // }

   // public applyPhysics(): void {
   //    const tileTypeInfo = TILE_TYPE_INFO_RECORD[this.currentTile.type];

   //    const tileMoveSpeedMultiplier = tileTypeInfo.moveSpeedMultiplier || 1;

   //    const terminalVelocity = this.terminalVelocity * tileMoveSpeedMultiplier;

   //    // Friction
   //    if (this.velocity !== null) {
   //       this.velocity.magnitude /= 1 + 1 / SETTINGS.TPS;
   //    }
      
   //    // Accelerate
   //    if (this.acceleration !== null) {
   //       const acceleration = this.acceleration.copy();
   //       acceleration.magnitude *= tileTypeInfo.friction * tileMoveSpeedMultiplier / SETTINGS.TPS;

   //       const magnitudeBeforeAdd = this.velocity?.magnitude || 0;
   //       // Add acceleration to velocity
   //       if (this.velocity !== null) {
   //          this.velocity.add(acceleration);
   //       } else {
   //          this.velocity = acceleration;
   //       }

   //       // Don't accelerate past terminal velocity
   //       if (this.velocity.magnitude > terminalVelocity && this.velocity.magnitude > magnitudeBeforeAdd) {
   //          if (magnitudeBeforeAdd < terminalVelocity) {
   //             this.velocity.magnitude = terminalVelocity;
   //          } else {
   //             this.velocity.magnitude = magnitudeBeforeAdd;
   //          }
   //       }
   //    // Friction
   //    } else if (this.velocity !== null) {
   //       this.velocity.magnitude -= SETTINGS.FRICTION_CONSTANT * tileTypeInfo.friction / SETTINGS.TPS;
   //       if (this.velocity.magnitude <= 0) {
   //          this.velocity = null;
   //       }
   //    }

   //    // Apply velocity
   //    if (this.velocity !== null) {
   //       const velocity = this.velocity.copy();
   //       velocity.magnitude /= SETTINGS.TPS;
         
   //       this.position.add(velocity.convertToPoint());
   //    }
   // }

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
            this.getComponent("health")!.damage(1, 0, 0, null);
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

   public remove(): void {
      this.isRemoved = true;
   }
}

export default Entity;