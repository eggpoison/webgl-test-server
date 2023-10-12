import { GameObjectDebugData, Point } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { MobAIType } from "../mob-ai-types";

interface MoveAIParams extends BaseAIParams<MobAIType.move> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly getMoveTargetPosition: () => Point | null;
}

class MoveAI extends AI<MobAIType.move> implements MoveAIParams {
   public readonly type = MobAIType.move;
   
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly getMoveTargetPosition: () => Point | null;

   constructor(mob: Mob, aiParams: MoveAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.getMoveTargetPosition = aiParams.getMoveTargetPosition;
   }

   public tick(): void {
      super.tick();

      const targetPosition = this.getMoveTargetPosition();
      if (targetPosition !== null) {
         // Move to the target position
         super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity);
      } else {
         // Stop moving if there is no target position
         this.mob.terminalVelocity = 0;
         this.mob.acceleration.x = 0;
         this.mob.acceleration.y = 0;
      }
   }

   public canSwitch(): boolean {
      return this.getMoveTargetPosition() !== null;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.targetPosition === null) return;
      
      debugData.lines.push(
         {
            targetPosition: this.targetPosition.package(),
            colour: [1, 0, 1],
            thickness: 2
         }
      );
   }
}

export default MoveAI;