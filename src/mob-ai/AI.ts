import { GameObjectDebugData, Point, Vector } from "webgl-test-shared";
import Entity from "../entities/Entity";
import Mob, { AIType} from "../entities/mobs/Mob";

export interface AICallbackFunctions {
   wander: () => void,
   follow: () => void,
   herd: () => void,
   tileConsume: () => void,
   itemConsume: () => void,
   escape: () => void,
   chase: (targetEntity: Entity | null) => void,
   berryBushShake: () => void
}

export interface BaseAIParams<T extends AIType> {
   readonly aiWeightMultiplier: number;
   readonly callback?: AICallbackFunctions[T];
}

abstract class AI<T extends AIType> implements BaseAIParams<T> {
   protected readonly mob: Mob;
   
   public readonly aiWeightMultiplier: number;
   public readonly callback?: AICallbackFunctions[T];

   public abstract readonly type: T;
   protected abstract _getWeight(): number;

   protected isActive: boolean = false;
   protected targetPosition: Point | null = null;
   protected entitiesInVisionRange!: Set<Entity>;

   constructor(mob: Mob, { aiWeightMultiplier, callback }: BaseAIParams<T>) {
      this.mob = mob;
      this.aiWeightMultiplier = aiWeightMultiplier;
      this.callback = callback;
   }

   public tick(): void {
      // If the entity has a reached its target position, stop moving
      if (this.hasReachedTargetPosition()) {
         this.targetPosition = null;
         this.mob.acceleration = null;
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

   protected filterEntitiesInVisionRange?(visibleEntities: ReadonlySet<Entity>): Set<Entity>;

   public updateValues(entitiesInVisionRange: Set<Entity>): void {
      if (typeof this.filterEntitiesInVisionRange !== "undefined") {
         this.entitiesInVisionRange = this.filterEntitiesInVisionRange(entitiesInVisionRange);
      } else {
         this.entitiesInVisionRange = entitiesInVisionRange;
      }
   }

   public getWeight(): number {
      const baseWeight = this._getWeight();
      if (baseWeight > 1) throw new Error(`$'{this.type}' type AI returned a weight above 1!`);
      return baseWeight * this.aiWeightMultiplier;
   }

   private hasReachedTargetPosition(): boolean {
      if (this.targetPosition === null || this.mob.velocity === null) return false;

      const relativeTargetPosition = this.mob.position.copy();
      relativeTargetPosition.subtract(this.targetPosition);

      const dotProduct = this.mob.velocity.convertToPoint().calculateDotProduct(relativeTargetPosition);
      return dotProduct > 0;
   }

   protected moveToPosition(targetPosition: Point, acceleration: number, terminalVelocity: number, direction?: number): void {
      const _direction = typeof direction === "undefined" ? this.mob.position.calculateAngleBetween(targetPosition) : direction;
      
      this.targetPosition = targetPosition;
      this.mob.acceleration = new Vector(acceleration, _direction);
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