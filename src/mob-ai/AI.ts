import { GameObjectDebugData, Point } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob from "../entities/mobs/Mob";
import DroppedItem from "../items/DroppedItem";
import { MobAIType } from "../mob-ai-types";

export interface AICallbackFunctions {
   [MobAIType.wander]: () => void,
   [MobAIType.follow]: () => void,
   [MobAIType.herd]: () => void,
   [MobAIType.tileConsume]: () => void,
   [MobAIType.itemConsume]: () => void,
   [MobAIType.escape]: () => void,
   [MobAIType.chase]: (targetEntity: Entity | null) => void,
   [MobAIType.berryBushShake]: () => void,
   [MobAIType.move]: () => void;
   [MobAIType.item_chase]: (target: DroppedItem | null) => void;
}

export interface BaseAIParams<T extends MobAIType> {
   readonly callback?: AICallbackFunctions[T];
}

abstract class AI<T extends MobAIType> implements BaseAIParams<T> {
   protected readonly mob: Mob;
   
   public readonly callback?: AICallbackFunctions[T];

   public abstract readonly type: T;

   protected isActive: boolean = false;
   protected targetPosition: Point | null = null;
   protected entitiesInVisionRange!: ReadonlySet<Entity>;

   constructor(mob: Mob, baseAIParams: BaseAIParams<T>) {
      this.mob = mob;
      this.callback = baseAIParams.callback;
   }

   public tick(): void {
      // If the entity has a reached its target position, stop moving
      if (this.hasReachedTargetPosition()) {
         this.targetPosition = null;
         this.mob.acceleration.x = 0;
         this.mob.acceleration.y = 0;
      }
   }

   public activate(): void {
      this.isActive = true;
      this.targetPosition = null;
      
      if (typeof this.onActivation !== "undefined") this.onActivation();
   }

   public deactivate(): void {
      this.isActive = false;
   }

   protected onActivation?(): void;
   public onDeactivation?(): void;
   public onRefresh?(): void;

   protected filterEntitiesInVisionRange(visibleEntities: ReadonlySet<Entity>): ReadonlySet<Entity> {
      return visibleEntities;
   }

   public updateValues(entitiesInVisionRange: Set<Entity>): void {
      this.entitiesInVisionRange = this.filterEntitiesInVisionRange(entitiesInVisionRange);
   }

   public abstract canSwitch(): boolean;

   private hasReachedTargetPosition(): boolean {
      if (this.targetPosition === null || this.mob.velocity === null) return false;

      const relativeTargetPosition = this.mob.position.copy();
      relativeTargetPosition.subtract(this.targetPosition);

      const dotProduct = this.mob.velocity.calculateDotProduct(relativeTargetPosition);
      return dotProduct > 0;
   }

   protected moveToPosition(targetPosition: Point, acceleration: number, terminalVelocity: number, direction?: number): void {
      const _direction = typeof direction === "undefined" ? this.mob.position.calculateAngleBetween(targetPosition) : direction;
      
      this.targetPosition = targetPosition;
      this.mob.acceleration.x = acceleration * Math.sin(_direction);
      this.mob.acceleration.y = acceleration * Math.cos(_direction);
      this.mob.terminalVelocity = terminalVelocity;
      this.mob.rotation = _direction;
   }

   public addDebugData?(debugData: GameObjectDebugData): void;

   public callCallback(): void {
      if (typeof this.callback !== "undefined") {
         this._callCallback(this.callback);
      }
   }

   protected abstract _callCallback(callback: AICallbackFunctions[T]): void;
}

export default AI;