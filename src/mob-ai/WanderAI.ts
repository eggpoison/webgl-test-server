import { ALL_TILE_TYPES_CONST, GameObjectDebugData, Point, SETTINGS, TileTypeConst, randInt, randItem } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import AI from "./AI";
import { getAllowedPositionRadialTiles } from "../ai-shared";
import { MobAIType } from "../mob-ai-types";
import Board, { tileRaytraceMatchesTileTypes } from "../Board";

const ALL_TILE_TYPES_EXCEPT_WATER = ALL_TILE_TYPES_CONST.slice();
const idx = ALL_TILE_TYPES_EXCEPT_WATER.indexOf(TileTypeConst.water);
if (idx !== -1) {
   ALL_TILE_TYPES_EXCEPT_WATER.splice(idx, 1);
}

interface WanderAIParams {
   /** The average number of times that an entity will wander in a second */
   readonly wanderRate: number;
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Tile types which the entity will wander to */
   readonly validTileTargets?: ReadonlyArray<TileTypeConst>;
   /** Whether the wander AI should also validate intermediate tiles, and not default to wandering to a random tile */
   readonly strictValidation: boolean;
   /** Minimum distance from an invalid tile type that the mob can wander to */
   readonly tileValidationPadding: number;
   readonly shouldWander?: (wanderPositionX: number, wanderPositionY: number) => boolean;
}

class WanderAI extends AI implements WanderAIParams {
   public readonly type = MobAIType.wander;
   
   public readonly wanderRate: number;
   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly validTileTargets: ReadonlyArray<TileTypeConst>;
   public readonly strictValidation: boolean;
   public readonly tileValidationPadding: number;
   public readonly shouldWander?: ((wanderPositionX: number, wanderPositionY: number) => boolean) | undefined;

   constructor(mob: Mob, aiParams: WanderAIParams) {
      super(mob);

      this.wanderRate = aiParams.wanderRate;
      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.validTileTargets = aiParams.validTileTargets || ALL_TILE_TYPES_EXCEPT_WATER;
      this.strictValidation = aiParams.strictValidation;
      this.tileValidationPadding = aiParams.tileValidationPadding;
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
      // @Incomplete
      // Randomly picks a position to wander to until a valid position is found.
      // Usually the majority of positions surroundign the mob are valid wander positions, so typically
      // this will not repeat that many times.
      
      const wanderTiles = getAllowedPositionRadialTiles(this.mob.position, this.mob.visionRange, this.validTileTargets);
      if (wanderTiles.length === 0) {
         return;
      }

      // Look randomly through the array for a target position
      const indexes = wanderTiles.map((_, i) => i);
      while (indexes.length > 0) {
         const tempIdx = randInt(0, indexes.length - 1);
         const idx = indexes[tempIdx];
         indexes.splice(tempIdx, 1);

         const tile = wanderTiles[idx];

         const wanderPositionX = (tile.x + Math.random()) * SETTINGS.TILE_SIZE;
         const wanderPositionY = (tile.y + Math.random()) * SETTINGS.TILE_SIZE;

         // If the path to the tile has any bad intermediates, skip it
         if (this.strictValidation && !tileRaytraceMatchesTileTypes(this.mob.position.x, this.mob.position.y, wanderPositionX, wanderPositionY, this.validTileTargets)) {
            continue;
         }

         // If tile is too close to bad tile type, skip it
         if (this.tileValidationPadding > 0) {
            const minTileX = Math.max(Math.floor((wanderPositionX - this.tileValidationPadding) / SETTINGS.TILE_SIZE), 0);
            const maxTileX = Math.min(Math.floor((wanderPositionX + this.tileValidationPadding) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1);
            const minTileY = Math.max(Math.floor((wanderPositionY - this.tileValidationPadding) / SETTINGS.TILE_SIZE), 0);
            const maxTileY = Math.min(Math.floor((wanderPositionY + this.tileValidationPadding) / SETTINGS.TILE_SIZE), SETTINGS.BOARD_DIMENSIONS - 1);

            let isValid = true;
            for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
               for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                  const tile = Board.getTile(tileX, tileY);
                  if (!this.validTileTargets.includes(tile.type)) {
                     isValid = false;
                     break;
                  }
               }
               if (!isValid) {
                  break;
               }
            }
            if (!isValid) {
               continue;
            }
         }

         // If the mob should wander to the position, do so
         if (typeof this.shouldWander === "undefined" || this.shouldWander(wanderPositionX, wanderPositionY)) {
            super.moveToPosition(new Point(wanderPositionX, wanderPositionY), this.acceleration, this.terminalVelocity);
            return;
         }
      }

      // If no valid positions can be found then move to a random position
      if (!this.strictValidation) {
         const tile = randItem(wanderTiles);
         const position = new Point((tile.x + Math.random()) * SETTINGS.TILE_SIZE, (tile.y + Math.random()) * SETTINGS.TILE_SIZE)
         super.moveToPosition(position, this.acceleration, this.terminalVelocity);
      }
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
}

export default WanderAI;