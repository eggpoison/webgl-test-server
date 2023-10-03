import { GameObjectDebugData, Point, SETTINGS, TileType, randInt, randItem } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import Board from "../Board";
import { getPositionRadialTiles } from "../ai-shared";

interface WanderAIParams extends BaseAIParams<"wander"> {
   /** The average number of times that an entity will wander in a second */
   readonly wanderRate: number;
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Tile types which the entity will wander to */
   readonly validTileTargets?: ReadonlySet<TileType>;
   readonly shouldWander?: (position: Point) => boolean;
}

class WanderAI extends AI<"wander"> implements WanderAIParams {
   public readonly type = "wander";
   
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly validTileTargets?: ReadonlySet<TileType>;
   public readonly shouldWander?: ((position: Point) => boolean) | undefined;

   constructor(mob: Mob, aiParams: WanderAIParams) {
      super(mob, aiParams);

      this.wanderRate = aiParams.wanderRate;
      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.validTileTargets = aiParams.validTileTargets;
      this.shouldWander = aiParams.shouldWander;
   }
   
   protected onActivation(): void {
      this.mob.acceleration = null;
   }

   public tick(): void {
      super.tick();

      // Only try to wander if not moving
      if (this.mob.velocity === null && Math.random() < this.wanderRate / SETTINGS.TPS) {
         this.wander();
      }
   }

   private wander(): void {
      let targetPosition: Point | undefined;

      const wanderTiles = getPositionRadialTiles(this.mob.position, this.mob.visionRange);
      if (wanderTiles.length === 0) return;

      // Look randomly through the array for 
      const indexes = wanderTiles.map((_, i) => i);
      while (indexes.length > 0) {
         const tempIdx = randInt(0, indexes.length - 1);
         const idx = indexes[tempIdx];
         indexes.splice(tempIdx, 1);

         const tile = wanderTiles[idx];

         // Make sure the mob only moves to valid tile targets
         if (typeof this.validTileTargets !== "undefined") {
            if (!this.validTileTargets.has(tile.type)) {
               continue;
            }
         }

         const wanderPosition = new Point((tile.x + Math.random()) * SETTINGS.TILE_SIZE, (tile.y + Math.random()) * SETTINGS.TILE_SIZE)

         if (typeof this.shouldWander !== "undefined" && !this.shouldWander(wanderPosition)) {
            continue;
         }

         targetPosition = wanderPosition;
         break;
      }

      if (typeof targetPosition !== "undefined") {
         super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity);
      } else {
         // If no valid positions can be found then move to a random position
         const tile = randItem(wanderTiles);
         const position = new Point((tile.x + Math.random()) * SETTINGS.TILE_SIZE, (tile.y + Math.random()) * SETTINGS.TILE_SIZE)
         super.moveToPosition(position, this.acceleration, this.terminalVelocity);
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
            colour: [0, 0, 1],
            thickness: 2
         }
      );
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default WanderAI;