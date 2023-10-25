import { EntityInfoClientArgs, EntityType, GameObjectDebugData, PlayerCauseOfDeath, Point, SETTINGS, STATUS_EFFECT_MODIFIERS, StatusEffect, StatusEffectData, Vector, customTickIntervalHasPassed, lerp, randFloat, randItem, randSign } from "webgl-test-shared";
import Component from "../entity-components/Component";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent from "../entity-components/InventoryComponent";
import ItemCreationComponent from "../entity-components/ItemCreationComponent";
import GameObject, { GameObjectEvents } from "../GameObject";
import { cleanAngle } from "../ai-shared";
import HungerComponent from "../entity-components/HungerComponent";
import Board from "../Board";
import Chunk from "src/Chunk";
import Mob from "./mobs/Mob";

export interface EntityComponents {
   health: HealthComponent;
   inventory: InventoryComponent;
   item_creation: ItemCreationComponent;
   hunger: HungerComponent;
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

interface StatusEffectInfo {
   secondsRemaining: number;
   ticksElapsed: number;
}

interface EntityEvents extends GameObjectEvents {
   hurt: (damage: number, attackingEntity: Entity | null, knockback: number, hitDirection: number | null) => void;
   death: (attackingEntity: Entity | null) => void;
}

abstract class Entity extends GameObject<EntityEvents> {
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
      during_dropped_item_collision: []
   };

   private readonly statusEffects = new Array<StatusEffect>();
   private readonly statusEffectInfo: Partial<Record<StatusEffect, StatusEffectInfo>> = {};

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

