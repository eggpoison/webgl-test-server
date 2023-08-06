import { EntityInfoClientArgs, EntityType, GameObjectDebugData, ParticleType, Point, SETTINGS, STATUS_EFFECT_MODIFIERS, StatusEffectType, Vector, lerp, randFloat, randItem } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import _GameObject from "../GameObject";
import { addEntityToCensus } from "../census";
import Particle from "../Particle";

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

abstract class Entity extends _GameObject<"entity"> {
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

   public setIsStatic(isStatic: boolean): void {
      this.isStatic = isStatic;
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
            this.removeStatusEffect(statusEffectType);
         }    
      }

      if (this.statusEffects.hasOwnProperty("fire")) {
         if (this.statusEffects.fire!.ticksElapsed % 15 === 0) {
            // Fire tick
            this.getComponent("health")!.damage(1, 0, null, null);
         }

         // Fire particle effects
         if (this.statusEffects.fire!.ticksElapsed % 2 === 0) {
            const spawnPosition = this.position.copy();
            const offset = new Vector(20 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
            spawnPosition.add(offset);

            const lifetime = 1.5;
            
            new Particle({
               type: ParticleType.smoke,
               spawnPosition: spawnPosition,
               initialVelocity: null,
               initialAcceleration: new Vector(120, 0),
               initialRotation: 2 * Math.PI * Math.random(),
               angularAcceleration: 0.75 * Math.PI * randFloat(-1, 1),
               opacity: (age: number): number => {
                  return lerp(0.75, 0, age / lifetime);
               },
               scale: (age: number): number => {
                  const deathProgress = age / lifetime
                  return 1 + deathProgress * 2;
               },
               lifetime: lifetime
            });
         }
      }

      if (this.hasStatusEffect("poisoned")) {
         if (this.statusEffects.poisoned!.ticksElapsed % 10 === 0) {
            this.getComponent("health")!.damage(1, 0, null, null);
         }

         // Poisoned particle effects
         if (this.statusEffects.poisoned!.ticksElapsed % 2 === 0) {
            const spawnPosition = this.position.copy();
            const offset = new Vector(30 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
            spawnPosition.add(offset);

            const lifetime = 1.5;
            
            new Particle({
               type: ParticleType.poisonDroplet,
               spawnPosition: spawnPosition,
               initialVelocity: null,
               initialAcceleration: null,
               initialRotation: 2 * Math.PI * Math.random(),
               opacity: (age: number): number => {
                  return lerp(0.75, 0, age / lifetime);
               },
               lifetime: lifetime
            });
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

   public getStatusEffects(): Array<StatusEffectType> {
      return Object.keys(this.statusEffects) as Array<StatusEffectType>;
   }

   protected createBloodPoolParticle(): void {
      const lifetime = 7.5;

      const spawnPosition = this.position.copy();
      const offset = new Vector(20 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);

      const type = randItem([ParticleType.bloodPoolSmall, ParticleType.bloodPoolMedium, ParticleType.bloodPoolLarge])
      new Particle({
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

   protected createBloodParticle(hitDirection: number): void {
      const spawnPosition = this.position.copy();
      const offset = new Vector(32, hitDirection + Math.PI + 0.2 * Math.PI * (Math.random() - 0.5)).convertToPoint();
      spawnPosition.add(offset);

      const lifetime = randFloat(0.25, 0.4)

      new Particle({
         type: Math.random() < 0.6 ? ParticleType.blood : ParticleType.bloodLarge,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(randFloat(75, 125), 4 * Math.PI * (Math.random() - 0.5)),
         initialAcceleration: null,
         initialRotation: 2 * Math.PI * Math.random(),
         opacity: 1,
         lifetime: lifetime
      });
   }

   protected createFootprintParticle(numFootstepsTaken: number, footstepSpacing: number): void {
      if (this.velocity === null) {
         return;
      }
      
      const footstepAngleOffset = numFootstepsTaken % 2 === 0 ? Math.PI : 0;
      const spawnPosition = this.position.copy();
      const offset = new Vector(footstepSpacing / 2, this.velocity!.direction + footstepAngleOffset + Math.PI/2).convertToPoint();
      spawnPosition.add(offset);

      const lifetime = 4;
      
      new Particle({
         type: ParticleType.footprint,
         spawnPosition: spawnPosition,
         initialVelocity: null,
         initialAcceleration: null,
         initialRotation: 0,
         opacity: (age: number): number => {
            return lerp(0.75, 0, age / lifetime);
         },
         lifetime: lifetime
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