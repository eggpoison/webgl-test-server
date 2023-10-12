import { ALL_TILE_TYPES, GameObjectDebugData, Point, SETTINGS, TileType, randInt, randItem } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI, { BaseAIParams } from "./AI";
import { getAllowedPositionRadialTiles } from "../ai-shared";
import { MobAIType } from "../mob-ai-types";

interface WanderAIParams extends BaseAIParams<MobAIType.wander> {
   /** The average number of times that an entity will wander in a second */
   readonly wanderRate: number;
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Tile types which the entity will wander to */
   readonly validTileTargets?: ReadonlyArray<TileType>;
   readonly shouldWander?: (wanderPositionX: number, wanderPositionY: number) => boolean;
}

class WanderAI extends AI<MobAIType.wander> implements WanderAIParams {
   public readonly type = MobAIType.wander;
   
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly validTileTargets: ReadonlyArray<TileType>;
   public readonly shouldWander?: ((wanderPositionX: number, wanderPositionY: number) => boolean) | undefined;

   constructor(mob: Mob, aiParams: WanderAIParams) {
      super(mob, aiParams);

      this.wanderRate = aiParams.wanderRate;
      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.validTileTargets = aiParams.validTileTargets || ALL_TILE_TYPES;
      this.shouldWander = aiParams.shouldWander;
   }
   
   protected onActivation(): void {
      this.mob.acceleration.x = 0;
      this.mob.acceleration.y = 0;
   }

   public tick(): void {
      super.tick();

      // Only try to wander if not moving
      if (this.mob.velocity.x === 0 && this.mob.velocity.y === 0 && Math.random() < this.wanderRate / SETTINGS.TPS) {
         this.wander();
      }
   }

   private wander(): void {
      // @Speed: This always checks a very large number of tiles
      
      const wanderTiles = getAllowedPositionRadialTiles(this.mob.position, this.mob.visionRange, this.validTileTargets);
      if (wanderTiles.length === 0) return;

      // Look randomly through the array for a target position
      const indexes = wanderTiles.map((_, i) => i);
      while (indexes.length > 0) {
         const tempIdx = randInt(0, indexes.length - 1);
         const idx = indexes[tempIdx];
         indexes.splice(tempIdx, 1);

         const tile = wanderTiles[idx];

         const wanderPositionX = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
         const wanderPositionY = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;

         // If the mob should wander to the position, do so
         if (typeof this.shouldWander === "undefined" || this.shouldWander(wanderPositionX, wanderPositionY)) {
            super.moveToPosition(new Point(wanderPositionX, wanderPositionY), this.acceleration, this.terminalVelocity);
            return;
         }
      }

      // If no valid positions can be found then move to a random position
      const tile = randItem(wanderTiles);
      const position = new Point((tile.x + Math.random()) * SETTINGS.TILE_SIZE, (tile.y + Math.random()) * SETTINGS.TILE_SIZE)
      super.moveToPosition(position, this.acceleration, this.terminalVelocity);
   }

   public canSwitch(): boolean {
      return true;
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