import { EntityInfoClientArgs, EntityType, Point, SETTINGS } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import _GameObject from "../GameObject";
import { addEntityToCensus } from "../entity-spawning";

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

abstract class Entity extends _GameObject<"entity"> {
   public readonly i = "entity" as const;
   
   private readonly components: Partial<{ [key in keyof EntityComponents]: EntityComponents[key] }> = {};
   private readonly tickableComponents: ReadonlyArray<Component>;

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

   // /** Impacts how much force an entity experiences which pushing away from another entity */
   // private pushForceMultiplier = 1;

   public readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, isNaturallySpawned: boolean) {
      super(position);

      this.type = entityType;
      
      // this.position = position;
      this.components = components;
      this.tickableComponents = filterTickableComponents(components);

      for (const component of Object.values(components) as Array<Component>) {
         component.setEntity(this);
      }

      // Load components. Must be done after all of them set their entity as the components might reference each other
      for (const component of Object.values(components) as Array<Component>) {
         if (typeof component.onLoad !== "undefined") component.onLoad();
      }

      if (isNaturallySpawned) {
         addEntityToCensus(this);
      }
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

   // public setPushForceMultiplier(pushForceMultiplier: number): void {
   //    this.pushForceMultiplier = pushForceMultiplier;
   // }

   public setIsStatic(isStatic: boolean): void {
      this.isStatic = isStatic;
   }

   public getComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] | null {
      if (this.components.hasOwnProperty(name)) {
         return this.components[name] as EntityComponents[C];
      }
      return null;
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
            this.getComponent("health")!.damage(1, 0, null, null);
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