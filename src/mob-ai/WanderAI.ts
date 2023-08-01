import { GameObjectDebugData, Point, SETTINGS, TileType, randInt, randItem } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import Board from "../Board";

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

      const wanderPositions = this.getTileWanderPositions();

      const indexes = wanderPositions.map((_, i) => i);
      while (indexes.length > 0) {
         const tempIdx = randInt(0, indexes.length - 1);
         const idx = indexes[tempIdx];
         indexes.splice(tempIdx, 1);

         const position = wanderPositions[idx];

         // Make sure the mob only moves to valid tile targets
         if (typeof this.validTileTargets !== "undefined") {
            const tile = Board.getTile(Math.floor(position.x / SETTINGS.TILE_SIZE), Math.floor(position.y / SETTINGS.TILE_SIZE));
            if (!this.validTileTargets.has(tile.type)) {
               continue;
            }
         }

         if (typeof this.shouldWander !== "undefined" && !this.shouldWander(position)) {
            continue;
         }

         targetPosition = position;
         break;
      }

      if (typeof targetPosition !== "undefined") {
         super.moveToPosition(targetPosition, this.acceleration, this.terminalVelocity);
      } else {
         // If there are no possible positions, don't wander
         if (wanderPositions.length === 0) return;
         
         // If no valid positions can be found then move to a random position
         const position = randItem(wanderPositions);
         super.moveToPosition(position, this.acceleration, this.terminalVelocity);
      }
   }

   private getTileWanderPositions(): Array<Point> {
      const wanderPositions = new Array<Point>();

      const minTileX = Math.max(Math.min(Math.floor((this.mob.position.x - this.mob.visionRange) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
      const maxTileX = Math.max(Math.min(Math.floor((this.mob.position.x + this.mob.visionRange) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
      const minTileY = Math.max(Math.min(Math.floor((this.mob.position.y - this.mob.visionRange) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);
      const maxTileY = Math.max(Math.min(Math.floor((this.mob.position.y + this.mob.visionRange) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1), 0);

      for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
         for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
            const position = new Point((tileX + Math.random()) * SETTINGS.TILE_SIZE, (tileY + Math.random()) * SETTINGS.TILE_SIZE);
            const distance = this.mob.position.calculateDistanceBetween(position);
            if (distance <= this.mob.visionRange) {
               wanderPositions.push(position);
            }
         }
      }

      return wanderPositions;
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

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default WanderAI;