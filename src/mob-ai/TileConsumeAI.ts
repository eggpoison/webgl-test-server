import { SETTINGS, TileInfo, TileType, randFloat } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import Tile from "../Tile";
import AI, { BaseAIParams } from "./AI";
import { MobAIType } from "../mob-ai-types";

type FoodSource = {
   /** Amount of food given by eating the source */
   readonly foodUnits: number;
}

export interface TileFoodSource extends FoodSource {
   /** What the tile turns into after being eaten */
   readonly resultingTileType: TileType;
   /** Time it takes to eat the tile */
   readonly grazeTime: number;
   /** Amount of health restored to the entity when eating a tile */
   readonly healAmount: number;
}

interface TileConsumeAIParams extends BaseAIParams<MobAIType.tileConsume> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly tileTargets?: ReadonlyMap<TileType, TileFoodSource>;
}

class TileConsumeAI extends AI<MobAIType.tileConsume> implements TileConsumeAIParams {
   /** Cooldown in seconds between grazes that the mob can't graze */
   private static readonly GRAZE_COOLDOWN_RANGE = [20, 30] as const;
   
   public readonly type = MobAIType.tileConsume;

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly tileTargets: ReadonlyMap<TileType, TileFoodSource>;

   private grazeTimer: number = 0;
   private grazeCooldown = randFloat(TileConsumeAI.GRAZE_COOLDOWN_RANGE[0], TileConsumeAI.GRAZE_COOLDOWN_RANGE[1]);

   constructor(mob: Mob, aiParams: TileConsumeAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.tileTargets = typeof aiParams.tileTargets !== "undefined" ? aiParams.tileTargets : new Map();
   }

   protected onActivation(): void {
      if (this.isOnGrazeableTile()) {
         this.grazeTimer = this.tileTargets.get(this.mob.tile.type)!.grazeTime;
      }

      this.mob.acceleration.x = 0;
      this.mob.acceleration.y = 0;
   }

   public tick(): void {
      super.tick();

      if (this.isOnGrazeableTile()) {
         this.grazeTimer -= 1 / SETTINGS.TPS;
         if (this.grazeTimer <= 0) {
            const foodInfo = this.tileTargets.get(this.mob.tile.type)!;
            this.graze(foodInfo);
         }
      }
   }
   
   private isOnGrazeableTile(): boolean {
      return this.tileTargets.has(this.mob.tile.type);
   }

   private graze(foodInfo: TileFoodSource): void {
      const healthComponent = this.mob.forceGetComponent("health");
      healthComponent.heal(foodInfo.healAmount);
      
      const previousTile = this.mob.tile;
      const newTileInfo: TileInfo = {
         type: foodInfo.resultingTileType,
         biomeName: previousTile.biomeName,
         isWall: previousTile.isWall
      };
      new Tile(previousTile.x, previousTile.y, newTileInfo.type, newTileInfo.biomeName, newTileInfo.isWall);

      this.grazeCooldown = randFloat(TileConsumeAI.GRAZE_COOLDOWN_RANGE[0], TileConsumeAI.GRAZE_COOLDOWN_RANGE[1]);
   }

   public getGrazeProgress(): number {
      if (!this.tileTargets.has(this.mob.tile.type)) {
         return -1;
      }

      return 1 - this.grazeTimer / this.tileTargets.get(this.mob.tile.type)!.grazeTime;
   }

   public canSwitch(): boolean {
      return this.isOnGrazeableTile() && this.grazeCooldown === 0;
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default TileConsumeAI;