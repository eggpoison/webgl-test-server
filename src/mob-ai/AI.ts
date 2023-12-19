import { GameObjectDebugData, Point } from "webgl-test-shared";
// import Mob from "../entities/mobs/Mob";
import { MobAIType } from "../mob-ai-types";

// abstract class AI {
//    protected readonly mob: Mob;

//    public abstract readonly type: MobAIType;

//    protected isActive: boolean = false;
//    public targetPosition: Point | null = null;

//    public isEnabled = true;

//    constructor(mob: Mob) {
//       this.mob = mob;
//    }

//    public tick(): void {
//       // If the entity has a reached its target position, stop moving
//       if (this.hasReachedTargetPosition()) {
//          this.targetPosition = null;
//          this.mob.acceleration.x = 0;
//          this.mob.acceleration.y = 0;
//       }
//    }

//    public activate(): void {
//       this.isActive = true;
//       this.targetPosition = null;
      
//       if (typeof this.onActivation !== "undefined") this.onActivation();
//    }

//    public deactivate(): void {
//       this.isActive = false;
//    }

//    protected onActivation?(): void;
//    public onRefresh?(): void;

//    public abstract canSwitch(): boolean;

//    private hasReachedTargetPosition(): boolean {
//       if (this.targetPosition === null || this.mob.velocity === null) return false;

//       const relativeTargetPosition = this.mob.position.copy();
//       relativeTargetPosition.subtract(this.targetPosition);

//       const dotProduct = this.mob.velocity.calculateDotProduct(relativeTargetPosition);
//       return dotProduct > 0;
//    }

//    protected moveToPosition(targetPosition: Point, acceleration: number, terminalVelocity: number, direction?: number): void {
//       const _direction = typeof direction === "undefined" ? this.mob.position.calculateAngleBetween(targetPosition) : direction;
      
//       this.targetPosition = targetPosition;
//       this.mob.acceleration.x = acceleration * Math.sin(_direction);
//       this.mob.acceleration.y = acceleration * Math.cos(_direction);
//       this.mob.terminalVelocity = terminalVelocity;
//       if (_direction !== this.mob.rotation) {
//          this.mob.rotation = _direction;
//          this.mob.hitboxesAreDirty = true;
//       }
//    }

//    public addDebugData?(debugData: GameObjectDebugData): void;
// }

// export default AI;