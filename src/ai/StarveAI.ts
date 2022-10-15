import { ItemID, randFloat, SETTINGS, TileInfo, TileType } from "webgl-test-shared";
import Mob from "../entities/Mob";
import ItemEntity from "../items/ItemEntity";
import { SERVER } from "../server";
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
}

export interface ItemFoodSource extends FoodSource {

}

interface HerdAIParams extends BaseAIParams {
   readonly acceleration: number;
   readonly terminalVelocity: number;
   /** Amount of food units used every second */
   readonly metabolism: number;
   /** Amount of randomness applied to traits like metabolism */
   readonly traitVariance?: number;
   readonly tileTargets?: ReadonlyMap<TileType, TileFoodSource>;
   readonly itemTargets?: ReadonlyMap<ItemID, ItemFoodSource>;
}

class StarveAI extends AI implements HerdAIParams {
   public readonly type = "starve";
   
   private static readonly STOMACH_CAPACITY = 100;

   public readonly acceleration: number;
   public readonly terminalVelocity: number;
   public readonly metabolism: number;
   public readonly traitVariance: number;
   public readonly tileTargets: ReadonlyMap<TileType, TileFoodSource>;
   public readonly itemTargets: ReadonlyMap<ItemID, ItemFoodSource>;

   private readonly itemEntitiesInRange = new Set<ItemEntity>();

   private food: number;

   /** The food source to move towards */
   private target: ItemEntity | Tile | null = null;

   private grazeTimer: number = 0;

   constructor(mob: Mob, { aiWeightMultiplier, acceleration, terminalVelocity, metabolism, traitVariance, tileTargets, itemTargets }: HerdAIParams) {
      super(mob, { aiWeightMultiplier });

      this.traitVariance = traitVariance || 0;
      const [minVariance, maxVariance] = [1 - this.traitVariance, 1 + this.traitVariance];
      
      this.metabolism = metabolism * (randFloat(minVariance, maxVariance));

      this.acceleration = acceleration;
      this.terminalVelocity = terminalVelocity;
      this.tileTargets = typeof tileTargets !== "undefined" ? tileTargets : new Map();
      this.itemTargets = typeof itemTargets !== "undefined" ? itemTargets : new Map();

      // Spawn with a full stomach
      this.food = StarveAI.STOMACH_CAPACITY;
   }

   public onRefresh(): void {
      // Find the highest food source
      let mostNutritiousFoodSource: ItemEntity | Tile | undefined;
      let highestFoodValue: number = 0;
      for (const itemEntity of this.itemEntitiesInRange) {
         const itemEntityFoodInfo = this.itemTargets.get(itemEntity.item.itemID)!;
         if (itemEntityFoodInfo.foodUnits > highestFoodValue) {
            mostNutritiousFoodSource = itemEntity;
            highestFoodValue = itemEntityFoodInfo.foodUnits;
         }
      }
      if (this.tileTargets.has(this.mob.currentTile.type)) {
         const tileFoodInfo = this.tileTargets.get(this.mob.currentTile.type)!;
         if (tileFoodInfo.foodUnits > highestFoodValue) {
            mostNutritiousFoodSource = this.mob.currentTile;
         }
      }

      const previousTarget = this.target;

      if (typeof mostNutritiousFoodSource === "undefined") {
         this.target = null;
         return;
      } else {
         this.target = mostNutritiousFoodSource;
      }

      if (this.target.hasOwnProperty("hitbox")) {
         // Move to the target item entity
         const target = this.target as ItemEntity;
         super.moveToPosition(target.position, this.acceleration, this.terminalVelocity);
      } else {
         const target = this.target as Tile;

         this.mob.acceleration = null;

         if (previousTarget !== this.target) {
            const foodInfo = this.tileTargets.get(target.type)!;
            this.grazeTimer = foodInfo.grazeTime;
         }
      }
   }

   public onDeactivation(): void {
      this.target = null;
   }

   public tick(): void {
      super.tick();

      if (this.target === null) return;

      if (!this.target.hasOwnProperty("item")) {
         this.grazeTimer -= 1 / SETTINGS.TPS;
         if (this.grazeTimer <= 0) {
            const target = this.target as Tile;
            const foodInfo = this.tileTargets.get(target.type)!;
            this.graze(foodInfo);
         }
      }
   }

   private graze(foodInfo: TileFoodSource): void {
      const previousTile = this.mob.currentTile;
      const newTileInfo: TileInfo = {
         type: foodInfo.resultingTileType,
         biome: previousTile.biome,
         isWall: previousTile.isWall
      };
      SERVER.board.changeTile(previousTile.x, previousTile.y, newTileInfo);

      this.food += foodInfo.foodUnits;
      if (this.food > 100) {
         this.food = 100;
      }
   }

   protected _getWeight(): number {
      if (this.isActive && this.target === null) return 0;

      // Calculate item entities in range
      this.itemEntitiesInRange.clear();
      const minX = Math.max(Math.min(Math.floor((this.mob.position.x - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxX = Math.max(Math.min(Math.floor((this.mob.position.x + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const minY = Math.max(Math.min(Math.floor((this.mob.position.y - this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      const maxY = Math.max(Math.min(Math.floor((this.mob.position.y + this.mob.visionRange) / SETTINGS.TILE_SIZE / SETTINGS.CHUNK_SIZE), SETTINGS.BOARD_SIZE - 1), 0);
      for (let chunkX = minX; chunkX <= maxX; chunkX++) {
         for (let chunkY = minY; chunkY <= maxY; chunkY++) {
            for (const itemEntity of SERVER.board.getChunk(chunkX, chunkY).getItemEntities()) {
               if (!this.itemEntitiesInRange.has(itemEntity)) {
                  this.itemEntitiesInRange.add(itemEntity);
               }
            }
         }
      }

      this.food -= this.metabolism / SETTINGS.TPS * Mob.AI_REFRESH_TIME;
      if (this.food < 0) {
         this.food = 0;
      }
      
      const rawWeight = 1 - this.food / StarveAI.STOMACH_CAPACITY;
      const weight = Math.pow(rawWeight, 2);

      // Try to activate the AI if the entity is on a tile it can eat
      if (this.tileTargets.has(this.mob.currentTile.type)) {
         return weight;
      }

      // Try to activate the AI if the entity can see something to eat
      if (this.itemEntitiesInRange.size > 0) {
         return weight;
      }

      return 0;
   }
}

export default StarveAI;