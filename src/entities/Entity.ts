import { EntityInfoClientArgs, EntityType, GameObjectDebugData, ParticleType, PlayerCauseOfDeath, Point, SETTINGS, STATUS_EFFECT_MODIFIERS, StatusEffectData, StatusEffectType, Vector, lerp, randFloat, randItem, randSign } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import _GameObject, { GameObjectEvents } from "../GameObject";
import { addEntityToCensus } from "../census";
import Board from "../Board";
import TexturedParticle from "../TexturedParticle";

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

interface StatusEffect {
   durationSeconds: number;
   secondsRemaining: number;
   ticksElapsed: number;
}

interface EntityEvents extends GameObjectEvents {
   hurt: (damage: number, attackingEntity: Entity | null, knockback: number, hitDirection: number | null) => void;
   death: (attackingEntity: Entity | null) => void;
   on_item_place: (placedEntity: Entity) => void;
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
      during_entity_collision: [],
      on_item_place: []
   };

   private readonly statusEffects: Partial<Record<StatusEffectType, StatusEffect>> = {};

   // TODO: Remove the "isNaturallySpawned" flag. Perhaps instead make a function which adds the entity to the census? But would be inconvenient to use
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType, isNaturallySpawned: boolean) {
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

      if (this.isInRiver() && Board.tickIntervalHasPassed(0.15) && this.acceleration !== null) {
         const lifetime = 1.5;
            
         new TexturedParticle({
            type: ParticleType.waterSplash,
            spawnPosition: this.position.copy(),
            initialVelocity: null,
            initialAcceleration: null,
            initialRotation: 2 * Math.PI * Math.random(),
            opacity: (age: number): number => {
               return lerp(0.75, 0, age / lifetime);
            },
            scale: (age: number): number => {
               return lerp(1, 2, age / lifetime);
            },
            lifetime: lifetime
         });
      }
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
               this.getComponent("health")!.damage(1, 0, null, null, PlayerCauseOfDeath.fire);
            }

            // Fire particle effects
            if (this.statusEffects.burning!.ticksElapsed % 2 === 0) {
               const spawnPosition = this.position.copy();
               const offset = new Vector(20 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
               spawnPosition.add(offset);

               const lifetime = randFloat(1, 1.25);

               const fadeInTime = 0.15;
               
               new TexturedParticle({
                  type: ParticleType.smokeBlack,
                  spawnPosition: spawnPosition,
                  initialVelocity: new Vector(30, 0),
                  // initialAcceleration: new Vector(80, 0),
                  initialAcceleration: new Vector(40, Math.random()),
                  initialRotation: 2 * Math.PI * Math.random(),
                  angularAcceleration: 0.75 * Math.PI * randFloat(-1, 1),
                  opacity: (age: number): number => {
                     if (age <= fadeInTime) {
                        return age / fadeInTime;
                     }
                     return lerp(0.75, 0, (age - fadeInTime) / (lifetime - fadeInTime));
                  },
                  scale: (age: number): number => {
                     const deathProgress = age / lifetime
                     return 1 + deathProgress * 2;
                  },
                  lifetime: lifetime
               });
            }
         }
      }

      if (this.hasStatusEffect("poisoned")) {
         if (this.statusEffects.poisoned!.ticksElapsed % 10 === 0) {
            this.getComponent("health")!.damage(1, 0, null, null, PlayerCauseOfDeath.poison);
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

   protected createBloodPoolParticle(): void {
      const lifetime = 7.5;

      const spawnPosition = this.position.copy();
      const offset = new Vector(20 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);

      const type = randItem([ParticleType.bloodPoolSmall, ParticleType.bloodPoolMedium, ParticleType.bloodPoolLarge])
      new TexturedParticle({
         type: type,
         spawnPosition: spawnPosition,
         initialVelocity: null,
         initialAcceleration: null,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: (age: number) => {
            return 1 - age / lifetime;
         },
         lifetime: lifetime
      });
   }

   protected createFootprintParticle(numFootstepsTaken: number, footstepOffset: number, scale: number, lifetime: number): void {
      if (this.velocity === null) {
         return;
      }

      if (this.tile.type === "water") {
         return;
      }

      const footstepAngleOffset = numFootstepsTaken % 2 === 0 ? Math.PI : 0;
      const spawnPosition = this.position.copy();
      const offset = new Vector(footstepOffset / 2, this.velocity.direction + footstepAngleOffset + Math.PI/2).convertToPoint();
      spawnPosition.add(offset);

      new TexturedParticle({
         type: ParticleType.footprint,
         spawnPosition: spawnPosition,
         initialVelocity: null,
         initialAcceleration: null,
         initialRotation: this.velocity.direction,
         opacity: (age: number): number => {
            return lerp(0.75, 0, age / lifetime);
         },
         lifetime: lifetime,
         scale: scale
      });
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