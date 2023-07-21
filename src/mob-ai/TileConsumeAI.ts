import { SETTINGS, TileInfo, TileType } from "webgl-test-shared";
import Mob from "../entities/mobs/Mob";
import Tile from "../tiles/Tile";
import { createGenericTile } from "../tiles/tile-class-record";
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

interface TileConsumeAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   readonly metabolism: number;
   readonly tileTargets?: ReadonlyMap<TileType, TileFoodSource>;
}

class TileConsumeAI extends AI implements TileConsumeAIParams {
   private static readonly STOMACH_CAPACITY = 100;

   public readonly type = "tileConsume";

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly metabolism: number;
   public readonly tileTargets: ReadonlyMap<TileType, TileFoodSource>;

   private hunger: number = 0;

   private grazeTimer: number = 0;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, metabolism, tileTargets }: TileConsumeAIParams) {
      super(mob, { aiWeightMultiplier });

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.metabolism = metabolism;
      this.tileTargets = typeof tileTargets !== "undefined" ? tileTargets : new Map();
   }

   public onRefresh(): void {
      // // Find the highest food source
      // let mostNutritiousFoodSource: Tile | undefined;
      // let highestFoodValue: number = 0;
      // if (this.tileTargets.has(this.mob.currentTile.type)) {
      //    const tileFoodInfo = this.tileTargets.get(this.mob.currentTile.type)!;
      //    if (tileFoodInfo.foodUnits > highestFoodValue) {
      //       mostNutritiousFoodSource = this.mob.currentTile;
      //    }
      // }

      // const previousTarget = this.target;

      // if (typeof mostNutritiousFoodSource === "undefined") {
      //    this.target = null;
      //    return;
      // } else {
      //    this.target = mostNutritiousFoodSource;
      // }

      // const target = this.target as Tile;

      // this.mob.acceleration = null;

      // if (previousTarget !== this.target) {
      //    const foodInfo = this.tileTargets.get(target.type)!;
      //    this.grazeTimer = foodInfo.grazeTime;
      // }
   }

   protected onActivation(): void {
      if (this.canGraze()) {
         this.grazeTimer = this.tileTargets.get(this.mob.tile.type)!.grazeTime;
      }

      this.mob.acceleration = null;
   }

   // public onDeactivation(): void {
   //    this.target = null;
   // }

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
      createGenericTile(previousTile.x, previousTile.y, newTileInfo);

      this.hunger = 0;
   }

   protected _getWeight(): number {
      this.hunger += this.metabolism / SETTINGS.TPS * Mob.AI_REFRESH_TIME;
      if (this.hunger > TileConsumeAI.STOMACH_CAPACITY) {
         this.hunger = TileConsumeAI.STOMACH_CAPACITY;
      }

      // Try to activate the AI if the entity is on a tile it can eat
      if (this.canGraze() && this.hunger === TileConsumeAI.STOMACH_CAPACITY) {
         return 1;
      }

      return 0;
   }
}

export default TileConsumeAI;