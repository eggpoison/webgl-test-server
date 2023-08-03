import { GameObjectDebugData, Point } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";

interface MoveAIParams extends BaseAIParams<"escape"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly getMoveTargetPosition: () => Point | null;
}

class MoveAI extends AI<"move"> implements MoveAIParams {
   public readonly type = "move";
   
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

      // Move to the target position
      const targetPosition = this.getMoveTargetPosition();
      if (targetPosition !== null) {
         super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity);
      } else {
         // super.
      }
   }

   protected _getWeight(): number {
      return this.getMoveTargetPosition() !== null ? 1 : 0;
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

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default MoveAI;