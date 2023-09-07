import { InventoryData, ItemType, ParticleType, Point, SETTINGS, Vector, lerp, randFloat } from "webgl-test-shared";
import Entity from "./Entity";
import HealthComponent from "../entity-components/HealthComponent";
import InventoryComponent, { serializeInventoryData } from "../entity-components/InventoryComponent";
import RectangularHitbox from "../hitboxes/RectangularHitbox";
import Board from "../Board";
import TexturedParticle from "../TexturedParticle";
import Item from "../items/Item";

interface HeatingRecipe {
   readonly ingredientType: ItemType;
   readonly ingredientAmount: number;
   readonly productType: ItemType;
   readonly productAmount: number;
   readonly heatingTime: number;
}

const HEATING_INFO: ReadonlyArray<HeatingRecipe> = [
   {
      ingredientType: ItemType.raw_beef,
      ingredientAmount: 1,
      productType: ItemType.cooked_beef,
      productAmount: 1,
      heatingTime: 5
   }
];

interface FuelInfo {
   readonly itemType: ItemType;
   /** Seconds of heat that the item provides */
   readonly heatValue: number;
}

const FUEL_INFO: ReadonlyArray<FuelInfo> = [
   {
      itemType: ItemType.wood,
      heatValue: 5
   }
];

const getHeatingRecipeByIngredientType = (ingredientType: ItemType): HeatingRecipe => {
   for (const heatingInfo of HEATING_INFO) {
      if (heatingInfo.ingredientType === ingredientType) {
         return heatingInfo;
      }
   }

   throw new Error(`Couldn't find a heating recipe for '${ingredientType}'`);
}

const getFuelInfoByIngredientType = (ingredientType: ItemType): FuelInfo => {
   for (const heatingInfo of FUEL_INFO) {
      if (heatingInfo.itemType === ingredientType) {
         return heatingInfo;
      }
   }

   throw new Error(`Couldn't find fuel info for '${ingredientType}'`);
}

class Furnace extends Entity {
   private static readonly MAX_HEALTH = 25;
   
   private static readonly SIZE = 80;

   private heatingProgress = 0;
   private currentRecipe: HeatingRecipe | null = null;
   private remainingHeat = 0;
   
   constructor(position: Point, isNaturallySpawned: boolean) {
      const inventoryComponent = new InventoryComponent()
      
      super(position, {
         health: new HealthComponent(Furnace.MAX_HEALTH, false),
         inventory: inventoryComponent
      }, "furnace", isNaturallySpawned);


      const hitbox = new RectangularHitbox();
      hitbox.setHitboxInfo(Furnace.SIZE, Furnace.SIZE);
      this.addHitbox(hitbox);

      inventoryComponent.createNewInventory("fuelInventory", 1, 1, false);
      inventoryComponent.createNewInventory("ingredientInventory", 1, 1, false);
      inventoryComponent.createNewInventory("outputInventory", 1, 1, false);
   }

   public tick(): void {
      super.tick();

      const inventoryComponent = this.getComponent("inventory")!;
      const fuelInventory = inventoryComponent.getInventory("fuelInventory");
      const ingredientInventory = inventoryComponent.getInventory("ingredientInventory");

      if (ingredientInventory.itemSlots.hasOwnProperty(1)) {
         this.currentRecipe = getHeatingRecipeByIngredientType(ingredientInventory.itemSlots[1].type);
      }
      
      if (this.currentRecipe !== null) {
         // Use fuel
         if (this.remainingHeat <= 0) {
            if (fuelInventory.itemSlots.hasOwnProperty(1)) {
               const fuelInfo = getFuelInfoByIngredientType(fuelInventory.itemSlots[1].type);
               inventoryComponent.consumeItemTypeFromInventory("fuelInventory", fuelInventory.itemSlots[1].type, 1);
               this.remainingHeat += fuelInfo.heatValue;
            }
         }

         if (this.remainingHeat > 0) {
            this.heatingProgress += 1 / SETTINGS.TPS;
            if (this.heatingProgress >= this.currentRecipe.heatingTime) {
               // Remove from ingredient inventory
               inventoryComponent.consumeItemTypeFromInventory("ingredientInventory", this.currentRecipe.ingredientType, this.currentRecipe.ingredientAmount);

               // Add to output inventory
               const item = new Item(this.currentRecipe.productType, this.currentRecipe.productAmount);
               inventoryComponent.addItemToInventory("outputInventory", item);
   
               this.heatingProgress = 0;
               this.currentRecipe = null;
            }

            this.remainingHeat -= 1 / SETTINGS.TPS;
            if (Board.tickIntervalHasPassed(0.1)) {
               this.createSmokeParticle();
            }
         }
      }
   }

   private createSmokeParticle(): void {
      const spawnPosition = this.position.copy();
      const offset = new Vector(5 * Math.random(), 2 * Math.PI * Math.random()).convertToPoint();
      spawnPosition.add(offset);

      const lifetime = 1.5;
      
      new TexturedParticle({
         type: ParticleType.smokeBlack,
         spawnPosition: spawnPosition,
         initialVelocity: new Vector(30, 0),
         initialAcceleration: new Vector(80, 0),
         initialRotation: 2 * Math.PI * Math.random(),
         angularAcceleration: 0.75 * Math.PI * randFloat(-1, 1),
         opacity: (age: number): number => {
            return lerp(0.5, 0, age / lifetime);
         },
         scale: (age: number): number => {
            const deathProgress = age / lifetime
            return 1 + deathProgress * 2;
         },
         lifetime: lifetime
      });
   }

   public getClientArgs(): [fuelInventory: InventoryData, ingredientInveotry: InventoryData, outputInventory: InventoryData] {
      const inventoryComponent = this.getComponent("inventory")!;
      return [
         serializeInventoryData(inventoryComponent.getInventory("fuelInventory"), "fuelInventory"),
         serializeInventoryData(inventoryComponent.getInventory("ingredientInventory"), "ingredientInventory"),
         serializeInventoryData(inventoryComponent.getInventory("outputInventory"), "outputInventory")
      ];
   }
}

export default Furnace;