      Board.addEntityToJoinBuffer(this);
   }

   public abstract getClientArgs(): Parameters<EntityInfoClientArgs[EntityType]>;
   
   public callCollisionEvent(gameObject: GameObject): void {
      gameObject.callEvents("during_entity_collision", this);
   }

   public addToMobVisibleGameObjects(mob: Mob): void {
      mob.visibleGameObjects.push(this);
      mob.visibleEntities.push(this);
   }

   /** Called after every physics update. */
   public tick(): void {
      // @Speed @Incomplete: This will not work correctly if something the entity does results in an entity being healed
      const healthComponent = this.getComponent("health");
      if (healthComponent !== null) {
         healthComponent.amountHealedSinceLastPacketSend = 0;
      }
      
      super.tick();

      // Tick components
      // @Speed: This is sorta slow, perhaps try making just one massive container storing all tickable components???
      const numTickableComponents = this.tickableComponents.length;
      for (let i = 0; i < numTickableComponents; i++) {
         this.tickableComponents[i].tick!();
      }
      
      this.tickStatusEffects();
   }

   public getComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] | null {
      if (this.components.hasOwnProperty(name)) {
         return this.components[name] as EntityComponents[C];
      }
      return null;
   }

   public forceGetComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] {
      return this.components[name] as EntityComponents[C];
   }

   private tickStatusEffects(): void {
      for (const statusEffect of this.statusEffects) {
         const statusEffectInfo = this.statusEffectInfo[statusEffect]!
         statusEffectInfo.secondsRemaining -= 1 / SETTINGS.TPS;
         statusEffectInfo.ticksElapsed++;
         if (statusEffectInfo.secondsRemaining <= 0) {
            // Remove the status effect
            this.clearStatusEffect(statusEffect);
         }    
      }

      if (this.hasStatusEffect("burning")) {
         // If the entity is in a river, clear the fire effect
         if (this.checkIsInRiver()) {
            this.clearStatusEffect("burning");
         } else {
            // Fire tick
            if (customTickIntervalHasPassed(this.statusEffectInfo["burning"]!.ticksElapsed, 0.75)) {
               this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.fire, 0);
            }
         }
      }

      if (this.hasStatusEffect("poisoned")) {
         if (customTickIntervalHasPassed(this.statusEffectInfo["poisoned"]!.ticksElapsed, 0.5)) {
            this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.poison, 0);
         }
      }

      if (this.hasStatusEffect("bleeding")) {
         if (customTickIntervalHasPassed(this.statusEffectInfo["bleeding"]!.ticksElapsed, 1)) {
            this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.bloodloss, 0);
         }
      }
   }

   public applyStatusEffect(statusEffect: StatusEffect, durationSeconds: number): void {
      if (!this.hasStatusEffect(statusEffect)) {
         this.statusEffectInfo[statusEffect] = {
            secondsRemaining: durationSeconds,
            ticksElapsed: 0
         };
         this.statusEffects.push(statusEffect);

         this.moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
      } else {
         if (durationSeconds > this.statusEffectInfo[statusEffect]!.secondsRemaining) {
            this.statusEffectInfo[statusEffect]!.secondsRemaining = durationSeconds;
         }
      }
   }

   public hasStatusEffect(statusEffect: StatusEffect): boolean {
      return this.statusEffects.indexOf(statusEffect) !== -1;
   }

   public clearStatusEffect(statusEffect: StatusEffect): void {
      delete this.statusEffectInfo[statusEffect];
      const idx = this.statusEffects.indexOf(statusEffect);
      if (idx !== -1) {
         this.statusEffects.splice(idx);
      }

      this.moveSpeedMultiplier /= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
   }

   public getStatusEffectData(): Array<StatusEffectData> {
      const data = new Array<StatusEffectData>();
      for (const [_statusEffect, statusEffectInfo] of Object.entries(this.statusEffectInfo)) {
         data.push({
            type: _statusEffect as StatusEffect,
            ticksElapsed: statusEffectInfo.ticksElapsed
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

   protected turn(targetRotation: number, turnSpeed: number): void {
      if (this.shouldTurnClockwise(targetRotation)) {  
         this.rotation += turnSpeed / SETTINGS.TPS;
         if (!this.shouldTurnClockwise(targetRotation)) {
            this.rotation = targetRotation;
         } else if (this.rotation >= Math.PI * 2) {
            this.rotation -= Math.PI * 2;
         }
      } else {
         this.rotation -= turnSpeed / SETTINGS.TPS
         if (this.shouldTurnClockwise(targetRotation)) {
            this.rotation = targetRotation;
         } else if (this.rotation < 0) {
            this.rotation += Math.PI * 2;
         }
      }
   }

   protected shouldTurnClockwise(targetRotation: number): boolean {
      // @Temporary @Speed: instead of doing this, probably just clean rotation after all places which could dirty it
      this.cleanRotation();
      
      const clockwiseDist = (targetRotation - this.rotation + Math.PI * 2) % (Math.PI * 2);
      const anticlockwiseDist = (Math.PI * 2) - clockwiseDist;
      if (clockwiseDist < 0 || anticlockwiseDist < 0) {
         throw new Error("Either targetRotation or this.rotation wasn't in the 0-to-2-pi range. Target rotation: " + targetRotation + ", rotation: " + this.rotation);
      }
      return clockwiseDist < anticlockwiseDist;
   }

   protected cleanRotation(): void {
      this.rotation = cleanAngle(this.rotation);
   }

   protected getClosestEntity(entities: ReadonlyArray<Entity>): Entity {
      if (entities.length === 0) {
         throw new Error("No entities in array");
      }

      let closestEntity!: Entity;
      let minDistance = Number.MAX_SAFE_INTEGER;
      for (const entity of entities) {
         const dist = this.position.calculateDistanceBetween(entity.position);
         if (dist < minDistance) {
            closestEntity = entity;
            minDistance = dist;
         }
      }
      return closestEntity;
   }

   protected addToChunk(chunk: Chunk): void {
      super.addToChunk(chunk);
      chunk.entities.add(this);
   }

   public removeFromChunk(chunk: Chunk): void {
      super.removeFromChunk(chunk);
      chunk.entities.delete(this);
   }

   public remove(): void {
      if (!this.isRemoved) {
         super.remove();
         Board.addEntityToRemoveBuffer(this);
         Board.removeEntityFromJoinBuffer(this);
      }
   }
}

export default Entity;