import { CookingIngredientItemType, EntityType, FuelSourceItemType, InventoryData, ItemType, Point, SETTINGS } from "webgl-test-shared";
import InventoryComponent, { serializeInventoryData } from "../entity-components/InventoryComponent";
import Entity, { EntityComponents } from "./Entity";
import Item from "../items/Item";

interface HeatingRecipe {
   readonly ingredientType: CookingIngredientItemType;
   readonly ingredientAmount: number;
   readonly productType: ItemType;
   readonly productAmount: number;
   readonly cookTime: number;
   /** Which heating entities are able to use the recipe */
   readonly usableHeatingEntityTypes: ReadonlyArray<EntityType>;
}

const HEATING_INFO: ReadonlyArray<HeatingRecipe> = [
   {
      ingredientType: ItemType.raw_beef,
      ingredientAmount: 1,
      productType: ItemType.cooked_beef,
      productAmount: 1,
      cookTime: 5,
      usableHeatingEntityTypes: ["campfire", "furnace"]
   },
   {
      ingredientType: ItemType.meat_suit,
      ingredientAmount: 1,
      productType: ItemType.cooked_beef,
      productAmount: 5,
      cookTime: 5,
      usableHeatingEntityTypes: ["campfire", "furnace"]
   }
];

/** The seconds of heating given by different item types */
const FUEL_SOURCES: Record<FuelSourceItemType, number> = {
   [ItemType.wood]: 5
};

const getHeatingRecipeByIngredientType = (heatingEntityType: EntityType, ingredientType: ItemType): HeatingRecipe | null => {
   for (const heatingInfo of HEATING_INFO) {
      if (heatingInfo.ingredientType === ingredientType) {
         // Found it!

         // If the heating entity type can't use that recipe, don't let it craft it
         if (!heatingInfo.usableHeatingEntityTypes.includes(heatingEntityType)) {
            return null;
         }

         return heatingInfo;
      }
   }

   console.warn(`Couldn't find a heating recipe for '${ingredientType}'.`);
   return null;
}

abstract class HeatingEntity extends Entity {
   private heatingTimer = 0;
   private currentRecipe: HeatingRecipe | null = null;
   private remainingHeat = 0;
   
   constructor(position: Point, components: Partial<EntityComponents>, entityType: EntityType) {
      components.inventory = new InventoryComponent();
      
      super(position, components, entityType);

      components.inventory.createNewInventory("fuelInventory", 1, 1, false);
      components.inventory.createNewInventory("ingredientInventory", 1, 1, false);
      components.inventory.createNewInventory("outputInventory", 1, 1, false);
   }

   public tick(): void {
      super.tick();

      const inventoryComponent = this.forceGetComponent("inventory");
      const fuelInventory = inventoryComponent.getInventory("fuelInventory");
      const ingredientInventory = inventoryComponent.getInventory("ingredientInventory");

      if (ingredientInventory.itemSlots.hasOwnProperty(1)) {
         this.currentRecipe = getHeatingRecipeByIngredientType(this.type, ingredientInventory.itemSlots[1].type);
      }
      
      if (this.currentRecipe !== null) {
         // If the heating entity needs more heat, attempt to use a fuel item
         if (this.remainingHeat <= 0 && fuelInventory.itemSlots.hasOwnProperty(1)) {
            const fuel = fuelInventory.itemSlots[1];
            if (!FUEL_SOURCES.hasOwnProperty(fuel.type)) {
               console.warn(`Item type '${ItemType[fuel.type]}' is not a valid fuel type.`);
               return;
            }

            inventoryComponent.consumeItemTypeFromInventory("fuelInventory", fuelInventory.itemSlots[1].type, 1);
            this.remainingHeat += FUEL_SOURCES[fuel.type as keyof typeof FUEL_SOURCES];
         }

         if (this.remainingHeat > 0) {
            this.heatingTimer += 1 / SETTINGS.TPS;
            if (this.heatingTimer >= this.currentRecipe.cookTime) {
               // Remove from ingredient inventory
               inventoryComponent.consumeItemTypeFromInventory("ingredientInventory", this.currentRecipe.ingredientType, this.currentRecipe.ingredientAmount);

               // Add to output inventory
               const item = new Item(this.currentRecipe.productType, this.currentRecipe.productAmount);
               inventoryComponent.addItemToInventory("outputInventory", item);
   
               this.heatingTimer = 0;
               this.currentRecipe = null;
            }

            this.remainingHeat -= 1 / SETTINGS.TPS;
         }
      }
   }

   public getClientArgs(): [fuelInventory: InventoryData, ingredientInveotry: InventoryData, outputInventory: InventoryData, heatingProgress: number] {
      const inventoryComponent = this.forceGetComponent("inventory");
      return [
         serializeInventoryData(inventoryComponent.getInventory("fuelInventory"), "fuelInventory"),
         serializeInventoryData(inventoryComponent.getInventory("ingredientInventory"), "ingredientInventory"),
         serializeInventoryData(inventoryComponent.getInventory("outputInventory"), "outputInventory"),
         this.currentRecipe !== null ? this.heatingTimer / this.currentRecipe.cookTime : -1
      ];
   }
}

export default HeatingEntity;