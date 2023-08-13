import { SETTINGS, TileInfo, TileType } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import Tile from "../tiles/Tile";
import AI, { BaseAIParams } from "./AI";

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

interface TileConsumeAIParams extends BaseAIParams<"tileConsume"> {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly tileTargets?: ReadonlyMap<TileType, TileFoodSource>;
}

class TileConsumeAI extends AI<"tileConsume"> implements TileConsumeAIParams {
   public readonly type = "tileConsume";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly tileTargets: ReadonlyMap<TileType, TileFoodSource>;

   private grazeTimer: number = 0;

   constructor(mob: Mob, aiParams: TileConsumeAIParams) {
      super(mob, aiParams);

      this.acceleration = aiParams.acceleration;
      this.terminalVelocity = aiParams.terminalVelocity;
      this.tileTargets = typeof aiParams.tileTargets !== "undefined" ? aiParams.tileTargets : new Map();
   }

   protected onActivation(): void {
      if (this.canGraze()) {
         this.grazeTimer = this.tileTargets.get(this.mob.tile.type)!.grazeTime;
      }

      this.mob.acceleration = null;
   }

   public tick(): void {
      super.tick();

      if (this.canGraze()) {
         this.grazeTimer -= 1 / SETTINGS.TPS;
         if (this.grazeTimer <= 0) {
            const foodInfo = this.tileTargets.get(this.mob.tile.type)!;
            this.graze(foodInfo);
         }
      }
   }
   
   private canGraze(): boolean {
      return this.tileTargets.has(this.mob.tile.type);
   }

   private graze(foodInfo: TileFoodSource): void {
      const healthComponent = this.mob.getComponent("health")!;
      healthComponent.heal(foodInfo.healAmount);
      
      const previousTile = this.mob.tile;
      const newTileInfo: TileInfo = {
         type: foodInfo.resultingTileType,
         biomeName: previousTile.biomeName,
         isWall: previousTile.isWall
      };
      new Tile(previousTile.x, previousTile.y, newTileInfo.type, newTileInfo.biomeName, newTileInfo.isWall);

      this.mob.setAIParam("hunger", 0);
   }

   protected _getWeight(): number {
      const hunger = this.mob.getAIParam("hunger")!;

      // Try to activate the AI if the entity is on a tile it can eat
      if (this.canGraze() && hunger >= 95) {
         return 1;
      }

      return 0;
   }

   protected _callCallback(callback: () => void): void {
      callback();
   }
}

export default TileConsumeAI;