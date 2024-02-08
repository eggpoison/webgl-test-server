import { HeatingRecipe } from "../entities/cooking-entities/cooking-entity";

export class CookingComponent {
   public heatingTimer = 0;
   public currentRecipe: HeatingRecipe | null = null;

   public remainingHeatSeconds = 0;
}