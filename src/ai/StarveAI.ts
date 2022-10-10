import { EntityType, SETTINGS, TileType } from "webgl-test-shared";
import Mob from "../entities/Mob";
import AI, { BaseAIParams } from "./AI";

type FoodSource = {
   /** Amount of food given by eating the source */
   readonly foodUnits: number;
}

export interface TileFoodSource extends FoodSource {
   readonly targetTileType: TileType;
   /** What the tile turns into after being eaten */
   readonly resultingTileType: TileType;
   /** Time it takes to finish eating the tile */
   readonly digestTime: number;
}

interface EntityFoodSource extends FoodSource {
   readonly targetEntityType: EntityType;
}

interface HerdAIParams extends BaseAIParams {
   /** Max units of food that the mob can store */
   readonly stomachCapacity: number;
   /** Amount of food units used every second */
   readonly metabolism: number;
   readonly tileTargets?: ReadonlySet<TileFoodSource>;
   readonly entityTargets?: ReadonlySet<EntityFoodSource>;
}

class GrazeAI extends AI implements HerdAIParams {
   public readonly stomachCapacity: number;
   public readonly metabolism: number;
   public readonly tileTargets: ReadonlySet<TileFoodSource>;
   public readonly entityTargets: ReadonlySet<EntityFoodSource>;

   private food: number;

   constructor(mob: Mob, { aiWeightMultiplier, stomachCapacity, metabolism, tileTargets, entityTargets }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });

      this.stomachCapacity = stomachCapacity;
      this.metabolism = metabolism;
      this.tileTargets = typeof tileTargets !== "undefined" ? tileTargets : new Set();
      this.entityTargets = typeof entityTargets !== "undefined" ? entityTargets : new Set();

      // Spawn with a full stomach
      this.food = stomachCapacity;
   }

   public tick(): void {
      super.tick();
      
      this.food -= this.metabolism / SETTINGS.TPS;
      if (this.food < 0) {
         this.food = 0;
      }
   }

   protected _getWeight(): number {
      return 1;
   }
}

export default GrazeAI;