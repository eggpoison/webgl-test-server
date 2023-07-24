import { GameObjectDebugData, Point, SETTINGS, TileType, Vector } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { SERVER } from "../server";
import Board from "../Board";

/** Number of points to sample when finding a tile to wander to */
const NUM_SAMPLE_POINTS = 20;

const sampleStepSize = Math.PI * 2 / NUM_SAMPLE_POINTS;

interface WanderAIParams extends BaseAIParams {
   /** The average number of times that an entity will wander in a second */
   readonly wanderRate: number;
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Tile types which the entity will wander to */
   readonly validTileTargets?: ReadonlySet<TileType>;
   readonly shouldWander?: (position: Point) => boolean;
}

class WanderAI extends AI implements WanderAIParams {
   public readonly type = "wander";
   
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly validTileTargets?: ReadonlySet<TileType>;
   public readonly shouldWander?: ((position: Point) => boolean) | undefined;

   constructor(mob: Mob, { aiWeightMultiplier, wanderRate, acceleration, terminalVelocity, validTileTargets, shouldWander }: WanderAIParams) {
      super(mob, { aiWeightMultiplier });

      this.wanderRate = wanderRate;
      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.validTileTargets = validTileTargets;
      this.shouldWander = shouldWander;
   }
   
   protected onActivation(): void {
      this.mob.acceleration = null;
   }

   public tick(): void {
      super.tick();

      // Only try to wander if not moving
      if (this.mob.velocity === null && Math.random() < this.wanderRate / SETTINGS.TPS) {
         let targetPosition!: Point;

         const dist = this.mob.visionRange * Math.random();
         let direction = 2 * Math.PI * Math.random();
         for (let i = 0; i < NUM_SAMPLE_POINTS; i++) {
            // Calculate sample position
            const samplePosition = this.mob.position.copy();
            samplePosition.add(new Vector(dist, direction).convertToPoint());

            // Don't move to out-of-board positions
            if (!Board.isInBoard(samplePosition)) {
               continue;
            }

            if (typeof this.shouldWander !== "undefined" && !this.shouldWander(samplePosition)) {
               continue;
            }

            if (typeof this.validTileTargets === "undefined") {
               targetPosition = samplePosition;
               break;
            } else {
               const tile = Board.getTile(Board.worldToTileX(samplePosition.x), Board.worldToTileY(samplePosition.y));
               if (this.validTileTargets.has(tile.type)) {
                  targetPosition = samplePosition;
                  break;
               }
            }

            direction += sampleStepSize;
         }

         if (typeof targetPosition !== "undefined") {
            super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity, direction);
         }
      }
   }

   protected _getWeight(): number {
      return 1;
   }

   public addDebugData(debugData: GameObjectDebugData): void {
      if (this.targetPosition === null) return;
      
      debugData.lines.push(
         {
            targetPosition: this.targetPosition.package(),
            colour: [0, 0, 1]
         }
      );
   }
}

export default WanderAI;