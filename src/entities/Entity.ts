import { EntityInfoClientArgs, EntityType, GameObjectDebugData, PlayerCauseOfDeath, Point, SETTINGS, STATUS_EFFECT_MODIFIERS, StatusEffectData, StatusEffectType, Vector, lerp, randFloat, randItem, randSign } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import _GameObject, { GameObjectEvents } from "../GameObject";

export interface EntityComponents {
   health: HealthComponent;
   inventory: InventoryComponent;
   item_creation: ItemCreationComponent;
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

interface StatusEffect {
   durationSeconds: number;
   secondsRemaining: number;
   ticksElapsed: number;
}

interface EntityEvents extends GameObjectEvents {
   hurt: (damage: number, attackingEntity: Entity | null, knockback: number, hitDirection: number | null) => void;
   death: (attackingEntity: Entity | null) => void;
}

abstract class Entity extends _GameObject<"entity", EntityEvents> {
   public readonly i = "entity" as const;
   
   private readonly components: Partial<{ [key in keyof EntityComponents]: EntityComponents[key] }> = {};
   private readonly tickableComponents: ReadonlyArray<Component>;

   public readonly type: EntityType;

   protected readonly events = {
      hurt: [],
      death: [],
      on_knockback: [],
      on_destroy: [],
      enter_collision: [],
      during_collision: [],
      enter_entity_collision: [],
      during_entity_collision: []
   };

   private readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType) {
      super(position);

      this.type = entityType;
      
      this.components = components;
      this.tickableComponents = filterTickableComponents(components);

      for (const component of Object.values(components) as Array<Component>) {
         component.setEntity(this);
      }

      // Load components. Must be done after all of them set their entity as the components might reference each other
      for (const component of Object.values(components) as Array<Component>) {
         if (typeof component.onLoad !== "undefined") component.onLoad();
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

   public getMoveSpeedMultiplier(): number {
      let moveSpeedMultiplier = 1;

      for (const statusEffect of Object.keys(this.statusEffects) as ReadonlyArray<StatusEffectType>) {
         moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
      }

      return moveSpeedMultiplier;
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
            this.clearStatusEffect(statusEffectType);
         }    
      }

      if (this.statusEffects.hasOwnProperty("burning")) {
         // If the entity is in a river, clear the fire effect
         if (this.isInRiver()) {
            this.clearStatusEffect("burning");
         } else {
            // Fire tick
            if (this.statusEffects.burning!.ticksElapsed % 15 === 0) {
               this.getComponent("health")!.damage(1, 0, null, null, PlayerCauseOfDeath.fire, 0);
            }
         }
      }

      if (this.hasStatusEffect("poisoned")) {
         if (this.statusEffects.poisoned!.ticksElapsed % 10 === 0) {
            this.getComponent("health")!.damage(1, 0, null, null, PlayerCauseOfDeath.poison, 0);
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

   public clearStatusEffect(type: StatusEffectType): void {
      delete this.statusEffects[type];
   }

   public getStatusEffectData(): Array<StatusEffectData> {
      const data = new Array<StatusEffectData>();
      for (const [type, statusEffect] of Object.entries(this.statusEffects) as ReadonlyArray<[StatusEffectType, StatusEffect]>) {
         data.push({
            type: type,
            ticksElapsed: statusEffect.ticksElapsed
         });
      }
      return data;
   }

   public getDebugData(): GameObjectDebugData {
      const debugData = super.getDebugData();

      for (const component of Object.values(this.components)) {
         if (typeof component.addDebugData !== "undefined") {
            component.addDebugData(debugData);
         }
      }
      
      return debugData;
   }
}

export default Entity;