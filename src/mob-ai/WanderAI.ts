import { Point, SETTINGS, TileType, Vector } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { SERVER } from "../server";

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
}

class WanderAI extends AI implements WanderAIParams {
   public readonly type = "wander";
   
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly validTileTargets?: ReadonlySet<TileType>;

   constructor(mob: Mob, { aiWeightMultiplier, wanderRate: wanderChance, acceleration, terminalVelocity, validTileTargets }: WanderAIParams) {
      super(mob, { aiWeightMultiplier });

      this.wanderRate = wanderChance;
      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.validTileTargets = validTileTargets;
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
            if (!SERVER.board.isInBoard(samplePosition)) {
               continue;
            }

            if (typeof this.validTileTargets === "undefined") {
               targetPosition = samplePosition;
               break;
            } else {
               const tile = SERVER.board.getTile(SERVER.board.worldToTileX(samplePosition.x), SERVER.board.worldToTileY(samplePosition.y));
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
}

export default WanderAI;