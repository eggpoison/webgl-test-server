import { EntityInfoClientArgs, EntityTypeConst, GameObjectDebugData, PlayerCauseOfDeath, Point, SETTINGS, STATUS_EFFECT_MODIFIERS, StatusEffect, StatusEffectConst, StatusEffectData, customTickIntervalHasPassed } from "webgl-test-shared";
// import Component from "../entity-components/Component";
// import HealthComponent from "../entity-components/OldHealthComponent";
// import InventoryComponent from "../entity-components/OldInventoryComponent";
// import ItemCreationComponent from "../entity-components/ItemCreationComponent";
// import GameObject, { GameObjectEvents } from "../GameObject";
import { cleanAngle } from "../ai-shared";
// import HungerComponent from "../entity-components/HungerComponent";
import Board from "../Board";
import Chunk from "src/Chunk";
// import Mob from "./mobs/Mob";

// export interface EntityComponents {
//    health: HealthComponent;
//    inventory: InventoryComponent;
//    item_creation: ItemCreationComponent;
//    hunger: HungerComponent;
// }

// const filterTickableComponents = (components: Partial<EntityComponents>): ReadonlyArray<Component> => {
//    const tickableComponents = new Array<Component>();
//    for (const component of Object.values(components) as Array<Component>) {
//       if (typeof component.tick !== "undefined") {
//          tickableComponents.push(component);
//       }
//    }
//    return tickableComponents;
// }

// const NUM_STATUS_EFFECTS = Object.keys(STATUS_EFFECT_MODIFIERS).length;

// interface EntityEvents extends GameObjectEvents {
//    hurt: (damage: number, attackingEntity: Entity | null, knockback: number, hitDirection: number | null) => void;
//    death: (attackingEntity: Entity | null) => void;
// }

// // @Cleanup: Instead of passing components through constructor, have function to add them

// abstract class Entity extends GameObject<EntityEvents> {
//    private readonly components: Partial<{ [key in keyof EntityComponents]: EntityComponents[key] }> = {};
//    private readonly tickableComponents: ReadonlyArray<Component>;

//    public readonly type: EntityTypeConst;

//    protected readonly events = {
//       hurt: [],
//       death: [],
//       on_knockback: [],
//       on_destroy: [],
//       enter_collision: [],
//       during_collision: [],
//       enter_entity_collision: [],
//       during_entity_collision: [],
//       during_dropped_item_collision: []
//    };

//    private readonly statusEffectTicksRemaining = [0, 0, 0, 0];
//    private readonly statusEffectTicksElapsed = [0, 0, 0, 0];

//    constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityTypeConst) {
//       super(position);

//       this.type = entityType;
      
//       this.components = components;
//       this.tickableComponents = filterTickableComponents(components);

//       for (const component of Object.values(components) as Array<Component>) {
//          component.setEntity(this);
//       }

//       // Load components. Must be done after all of them set their entity as the components might reference each other
//       for (const component of Object.values(components) as Array<Component>) {
//          if (typeof component.onLoad !== "undefined") component.onLoad();
//       }

//       Board.addEntityToJoinBuffer(this);
//    }

//    public abstract getClientArgs(): Parameters<EntityInfoClientArgs[EntityTypeConst]>;
   
//    public callCollisionEvent(gameObject: GameObject): void {
//       gameObject.callEvents("during_entity_collision", this);
//    }

//    public addToMobVisibleGameObjects(mob: Mob): void {
//       mob.visibleGameObjects.push(this);
//       mob.visibleEntities.push(this);
//    }

//    /** Called after every physics update. */
//    public tick(): void {
//       super.tick();

//       // Tick components
//       // @Speed: This is sorta slow, perhaps try making just one massive container storing all tickable components???
//       const numTickableComponents = this.tickableComponents.length;
//       for (let i = 0; i < numTickableComponents; i++) {
//          this.tickableComponents[i].tick!();
//       }
      
//       // Tick status effects
//       this.tickStatusEffects();
//    }

//    public getComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] | null {
//       if (this.components.hasOwnProperty(name)) {
//          return this.components[name] as EntityComponents[C];
//       }
//       return null;
//    }

//    public forceGetComponent<C extends keyof EntityComponents>(name: C): EntityComponents[C] {
//       return this.components[name] as EntityComponents[C];
//    }

//    private tickStatusEffects(): void {
//       for (let statusEffect = 0; statusEffect < NUM_STATUS_EFFECTS; statusEffect++) {
//          const ticksRemaining = this.statusEffectTicksRemaining[statusEffect];
//          if (ticksRemaining > 0) {
//             this.statusEffectTicksRemaining[statusEffect]--;
//             this.statusEffectTicksElapsed[statusEffect]++;
//             if (this.statusEffectTicksRemaining[statusEffect] === 0) {
//                this.clearStatusEffect(statusEffect);
//             }

