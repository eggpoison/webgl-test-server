import { HeatingRecipe } from "../entities/cooking-entities/cooking-entity";

// @Cleanup: maybe rename to something more appropriate like "CookingComponent"
export class CookingEntityComponent {
   public heatingTimer = 0;
   public currentRecipe: HeatingRecipe | null = null;

   public remainingHeatSeconds = 0;
}