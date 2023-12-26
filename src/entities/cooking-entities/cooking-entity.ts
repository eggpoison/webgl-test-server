import { CookingIngredientItemType, FuelSourceItemType, IEntityType, ItemType, SETTINGS } from "webgl-test-shared";
import Entity from "../../GameObject";
import { CookingEntityComponentArray, InventoryComponentArray } from "../../components/ComponentArray";
import { addItemToInventory, consumeItemTypeFromInventory, getInventory } from "../../components/InventoryComponent";

export interface HeatingRecipe {
   readonly ingredientType: CookingIngredientItemType;
   readonly ingredientAmount: number;
   readonly productType: ItemType;
   readonly productAmount: number;
   readonly cookTime: number;
   /** Which heating entities are able to use the recipe */
   readonly usableHeatingEntityTypes: ReadonlyArray<IEntityType>;
}

const HEATING_INFO: ReadonlyArray<HeatingRecipe> = [
   {
      ingredientType: ItemType.raw_beef,
      ingredientAmount: 1,
      productType: ItemType.cooked_beef,
      productAmount: 1,
      cookTime: 5,
      usableHeatingEntityTypes: [IEntityType.campfire, IEntityType.furnace]
   },
   {
      ingredientType: ItemType.meat_suit,
      ingredientAmount: 1,
      productType: ItemType.cooked_beef,
      productAmount: 5,
      cookTime: 5,
      usableHeatingEntityTypes: [IEntityType.campfire, IEntityType.furnace]
   },
   {
      ingredientType: ItemType.raw_fish,
      ingredientAmount: 1,
      productType: ItemType.cooked_fish,
      productAmount: 1,
      cookTime: 5,
      usableHeatingEntityTypes: [IEntityType.campfire, IEntityType.furnace]
   }
];

/** The seconds of heating given by different item types */
const FUEL_SOURCES: Record<FuelSourceItemType, number> = {
   [ItemType.wood]: 5
};

const getHeatingRecipeByIngredientType = (heatingEntityType: IEntityType, ingredientType: ItemType): HeatingRecipe | null => {
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

export function tickCookingEntity(entity: Entity): void {
   const cookingEntityComponent = CookingEntityComponentArray.getComponent(entity);
   const inventoryComponent = InventoryComponentArray.getComponent(entity);

   const fuelInventory = getInventory(inventoryComponent, "fuelInventory");
   const ingredientInventory = getInventory(inventoryComponent, "ingredientInventory");
   
   if (ingredientInventory.itemSlots.hasOwnProperty(1)) {
      cookingEntityComponent.currentRecipe = getHeatingRecipeByIngredientType(entity.type, ingredientInventory.itemSlots[1].type);
   }
   
   if (cookingEntityComponent.currentRecipe !== null) {
      // If the heating entity needs more heat, attempt to use a fuel item
      if (cookingEntityComponent.remainingHeatSeconds <= 0 && fuelInventory.itemSlots.hasOwnProperty(1)) {
         const fuel = fuelInventory.itemSlots[1];
         if (!FUEL_SOURCES.hasOwnProperty(fuel.type)) {
            console.warn(`Item type '${ItemType[fuel.type]}' is not a valid fuel type.`);
            return;
         }

         consumeItemTypeFromInventory(inventoryComponent, "fuelInventory", fuelInventory.itemSlots[1].type, 1);
         cookingEntityComponent.remainingHeatSeconds += FUEL_SOURCES[fuel.type as keyof typeof FUEL_SOURCES];
      }

      if (cookingEntityComponent.remainingHeatSeconds > 0) {
         cookingEntityComponent.heatingTimer += 1 / SETTINGS.TPS;
         if (cookingEntityComponent.heatingTimer >= cookingEntityComponent.currentRecipe.cookTime) {
            // Remove from ingredient inventory and add to output inventory
            consumeItemTypeFromInventory(inventoryComponent, "ingredientInventory", cookingEntityComponent.currentRecipe.ingredientType, cookingEntityComponent.currentRecipe.ingredientAmount);
            addItemToInventory(inventoryComponent, "outputInventory", cookingEntityComponent.currentRecipe.productType, cookingEntityComponent.currentRecipe.productAmount);

            cookingEntityComponent.heatingTimer = 0;
            cookingEntityComponent.currentRecipe = null;
         }

         cookingEntityComponent.remainingHeatSeconds -= 1 / SETTINGS.TPS;
      }
   }
}