//             switch (statusEffect) {
//                case StatusEffectConst.burning: {
//                   // If the entity is in a river, clear the fire effect
//                   if (this.isInRiver) {
//                      this.clearStatusEffect(StatusEffectConst.burning);
//                   } else {
//                      // Fire tick
//                      const ticksElapsed = this.statusEffectTicksElapsed[StatusEffectConst.burning];
//                      if (customTickIntervalHasPassed(ticksElapsed, 0.75)) {
//                         this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.fire, 0);
//                      }
//                   }
//                   break;
//                }
//                case StatusEffectConst.poisoned: {
//                   const ticksElapsed = this.statusEffectTicksElapsed[StatusEffectConst.poisoned];
//                   if (customTickIntervalHasPassed(ticksElapsed, 0.5)) {
//                      this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.poison, 0);
//                   }
//                   break;
//                }
//                case StatusEffectConst.bleeding: {
//                   const ticksElapsed = this.statusEffectTicksElapsed[StatusEffectConst.bleeding];
//                   if (customTickIntervalHasPassed(ticksElapsed, 1)) {
//                      this.forceGetComponent("health").damage(1, 0, null, null, PlayerCauseOfDeath.bloodloss, 0);
//                   }
//                   break;
//                }
//             }
//          }
//       }
//    }

//    public applyStatusEffect(statusEffect: StatusEffectConst, durationTicks: number): void {
//       if (!this.hasStatusEffect(statusEffect)) {
//          // New status effect
         
//          this.statusEffectTicksElapsed[statusEffect] = 0;
//          this.statusEffectTicksRemaining[statusEffect] = durationTicks;

//          this.moveSpeedMultiplier *= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
//       } else {
//          // Existing status effect

//          if (durationTicks > this.statusEffectTicksRemaining[statusEffect]) {
//             this.statusEffectTicksRemaining[statusEffect] = durationTicks;
//          }
//       }
//    }

//    public hasStatusEffect(statusEffect: StatusEffectConst): boolean {
//       return this.statusEffectTicksRemaining[statusEffect] > 0;
//    }

//    public clearStatusEffect(statusEffect: StatusEffectConst): void {
//       this.statusEffectTicksRemaining[statusEffect] = 0;
//       this.moveSpeedMultiplier /= STATUS_EFFECT_MODIFIERS[statusEffect].moveSpeedMultiplier;
//    }

//    public getStatusEffectData(): Array<StatusEffectData> {
//       const data = new Array<StatusEffectData>();
//       for (let statusEffect = 0; statusEffect < NUM_STATUS_EFFECTS; statusEffect++) {
//          if (this.hasStatusEffect(statusEffect)) {
//             data.push({
//                type: statusEffect as StatusEffect,
//                ticksElapsed: this.statusEffectTicksElapsed[statusEffect]
//             });
//          }
//       }
//       return data;
//    }

//    public getDebugData(): GameObjectDebugData {
//       const debugData = super.getDebugData();

//       for (const component of Object.values(this.components)) {
//          if (typeof component.addDebugData !== "undefined") {
//             component.addDebugData(debugData);
//          }
//       }
      
//       return debugData;
//    }

//    protected turn(targetRotation: number, turnSpeed: number): void {
//       if (this.shouldTurnClockwise(targetRotation)) {  
//          this.rotation += turnSpeed / SETTINGS.TPS;
//          if (!this.shouldTurnClockwise(targetRotation)) {
//             this.rotation = targetRotation;
//          } else if (this.rotation >= Math.PI * 2) {
//             this.rotation -= Math.PI * 2;
//          }
//       } else {
//          this.rotation -= turnSpeed / SETTINGS.TPS
//          if (this.shouldTurnClockwise(targetRotation)) {
//             this.rotation = targetRotation;
//          } else if (this.rotation < 0) {
//             this.rotation += Math.PI * 2;
//          }
//       }
//       this.hitboxesAreDirty = true;
//    }

//    protected shouldTurnClockwise(targetRotation: number): boolean {
//       // @Temporary @Speed: instead of doing this, probably just clean rotation after all places which could dirty it
//       this.cleanRotation();
      
//       const clockwiseDist = (targetRotation - this.rotation + Math.PI * 2) % (Math.PI * 2);
//       const anticlockwiseDist = (Math.PI * 2) - clockwiseDist;
//       if (clockwiseDist < 0 || anticlockwiseDist < 0) {
//          throw new Error("Either targetRotation or this.rotation wasn't in the 0-to-2-pi range. Target rotation: " + targetRotation + ", rotation: " + this.rotation);
//       }
//       return clockwiseDist < anticlockwiseDist;
//    }

//    protected cleanRotation(): void {
//       const rotation = cleanAngle(this.rotation);
//       if (rotation !== this.rotation) {
//          this.hitboxesAreDirty = true;
//          this.rotation = rotation;
//       }
//    }

//    protected getClosestEntity(entities: ReadonlyArray<Entity>): Entity {
//       if (entities.length === 0) {
//          throw new Error("No entities in array");
//       }

//       let closestEntity!: Entity;
//       let minDistance = Number.MAX_SAFE_INTEGER;
//       for (const entity of entities) {
//          const dist = this.position.calculateDistanceBetween(entity.position);
//          if (dist < minDistance) {
//             closestEntity = entity;
//             minDistance = dist;
//          }
//       }
//       return closestEntity;
//    }

//    protected addToChunk(chunk: Chunk): void {
//       super.addToChunk(chunk);
//       chunk.entities.add(this);
//    }

//    public removeFromChunk(chunk: Chunk): void {
//       super.removeFromChunk(chunk);
//       chunk.entities.delete(this);
//    }

//    public remove(): void {
//       if (!this.isRemoved) {
//          super.remove();
//          Board.addEntityToRemoveBuffer(this);
//          Board.removeEntityFromJoinBuffer(this);
//       }
//    }
// }

// export default Entity;